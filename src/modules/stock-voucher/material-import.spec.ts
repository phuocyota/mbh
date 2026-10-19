import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMaterialImportDto } from './dto/create-material-import.dto';
import { StockVoucherController } from './stock-voucher.controller';
import { StockVoucherService } from './stock-voucher.service';

const productId = 'c82b57c4-4d9e-4c8a-85eb-fef828bd0529';
function input() {
  return {
    requestId: '37e62acf-18fd-4f2c-ab4c-f1d68bc504f9',
    supplierId: '07b4b0cf-8964-4cd6-81cf-7f4aa693ba9e',
    paymentStatus: 'DEBT',
    items: [
      {
        productId,
        lotCode: ' LOT-1 ',
        quantity: 2,
        unitPrice: 10000,
        expiresAt: '2099-01-01',
      },
    ],
  };
}

describe('Material import API', () => {
  it('validates and trims lot codes while allowing several lots of the same product', async () => {
    const body = input();
    body.items.push({ ...body.items[0], lotCode: 'LOT-2' });
    const dto = plainToInstance(CreateMaterialImportDto, body);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.items[0].lotCode).toBe('LOT-1');
  });
  it.each(['lotCode', 'quantity', 'unitPrice'])(
    'requires %s on each line',
    async (field) => {
      const body: any = input();
      delete body.items[0][field];
      expect(
        (await validate(plainToInstance(CreateMaterialImportDto, body))).length,
      ).toBeGreaterThan(0);
    },
  );
  it('requires request identity and supplier payment status', async () => {
    const body: any = input();
    delete body.requestId;
    delete body.paymentStatus;
    expect(
      (await validate(plainToInstance(CreateMaterialImportDto, body))).map(
        (e) => e.property,
      ),
    ).toEqual(expect.arrayContaining(['requestId', 'paymentStatus']));
  });
  it('uses JWT branch and actor for the import', () => {
    const service: any = { createMaterialImport: jest.fn() };
    const controller = new StockVoucherController(service);
    const dto: any = input();
    controller.createMaterialImport(
      { user: { userType: 'MANAGER', branchId: 'branch', userId: 'staff' } },
      dto,
    );
    expect(service.createMaterialImport).toHaveBeenCalledWith(
      { ...dto, branchId: 'branch' },
      'staff',
    );
    expect(() =>
      controller.createMaterialImport(
        { user: { userType: 'MANAGER', branchId: 'branch', userId: 'staff' } },
        { ...dto, branchId: 'foreign' },
      ),
    ).toThrow('CROSS_BRANCH_FORBIDDEN');
    expect(service.createMaterialImport).toHaveBeenCalledTimes(1);
  });
  it('delegates to the existing import pipeline with a fixed supplier source and no client type overrides', async () => {
    const service: any = Object.create(StockVoucherService.prototype);
    service.createImportVoucher = jest.fn(async (dto) => dto);
    const result = await service.createMaterialImport(
      {
        ...input(),
        type: 'EXPORT',
        actorId: 'forged',
        sourceType: 'BRANCH',
      } as any,
      'staff',
    );
    expect(result).toMatchObject({
      purpose: 'MATERIAL_IMPORT',
      sourceType: 'SUPPLIER',
      actorId: 'staff',
      sourceId: input().supplierId,
      requestId: input().requestId,
    });
    expect(result.items[0].lotCode).toBe('LOT-1');
    expect(result.type).toBeUndefined();
  });
  it('rejects duplicate product/lot lines before creating a receipt', () => {
    const service: any = Object.create(StockVoucherService.prototype);
    service.createImportVoucher = jest.fn();
    const dto = input();
    dto.items.push({ ...dto.items[0], lotCode: 'LOT-1' });
    expect(() => service.createMaterialImport(dto, 'staff')).toThrow(
      'MATERIAL_IMPORT_DUPLICATE_PRODUCT_LOT',
    );
    expect(service.createImportVoucher).not.toHaveBeenCalled();
  });
  it.each([
    [
      {
        productType: 'FINISHED_GOOD',
        lotTrackingEnabled: true,
        baseUnitId: 'unit',
      },
      'Chỉ được nhập',
    ],
    [
      {
        productType: 'INGREDIENT',
        lotTrackingEnabled: false,
        baseUnitId: 'unit',
      },
      'bật theo dõi lô',
    ],
    [{ productType: 'FUEL', lotTrackingEnabled: true }, 'đơn vị cơ sở'],
  ])(
    'rejects unsupported product configuration before stock/accounting writes',
    async (product, message) => {
      const service: any = Object.create(StockVoucherService.prototype);
      service.transactionManager = {
        query: jest.fn(),
        getRepository: () => ({ findOneBy: async () => product }),
      };
      service.movements = { lockProducts: jest.fn(), normalize: jest.fn() };
      await expect(
        service.createVoucherInTransaction({
          type: 'IMPORT',
          purpose: 'MATERIAL_IMPORT',
          branchId: 'branch',
          items: input().items,
        }),
      ).rejects.toThrow(message);
      expect(service.movements.normalize).not.toHaveBeenCalled();
    },
  );
});
