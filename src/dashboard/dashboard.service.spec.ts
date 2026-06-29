import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockPrismaService = {
    customer: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    order: {
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    expense: {
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should aggregate stats and return recent lists', async () => {
    const workspaceId = 'test-workspace-id';

    mockPrismaService.customer.count.mockResolvedValue(10);
    mockPrismaService.order.count.mockImplementation(async ({ where }) => {
      if (where.status?.in) {
        return 5; // active orders
      }
      if (where.status === 'DELIVERED') {
        return 3; // completed orders
      }
      if (where.createdAt?.gte) {
        return 2; // today's orders
      }
      return 0;
    });

    const mockRecentCustomers = [{ id: 'c1', fullName: 'Customer One' }];
    const mockRecentOrders = [{ id: 'o1', orderNumber: 'ORD-000001', customer: { id: 'c1', fullName: 'Customer One' } }];

    mockPrismaService.customer.findMany.mockResolvedValue(mockRecentCustomers);
    mockPrismaService.order.findMany.mockResolvedValue(mockRecentOrders);
    mockPrismaService.order.aggregate.mockResolvedValue({ _sum: { paidAmount: 5000 } });
    mockPrismaService.expense.aggregate.mockResolvedValue({ _sum: { amount: 1200 } });

    const result = await service.getDashboardData(workspaceId);

    expect(result).toEqual({
      stats: {
        totalCustomers: 10,
        activeOrders: 5,
        completedOrders: 3,
        todaysOrders: 2,
        totalRevenue: 5000,
        totalExpenses: 1200,
        netProfit: 3800,
      },
      recentCustomers: mockRecentCustomers,
      recentOrders: mockRecentOrders,
    });

    expect(mockPrismaService.customer.count).toHaveBeenCalledWith({
      where: { workspaceId },
    });
    expect(mockPrismaService.order.count).toHaveBeenCalledTimes(3);
    expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });
  });
});
