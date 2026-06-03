import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order, Customer } from '../../entities';

// Mock data để test
type MockOrder = {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
  customerId: string;
};

describe('DashboardService', () => {
  let service: DashboardService;
  let orderRepo: any;
  let customerRepo: any;

  // Create a reusable query builder mock
  const createQueryBuilderMock = () => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  });

  let queryBuilderMock: any;

  const mockOrderRepository = {
    createQueryBuilder: jest.fn(() => queryBuilderMock),
  };

  const mockCustomerRepository = {};

  beforeEach(async () => {
    // Reset and create fresh mock for each test
    queryBuilderMock = createQueryBuilderMock();
    mockOrderRepository.createQueryBuilder.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: mockCustomerRepository,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    orderRepo = module.get(getRepositoryToken(Order));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRevenueStats', () => {
    it('should return revenue stats with correct data structure', async () => {
      // Mock data
      const mockHourlyData = [
        { date: '2026-06-03', hour: 8, orderCount: 5, revenue: 1500000 },
        { date: '2026-06-03', hour: 9, orderCount: 3, revenue: 900000 },
      ];

      const mockDailyData = [
        { date: '2026-06-03', orderCount: 8, revenue: 2400000 },
        { date: '2026-06-02', orderCount: 5, revenue: 1500000 },
      ];

      const mockSummary = {
        totalOrders: 13,
        totalRevenue: 3900000,
      };

      // Setup mock chain - getRawMany called twice, getRawOnce called once
      queryBuilderMock.getRawMany
        .mockResolvedValueOnce(mockHourlyData)
        .mockResolvedValueOnce(mockDailyData);
      queryBuilderMock.getRawOne.mockResolvedValue(mockSummary);

      const result = await service.getRevenueStats('today');

      // Verify structure
      expect(result).toHaveProperty('filter');
      expect(result).toHaveProperty('from');
      expect(result).toHaveProperty('to');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('hourly');
      expect(result).toHaveProperty('daily');

      // Verify summary
      expect(result.summary.orders).toBe(13);
      expect(result.summary.revenue).toBe(3900000);

      // Verify hourly data
      expect(result.hourly).toHaveLength(2);
      expect(result.hourly[0]).toHaveProperty('hour');
      expect(result.hourly[0]).toHaveProperty('orders');
      expect(result.hourly[0]).toHaveProperty('revenue');

      // Verify daily data
      expect(result.daily).toHaveLength(2);
      expect(result.daily[0]).toHaveProperty('date');
      expect(result.daily[0]).toHaveProperty('orders');
      expect(result.daily[0]).toHaveProperty('revenue');

      console.log('✅ Revenue stats test passed:', JSON.stringify(result, null, 2));
    });

    it('should include all active order statuses', async () => {
      queryBuilderMock.getRawMany.mockResolvedValue([]);
      queryBuilderMock.getRawOne.mockResolvedValue({ totalOrders: 0, totalRevenue: 0 });

      await service.getRevenueStats('today');

      // Verify that andWhere was called with all active statuses
      const andWhereCalls = queryBuilderMock.andWhere.mock.calls;
      const statusCall = andWhereCalls.find(
        (call: any[]) => call[0].includes('statuses')
      );

      expect(statusCall).toBeDefined();
      expect(statusCall[1].statuses).toEqual(
        expect.arrayContaining(['PENDING', 'PENDING_PAYMENT', 'PREPARING', 'READY', 'RECEIVED', 'COMPLETED'])
      );

      console.log('✅ Status filter test passed - includes all active statuses');
    });
  });

  describe('getCustomerStats', () => {
    it('should return customer stats with correct data structure', async () => {
      const mockDailyCustomers = [
        { date: '2026-06-03', uniqueCustomers: 8, totalOrders: 12 },
        { date: '2026-06-02', uniqueCustomers: 5, totalOrders: 8 },
      ];

      const mockTotalUnique = { count: 13 };

      // Reset mock and set up new values
      queryBuilderMock.getRawMany.mockResolvedValue(mockDailyCustomers);
      queryBuilderMock.getRawOne.mockResolvedValue(mockTotalUnique);

      const result = await service.getCustomerStats('today');

      // Verify structure
      expect(result).toHaveProperty('filter');
      expect(result).toHaveProperty('from');
      expect(result).toHaveProperty('to');
      expect(result).toHaveProperty('totalCustomers');
      expect(result).toHaveProperty('daily');

      // Verify data
      expect(result.totalCustomers).toBe(13);
      expect(result.daily).toHaveLength(2);
      expect(result.daily[0]).toHaveProperty('date');
      expect(result.daily[0]).toHaveProperty('customers');
      expect(result.daily[0]).toHaveProperty('orders');

      console.log('✅ Customer stats test passed:', JSON.stringify(result, null, 2));
    });
  });

  describe('resolveDateRange', () => {
    it('should return correct date range for today', () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const result = (service as any).resolveDateRange('today');

      expect(result.from.getTime()).toBe(today.setHours(0, 0, 0, 0));
      expect(result.to.getTime()).toBe(today.setHours(23, 59, 59, 999));
    });

    it('should return correct date range for 7days', () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const expectedFrom = new Date(today);
      expectedFrom.setDate(expectedFrom.getDate() - 6);
      expectedFrom.setHours(0, 0, 0, 0);

      const result = (service as any).resolveDateRange('7days');

      expect(result.from.getTime()).toBe(expectedFrom.getTime());
      expect(result.to.getHours()).toBe(23);
    });
  });
});
