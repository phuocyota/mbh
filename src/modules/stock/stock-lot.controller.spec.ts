import { StockLotController } from './stock-lot.controller';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { join } from 'path';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guard/roles.guard';

class MetadataSource extends DataSource {
  async inspect() {
    await this.buildMetadatas();
  }
}

function harness() {
  const qb: any = {};
  for (const name of [
    'innerJoinAndMapOne',
    'leftJoinAndMapOne',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
  ])
    qb[name] = jest.fn(() => qb);
  qb.getManyAndCount = jest.fn(async () => [[{ id: 'lot', quantity: 2 }], 1]);
  const db: any = {
    getRepository: jest.fn(() => ({ createQueryBuilder: () => qb })),
  };
  return {
    qb,
    db,
    controller: new StockLotController(db, {} as any, {} as any),
  };
}

describe('stock lot management listing', () => {
  it('limits FEFO suggestions to admin and manager roles', () => {
    const guard = new RolesGuard(new Reflector());
    for (const userType of ['ADMIN', 'MANAGER', 'HEAD_CHEF', 'KITCHEN', 'CASHIER', 'STUDENT']) {
      const context: any = {
        getHandler: () => StockLotController.prototype.fefo,
        getClass: () => StockLotController,
        switchToHttp: () => ({ getRequest: () => ({ user: { userType } }) }),
      };
      if (['ADMIN', 'MANAGER'].includes(userType)) expect(guard.canActivate(context)).toBe(true);
      else expect(() => guard.canActivate(context)).toThrow();
    }
  });
  const request = { user: { userType: 'MANAGER', branchId: 'branch' } };
  it('builds the real TypeORM joined pagination ordering without a database connection', async () => {
    const db = new MetadataSource({
      type: 'postgres',
      entities: [join(__dirname, '../../entities/*.entity.ts')],
      synchronize: false,
    });
    await db.inspect();
    const execution = jest
      .spyOn(SelectQueryBuilder.prototype, 'getManyAndCount')
      .mockImplementation(async function (this: SelectQueryBuilder<any>) {
        // This is the same metadata lookup TypeORM performs for skip/take with joins.
        const [selection] = (
          this as any
        ).createOrderByCombinedWithSelectExpression('distinctAlias');
        expect(selection).toContain('l_expires_at');
        expect(selection).toContain('l_id');
        expect(this.getQuery()).toContain('NULLS LAST');
        return [[], 0];
      });
    try {
      const controller = new StockLotController(db, {} as any, {} as any);
      expect(
        await controller.list(request, { page: 2, size: 20 }),
      ).toMatchObject({ data: [], total: 0, page: 2, size: 20 });
      expect(execution).toHaveBeenCalledTimes(1);
    } finally {
      execution.mockRestore();
    }
  });
  it('scopes by JWT branch and returns product, warehouse and base unit with pagination', async () => {
    const h = harness();
    const result = await h.controller.list(request, {
      page: 2,
      size: 20,
      search: ' Meat ',
    });
    expect(h.qb.where).toHaveBeenCalledWith('s.branch_id=:branchId', {
      branchId: 'branch',
    });
    expect(h.qb.innerJoinAndMapOne).toHaveBeenCalledTimes(2);
    expect(h.qb.leftJoinAndMapOne).toHaveBeenCalledTimes(1);
    expect(h.qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('p.name ILIKE'),
      { search: '%Meat%' },
    );
    expect(h.qb.skip).toHaveBeenCalledWith(20);
    expect(result).toMatchObject({ page: 2, size: 20, total: 1 });
  });
  it('rejects a different branch before querying', async () => {
    const h = harness();
    await expect(
      h.controller.list(request, { branchId: 'foreign' }),
    ).rejects.toThrow('CROSS_BRANCH_FORBIDDEN');
    expect(h.db.getRepository).not.toHaveBeenCalled();
  });
  it.each(['AVAILABLE', 'EXPIRED', 'EXPIRING', 'DEPLETED'])(
    'applies the %s filter on the server',
    async (status) => {
      const h = harness();
      await h.controller.list(request, { status, productType: 'INGREDIENT' });
      expect(h.qb.andWhere).toHaveBeenCalledWith('p.product_type=:type', {
        type: 'INGREDIENT',
      });
      const sql = h.qb.andWhere.mock.calls.map((call) => call[0]).join(' ');
      expect(sql).toContain(
        status === 'DEPLETED' ? 'l.quantity<=0' : 'l.quantity>0',
      );
      if (status === 'EXPIRING') {
        const [, dates] = h.qb.andWhere.mock.calls.find((call) =>
          call[0].includes('BETWEEN'),
        );
        expect(Date.parse(dates.until) - Date.parse(dates.today)).toBe(
          7 * 86400000,
        );
      }
    },
  );
  it('caps page size and validates product UUID', async () => {
    const h = harness();
    await h.controller.list(request, { size: 100000 });
    expect(h.qb.take).toHaveBeenCalledWith(100);
    await expect(
      h.controller.list(request, { productId: 'bad' }),
    ).rejects.toThrow('INVALID_LOT_PRODUCT');
  });
});
