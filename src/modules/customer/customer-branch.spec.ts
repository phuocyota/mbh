import { CustomerService } from './customer.service';

describe('Customer branch filtering', () => {
  function harness() {
    const qb: any = {};
    for (const method of [
      'leftJoin',
      'leftJoinAndSelect',
      'orderBy',
      'skip',
      'take',
      'andWhere',
    ]) {
      qb[method] = jest.fn().mockReturnValue(qb);
    }
    qb.getManyAndCount = jest
      .fn()
      .mockResolvedValue([[{ id: 'guest', wallet: { balance: -50000 } }], 1]);
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    return {
      qb,
      service: new CustomerService(
        repo as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      ),
    };
  }

  it('lists debt using customer branch with a legacy linked-user fallback', async () => {
    const { service, qb } = harness();
    const result = await service.findAll(1, 100, 'branch-a', true);
    expect(qb.andWhere).toHaveBeenCalledWith(
      'COALESCE(customer.branch_id, customerUser.branch_id) = :branchId',
      { branchId: 'branch-a' },
    );
    expect(result.data).toEqual([{ id: 'guest', debt: 50000 }]);
  });

  it('applies the same scope to customer searches', async () => {
    const { service, qb } = harness();
    await service.searchCustomers('', 1, 50, 'branch-a');
    expect(qb.andWhere).toHaveBeenCalledWith(
      'COALESCE(c.branch_id, customerUser.branch_id) = :branchId',
      { branchId: 'branch-a' },
    );
  });

  it.each([
    [-65000, 65000, 0],
    [-45000, 45000, 5000],
    [10000, 0, 50000],
  ])(
    'returns a fixed cap and remaining borrowing capacity for balance %s',
    async (balance, debt, availableDebtLimit) => {
      const { service } = harness();
      jest
        .spyOn(service, 'findByUserIdWithStudentAndWallet')
        .mockResolvedValue({
          fullName: 'Student',
          debtLimit: 50000,
          wallet: { balance },
        } as any);
      const info = await service.getStudentInfoByUserId('student-user');
      expect(info).toEqual(
        expect.objectContaining({
          debtLimit: 50000,
          debt,
          availableDebtLimit,
        }),
      );
    },
  );
});
