import { ParentService } from './parent.service';

describe('Parent home debt summary', () => {
  it.each([
    [-65000, 50000, 65000, 0],
    [-50000, 50000, 50000, 0],
    [-33000, 50000, 33000, 17000],
    [10000, 50000, 0, 50000],
    [-10000, 90000, 10000, 40000],
    [-10000, 0, 10000, 0],
  ])(
    'returns the debt and remaining allowance for balance %s and cap %s',
    async (balance, cap, debt, availableDebtLimit) => {
      const service = new ParentService(
        {
          findOne: jest
            .fn()
            .mockResolvedValue({
              id: 'customer',
              userId: 'student',
              debtLimit: cap,
            }),
        } as any,
        { findOne: jest.fn().mockResolvedValue({ balance }) } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
      jest
        .spyOn(service as any, 'getUserInfo')
        .mockResolvedValue({ id: 'customer' });
      jest
        .spyOn(service as any, 'getRecentNotifications')
        .mockResolvedValue([]);
      jest.spyOn(service as any, 'getTodayOrder').mockResolvedValue(null);
      jest.spyOn(service as any, 'getRecentHistory').mockResolvedValue([]);
      const stats = jest
        .spyOn(service as any, 'getStatistics')
        .mockResolvedValue({});
      const result = await service.getParentHome('student');
      expect(result.wallet).toEqual({
        balance,
        debtLimit: Math.min(cap, 50000),
        debt,
        availableDebtLimit,
      });
      expect(stats).toHaveBeenCalledWith('customer', Math.min(cap, 50000));
    },
  );
});
