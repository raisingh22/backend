import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  const mockNotificationsService = {
    getNotifications: jest.fn(),
  };
  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return list of notifications for user workspace', async () => {
    const mockUser = { id: 'u1', workspaceId: 'w1' };
    const mockAlerts = [
      {
        id: '1',
        type: 'LOW_STOCK',
        title: '⚠️ Low stock',
        message: 'Low stock message',
        createdAt: new Date(),
        severity: 'warning',
      },
    ];

    mockNotificationsService.getNotifications.mockResolvedValue(mockAlerts);

    const result = await controller.getNotifications(mockUser);

    expect(result).toBe(mockAlerts);
    expect(service.getNotifications).toHaveBeenCalledWith('w1');
  });
});
