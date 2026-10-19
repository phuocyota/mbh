import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';

function harness(exists = async () => false) {
  let sequence = 0;
  const repo = {
    query: jest.fn(async () => [{ value: String(++sequence) }]),
    existsBy: jest.fn(exists),
  };
  const service = new CustomerService(
    repo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, repo };
}

describe('Customer code allocation', () => {
  it('assigns new customers to the authenticated branch and records the creator', async () => {
    const service = { create: jest.fn().mockResolvedValue({ id: 'customer' }) };
    const actor = { userId: 'actor', branchId: 'branch-a' };
    await new CustomerController(service as any).create(
      {
        customerCode: 'KH000001',
        fullName: 'Nguyễn Trường An',
        branchId: 'branch-b',
      } as any,
      { user: actor },
    );
    expect(service.create).toHaveBeenCalledWith(
      {
        customerCode: 'KH000001',
        fullName: 'Nguyễn Trường An',
        branchId: 'branch-a',
      },
      actor,
    );
  });

  it('does not create an unscoped customer when the actor has no branch', async () => {
    const service = { create: jest.fn() };
    await expect(
      new CustomerController(service as any).create(
        {
          customerCode: 'KH000001',
          fullName: 'Khách hàng',
        },
        { user: { userId: 'actor' } },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(service.create).not.toHaveBeenCalled();
  });

  it('formats the first reserved number with the KH prefix', async () => {
    const { service } = harness();
    await expect(service.generateCode()).resolves.toBe('KH000001');
  });

  it('skips an existing manually created code', async () => {
    const { service, repo } = harness();
    repo.existsBy.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(service.generateCode()).resolves.toBe('KH000002');
  });

  it('uses distinct atomic sequence values for concurrent callers', async () => {
    const { service } = harness();
    const codes = await Promise.all(
      Array.from({ length: 25 }, () => service.generateCode()),
    );
    expect(new Set(codes).size).toBe(25);
    expect(codes).toContain('KH000025');
  });

  it('keeps numbers wider than six digits intact', async () => {
    const { service, repo } = harness();
    repo.query.mockResolvedValueOnce([{ value: '1000000' }]);
    await expect(service.generateCode()).resolves.toBe('KH1000000');
  });

  it('returns the code without creating a customer', async () => {
    const service = {
      generateCode: jest.fn().mockResolvedValue('KH000001'),
      create: jest.fn(),
    };
    const result = await new CustomerController(service as any).generateCode();
    expect(result).toEqual({ customerCode: 'KH000001' });
    expect(service.create).not.toHaveBeenCalled();
  });

  it('returns a client conflict when an existing customer code is submitted', async () => {
    const service = {
      create: jest.fn().mockRejectedValue({ driverError: { code: '23505' } }),
    };
    await expect(
      new CustomerController(service as any).create(
        {
          customerCode: 'KH000001',
          fullName: 'Khách hàng',
        },
        { user: { userId: 'actor', branchId: 'branch-a' } },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
