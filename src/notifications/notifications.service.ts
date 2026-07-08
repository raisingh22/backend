import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: Date;
  severity: 'info' | 'warning' | 'error' | 'success';
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(workspaceId: string): Promise<NotificationAlert[]> {
    const notifications: NotificationAlert[] = [];

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const seventyTwoHoursAgo = new Date(
      now.getTime() - 3 * 24 * 60 * 60 * 1000,
    );
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    // 1. Fetch data in parallel
    const [
      newOrders,
      newPrescriptions,
      readyOrders,
      todayDeliveries,
      payments,
      pendingOrders,
      customersWithDob,
      customersWithPrescriptions,
    ] = await Promise.all([
      // 1. New orders in the last 24h
      this.prisma.order.findMany({
        where: {
          workspaceId,
          createdAt: { gte: twentyFourHoursAgo },
        },
        include: { customer: { select: { fullName: true } } },
      }),

      // 2. New prescriptions in last 24h
      this.prisma.prescription.findMany({
        where: {
          workspaceId,
          createdAt: { gte: twentyFourHoursAgo },
        },
        include: { customer: { select: { fullName: true } } },
      }),

      // 3. Orders ready for pickup/delivery in last 3 days
      this.prisma.order.findMany({
        where: {
          workspaceId,
          status: 'READY',
          updatedAt: { gte: seventyTwoHoursAgo },
        },
        include: { customer: { select: { fullName: true } } },
      }),

      // 4. Expected deliveries scheduled for today
      this.prisma.order.findMany({
        where: {
          workspaceId,
          expectedDeliveryDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
        include: { customer: { select: { fullName: true } } },
      }),

      // 5. Payment received in last 24 hours
      this.prisma.order.findMany({
        where: {
          workspaceId,
          paidAmount: { gt: 0 },
          updatedAt: { gte: twentyFourHoursAgo },
        },
        include: { customer: { select: { fullName: true } } },
      }),

      // 6. Pending or in-progress orders older than 3 days
      this.prisma.order.findMany({
        where: {
          workspaceId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          createdAt: { lt: threeDaysAgo },
        },
        include: { customer: { select: { fullName: true } } },
      }),

      // 7. Customers with birthday today
      this.prisma.customer.findMany({
        where: {
          workspaceId,
          dateOfBirth: { not: null },
        },
      }),

      // 8. Revisit reminder: Customers with prescriptions sorted by date
      this.prisma.customer.findMany({
        where: { workspaceId },
        include: {
          prescriptions: {
            orderBy: { prescriptionDate: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    // 2. Map results to NotificationAlerts

    // 1. New Orders
    newOrders.forEach((order) => {
      notifications.push({
        id: `new-order-${order.id}`,
        type: 'NEW_ORDER',
        title: '🆕 New order created',
        message: `Order ${order.orderNumber} created for ${order.customer.fullName} (Total: ₹${order.total}).`,
        createdAt: order.createdAt,
        severity: 'success',
      });
    });

    // 2. New Prescriptions
    newPrescriptions.forEach((presc) => {
      notifications.push({
        id: `new-presc-${presc.id}`,
        type: 'NEW_PRESCRIPTION',
        title: '👓 Prescription added',
        message: `Prescription added for customer ${presc.customer.fullName}${presc.doctorName ? ` by ${presc.doctorName}` : ''}.`,
        createdAt: presc.createdAt,
        severity: 'info',
      });
    });

    // 3. Ready Orders
    readyOrders.forEach((order) => {
      notifications.push({
        id: `ready-order-${order.id}`,
        type: 'ORDER_READY',
        title: '📦 Order ready for pickup',
        message: `Order ${order.orderNumber} for ${order.customer.fullName} is ready for delivery/pickup.`,
        createdAt: order.updatedAt,
        severity: 'success',
      });
    });

    // 4. Today's expected deliveries
    todayDeliveries.forEach((order) => {
      notifications.push({
        id: `delivery-today-${order.id}`,
        type: 'TODAY_APPOINTMENT',
        title: "📅 Today's expected delivery",
        message: `Order ${order.orderNumber} for ${order.customer.fullName} is scheduled for delivery today.`,
        createdAt: order.expectedDeliveryDate || now,
        severity: 'info',
      });
    });

    // 5. Payment received
    payments.forEach((order) => {
      notifications.push({
        id: `payment-received-${order.id}`,
        type: 'PAYMENT_RECEIVED',
        title: '💰 Payment received',
        message: `Payment of ₹${order.paidAmount} received for order ${order.orderNumber} (${order.customer.fullName}).`,
        createdAt: order.updatedAt,
        severity: 'success',
      });
    });

    // 6. Pending/In Progress orders older than 3 days
    pendingOrders.forEach((order) => {
      const days = Math.floor(
        (now.getTime() - order.createdAt.getTime()) / (24 * 60 * 60 * 1000),
      );
      notifications.push({
        id: `pending-old-${order.id}`,
        type: 'PENDING_ORDERS_OLD',
        title: '⏰ Order pending longer than expected',
        message: `Order ${order.orderNumber} for ${order.customer.fullName} has been pending for ${days} days.`,
        createdAt: order.createdAt,
        severity: 'warning',
      });
    });

    // 7. Birthday Customers
    customersWithDob.forEach((customer) => {
      if (customer.dateOfBirth) {
        const dob = new Date(customer.dateOfBirth);
        if (dob.getMonth() === todayMonth && dob.getDate() === todayDate) {
          notifications.push({
            id: `birthday-${customer.id}-${now.getFullYear()}`,
            type: 'CUSTOMER_BIRTHDAY',
            title: "🎂 Customer's birthday today",
            message: `It is ${customer.fullName}'s birthday today. Reach out to wish them or follow up!`,
            createdAt: now,
            severity: 'info',
          });
        }
      }
    });

    // 8. Revisit Reminder (no prescriptions in 6 months)
    customersWithPrescriptions.forEach((customer) => {
      // Check if they have a prescription and if the latest one is > 6 months ago
      if (customer.prescriptions.length > 0) {
        const latestPresc = customer.prescriptions[0];
        if (latestPresc.prescriptionDate < sixMonthsAgo) {
          notifications.push({
            id: `revisit-${customer.id}`,
            type: 'CUSTOMER_REVISIT',
            title: '🎂 Customer revisit reminder',
            message: `${customer.fullName} has not visited for a prescription since ${new Date(latestPresc.prescriptionDate).toLocaleDateString()}.`,
            createdAt: now,
            severity: 'warning',
          });
        }
      }
    });

    // 9. Static simulated inventory low stock
    notifications.push({
      id: `low-stock-rayoptic-${workspaceId}`,
      type: 'LOW_STOCK',
      title: '⚠️ Low stock warning',
      message:
        'Low stock: RayOptic RX-101 frame quantity is low (only 2 left).',
      createdAt: now,
      severity: 'warning',
    });

    // Sort by createdAt descending
    return notifications.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}
