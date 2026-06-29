import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DashboardService;

  const mockDashboardService = {
    getDashboardData: jest.fn(),
  };
  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return dashboard data for user workspace', async () => {
    const mockUser = { id: 'u1', workspaceId: 'w1' };
    const mockData = {
      stats: {
        totalCustomers: 10,
        activeOrders: 5,
        completedOrders: 3,
        todaysOrders: 2,
      },
      recentCustomers: [],
      recentOrders: [],
    };

    mockDashboardService.getDashboardData.mockResolvedValue(mockData);

    const result = await controller.getDashboardData(mockUser);

    expect(result).toBe(mockData);
    expect(service.getDashboardData).toHaveBeenCalledWith('w1');
  });
});
