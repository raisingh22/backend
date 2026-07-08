import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrismaService = {
    order: {
      findMany: jest.fn(),
    },
    prescription: {
      findMany: jest.fn(),
    },
    customer: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch and generate internal business notifications', async () => {
    const workspaceId = 'test-workspace-id';
    const now = new Date();
    const dobToday = new Date();
    dobToday.setFullYear(1990); // keep same month and day, but 1990

    const mockCustomer = {
      id: 'c1',
      fullName: 'John Doe',
      dateOfBirth: dobToday,
    };
    const mockOrder = {
      id: 'o1',
      orderNumber: 'ORD-000001',
      total: 100,
      paidAmount: 50,
      createdAt: now,
      updatedAt: now,
      expectedDeliveryDate: now,
      customer: { fullName: 'John Doe' },
    };
    const mockPresc = {
      id: 'p1',
      doctorName: 'Dr. Eye',
      createdAt: now,
      customer: { fullName: 'John Doe' },
    };

    // Mock each findMany query
    // 1. newOrders
    mockPrismaService.order.findMany.mockImplementation(async ({ where }) => {
      if (where.createdAt?.gte) {
        // newOrders
        return [mockOrder];
      }
      if (where.status === 'READY') {
        // readyOrders
        return [mockOrder];
      }
      if (where.expectedDeliveryDate) {
        // todayDeliveries
        return [mockOrder];
      }
      if (where.paidAmount?.gt === 0) {
        // payments
        return [mockOrder];
      }
      if (where.status?.in) {
        // pendingOrders
        return [mockOrder];
      }
      return [];
    });

    // 2. newPrescriptions
    mockPrismaService.prescription.findMany.mockResolvedValue([mockPresc]);

    // 3. customers
    mockPrismaService.customer.findMany.mockImplementation(
      async ({ include }) => {
        if (include?.prescriptions) {
          // customersWithPrescriptions
          const oldDate = new Date();
          oldDate.setMonth(oldDate.getMonth() - 8); // more than 6 months ago
          return [
            {
              id: 'c1',
              fullName: 'John Doe',
              prescriptions: [{ prescriptionDate: oldDate }],
            },
          ];
        }
        // customersWithDob
        return [mockCustomer];
      },
    );

    const result = await service.getNotifications(workspaceId);

    // Verify static inventory low stock is also included (total alerts should be > 0)
    expect(result.length).toBeGreaterThan(0);

    // Verify low stock warning is present
    const lowStockAlert = result.find((alert) => alert.type === 'LOW_STOCK');
    expect(lowStockAlert).toBeDefined();
    expect(lowStockAlert?.severity).toBe('warning');

    // Verify new order alert
    const newOrderAlert = result.find((alert) => alert.type === 'NEW_ORDER');
    expect(newOrderAlert).toBeDefined();
    expect(newOrderAlert?.message).toContain('ORD-000001');

    // Verify birthday alert
    const birthdayAlert = result.find(
      (alert) => alert.type === 'CUSTOMER_BIRTHDAY',
    );
    expect(birthdayAlert).toBeDefined();

    // Verify revisit alert
    const revisitAlert = result.find(
      (alert) => alert.type === 'CUSTOMER_REVISIT',
    );
    expect(revisitAlert).toBeDefined();
  });
});
