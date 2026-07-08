import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CalendarEvent {
  id: string;
  sourceId: string;
  title: string;
  type: string;
  date: string; // ISO date YYYY-MM-DD
  time?: string; // HH:MM AM/PM
  status?: string;
  color: string;
  icon: string;
  details: {
    customerName?: string;
    customerPhone?: string;
    customerId?: string;
    orderId?: string;
    orderNumber?: string;
    amount?: number;
    notes?: string | null;
    [key: string]: any;
  };
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(
    workspaceId: string,
    startDateStr: string,
    endDateStr: string,
  ): Promise<CalendarEvent[]> {
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);

    const events: CalendarEvent[] = [];

    // 1. Appointments
    const appointments = await this.prisma.appointment.findMany({
      where: {
        workspaceId,
        scheduledAt: { gte: start, lte: end },
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });

    for (const appt of appointments) {
      let icon = 'calendar';
      let color = '#06b6d4'; // default blue/teal

      if (appt.type === 'Examination') {
        icon = 'eye-outline';
        color = '#3b82f6'; // Blue
      } else if (appt.type === 'Follow-up') {
        icon = 'repeat-outline';
        color = '#a855f7'; // Purple
      } else if (appt.type === 'Contact Lens Trial') {
        icon = 'ellipse-outline';
        color = '#f97316'; // Orange
      } else if (appt.type === 'Collection') {
        icon = 'glasses-outline';
        color = '#10b981'; // Green
      } else if (appt.type === 'Walk-in') {
        icon = 'walk-outline';
        color = '#6366f1'; // Indigo
      }

      if (appt.status === 'CANCELLED') {
        color = '#ef4444'; // Red
      } else if (appt.status === 'COMPLETED') {
        color = '#71717a'; // Gray
      }

      events.push({
        id: `appointment-${appt.id}`,
        sourceId: appt.id,
        title: `${appt.type} - ${appt.customer.fullName}${appt.doctorName ? ` (Dr. ${appt.doctorName})` : ''}`,
        type: 'APPOINTMENT',
        date: appt.scheduledAt.toISOString().split('T')[0],
        time: this.formatTime(appt.scheduledAt),
        status: appt.status,
        color,
        icon,
        details: {
          customerId: appt.customerId,
          customerName: appt.customer.fullName,
          customerPhone: appt.customer.phone,
          doctorName: appt.doctorName,
          notes: appt.notes,
        },
      });
    }

    // 2. Deliveries (expectedDeliveryDate in range, status PENDING / IN_PROGRESS / READY)
    const deliveries = await this.prisma.order.findMany({
      where: {
        workspaceId,
        expectedDeliveryDate: { gte: start, lte: end },
        status: { in: ['PENDING', 'IN_PROGRESS', 'READY'] },
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });

    for (const order of deliveries) {
      const isReady = order.status === 'READY';
      events.push({
        id: `delivery-${order.id}`,
        sourceId: order.id,
        title: isReady
          ? `Order Pickup - ${order.customer.fullName} (${order.orderNumber})`
          : `Glasses Delivery - ${order.customer.fullName} (${order.orderNumber})`,
        type: isReady ? 'PICKUP' : 'DELIVERY',
        date: order.expectedDeliveryDate!.toISOString().split('T')[0],
        status: order.status,
        color: isReady ? '#06b6d4' : '#22c55e', // Cyan vs Green
        icon: isReady ? 'cube-outline' : 'glasses-outline',
        details: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName: order.customer.fullName,
          customerPhone: order.customer.phone,
          notes: order.notes,
        },
      });
    }

    // 3. Payments Due (paymentDueDate in range, balanceAmount > 0)
    const unpaidOrders = await this.prisma.order.findMany({
      where: {
        workspaceId,
        paymentDueDate: { gte: start, lte: end },
        balanceAmount: { gt: 0 },
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });

    for (const order of unpaidOrders) {
      events.push({
        id: `payment-${order.id}`,
        sourceId: order.id,
        title: `Payment Due: ₹${order.balanceAmount} - ${order.customer.fullName}`,
        type: 'PAYMENT',
        date: order.paymentDueDate!.toISOString().split('T')[0],
        color: '#ef4444', // Red
        icon: 'cash-outline',
        status: order.paymentStatus,
        details: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName: order.customer.fullName,
          customerPhone: order.customer.phone,
          amount: order.balanceAmount,
        },
      });
    }

    // 4. Prescription Expiry: Expiring in range. Expiry = prescriptionDate + 12 months.
    // So reminder is 30 days before that, i.e., 11 months after prescriptionDate.
    // Query prescriptions where prescriptionDate is between (start - 11 months) and (end - 11 months)
    const pStart = new Date(start);
    pStart.setMonth(pStart.getMonth() - 11);
    const pEnd = new Date(end);
    pEnd.setMonth(pEnd.getMonth() - 11);

    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        workspaceId,
        prescriptionDate: { gte: pStart, lte: pEnd },
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });

    for (const rx of prescriptions) {
      // Calculate Expiry Date = Rx Date + 12 Months
      const expiryDate = new Date(rx.prescriptionDate);
      expiryDate.setMonth(expiryDate.getMonth() + 12);

      // Reminder date = Expiry Date - 30 Days
      const reminderDate = new Date(expiryDate);
      reminderDate.setDate(reminderDate.getDate() - 30);

      // Verify reminderDate falls within queried range
      if (reminderDate >= start && reminderDate <= end) {
        events.push({
          id: `rx-expiry-${rx.id}`,
          sourceId: rx.id,
          title: `Prescription Expiry (30d) - ${rx.customer.fullName}`,
          type: 'FOLLOW_UP', // Type follow up
          date: reminderDate.toISOString().split('T')[0],
          color: '#f97316', // Orange
          icon: 'document-text-outline',
          details: {
            customerId: rx.customerId,
            customerName: rx.customer.fullName,
            customerPhone: rx.customer.phone,
            notes: `Rx Date: ${rx.prescriptionDate.toLocaleDateString('en-IN')}, Expires on: ${expiryDate.toLocaleDateString('en-IN')}`,
          },
        });
      }
    }

    // 5. Warranty Expiry (warrantyExpiresAt in range)
    const warranties = await this.prisma.order.findMany({
      where: {
        workspaceId,
        warrantyExpiresAt: { gte: start, lte: end },
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });

    for (const order of warranties) {
      events.push({
        id: `warranty-${order.id}`,
        sourceId: order.id,
        title: `Warranty Expiry - ${order.customer.fullName} (${order.orderNumber})`,
        type: 'WARRANTY',
        date: order.warrantyExpiresAt!.toISOString().split('T')[0],
        color: '#78350f', // Brown
        icon: 'shield-checkmark-outline',
        details: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName: order.customer.fullName,
          customerPhone: order.customer.phone,
          notes: `Frames: ${order.frameName || 'N/A'}, Coating: ${order.lensCoating || 'N/A'}`,
        },
      });
    }

    // 6. Customer Birthdays
    // Query customers with birthdays in range
    const customers = await this.prisma.customer.findMany({
      where: {
        workspaceId,
        dateOfBirth: { not: null },
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        dateOfBirth: true,
      },
    });

    for (const cust of customers) {
      const dob = cust.dateOfBirth!;
      // Find matching dates in range
      const checkDate = new Date(start);
      while (checkDate <= end) {
        if (
          checkDate.getMonth() === dob.getMonth() &&
          checkDate.getDate() === dob.getDate()
        ) {
          events.push({
            id: `birthday-${cust.id}-${checkDate.toISOString().split('T')[0]}`,
            sourceId: cust.id,
            title: `🎂 Birthday - ${cust.fullName}`,
            type: 'BIRTHDAY',
            date: checkDate.toISOString().split('T')[0],
            color: '#ec4899', // Pink
            icon: 'gift-outline',
            details: {
              customerId: cust.id,
              customerName: cust.fullName,
              customerPhone: cust.phone,
            },
          });
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }
    }

    // 7. Supplier Delivery Dates / Stock Arrivals (PurchaseOrder.expectedDeliveryDate in range)
    const stockArrivals = await this.prisma.purchaseOrder.findMany({
      where: {
        workspaceId,
        expectedDeliveryDate: { gte: start, lte: end },
        status: 'PENDING',
      },
      include: {
        supplier: true,
      },
    });

    for (const po of stockArrivals) {
      events.push({
        id: `po-${po.id}`,
        sourceId: po.id,
        title: `Stock Arrival: ${po.supplier.name} (PO)`,
        type: 'STOCK_ARRIVAL',
        date: po.expectedDeliveryDate!.toISOString().split('T')[0],
        color: '#854d0e', // Dark Yellow/Brown
        icon: 'download-outline',
        status: po.status,
        details: {
          notes: `Supplier: ${po.supplier.name}, Total amount: ₹${po.totalAmount}`,
        },
      });
    }

    // 8. Staff Schedule (leave, shifts, holidays)
    const schedules = await this.prisma.staffSchedule.findMany({
      where: {
        workspaceId,
        date: { gte: start, lte: end },
      },
      include: {
        user: { select: { fullName: true } },
      },
    });

    for (const sched of schedules) {
      let color = '#6b7280'; // Gray
      let icon = 'calendar-outline';
      let type = 'STAFF';

      if (sched.type === 'LEAVE') {
        color = '#71717a';
        icon = 'person-remove-outline';
      } else if (sched.type === 'SHIFT') {
        color = '#0891b2'; // Cyan/Teal
        icon = 'alarm-outline';
      } else if (sched.type === 'HOLIDAY') {
        color = '#eab308'; // Yellow
        icon = 'sparkles-outline';
        type = 'HOLIDAY';
      }

      events.push({
        id: `staff-schedule-${sched.id}`,
        sourceId: sched.id,
        title:
          sched.type === 'HOLIDAY'
            ? `Holiday: ${sched.notes || 'Clinic Closed'}`
            : `${sched.type === 'LEAVE' ? 'Leave' : 'Shift'}: ${sched.user.fullName}`,
        type,
        date: sched.date.toISOString().split('T')[0],
        color,
        icon,
        details: {
          notes: sched.notes,
        },
      });
    }

    // 9. Personal reminders
    const reminders = await this.prisma.calendarReminder.findMany({
      where: {
        workspaceId,
        date: { gte: start, lte: end },
      },
    });

    for (const rem of reminders) {
      events.push({
        id: `reminder-${rem.id}`,
        sourceId: rem.id,
        title: rem.title,
        type: 'PERSONAL_NOTE',
        date: rem.date.toISOString().split('T')[0],
        time: rem.time || undefined,
        color: '#4f46e5', // Indigo
        icon: 'document-text-outline',
        details: {
          notes: rem.notes,
        },
      });
    }

    // 10. Patient Visits
    const visits = await this.prisma.visit.findMany({
      where: {
        workspaceId,
        date: { gte: start, lte: end },
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });

    for (const visit of visits) {
      events.push({
        id: `visit-${visit.id}`,
        sourceId: visit.id,
        title: `Visit: ${visit.customer.fullName} (${visit.type})`,
        type: 'VISIT',
        date: visit.date.toISOString().split('T')[0],
        time: this.formatTime(visit.date),
        color: '#14b8a6', // Teal
        icon: 'medical-outline',
        details: {
          customerId: visit.customerId,
          customerName: visit.customer.fullName,
          customerPhone: visit.customer.phone,
          doctorName: visit.doctorName,
          notes: visit.notes,
        },
      });
    }

    return events.sort((a, b) => {
      // Sort by date then by time
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return a.id.localeCompare(b.id);
    });
  }

  async getSummary(workspaceId: string, dateStr: string) {
    const day = new Date(dateStr);
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);

    // 1. Appointments
    const appointmentsCount = await this.prisma.appointment.count({
      where: { workspaceId, scheduledAt: { gte: start, lte: end } },
    });

    // 2. Orders Ready (status = READY)
    const ordersReadyCount = await this.prisma.order.count({
      where: { workspaceId, status: 'READY' },
    });

    // 3. Pending Deliveries (expectedDeliveryDate is today, status IN_PROGRESS or PENDING)
    const pendingDeliveriesCount = await this.prisma.order.count({
      where: {
        workspaceId,
        expectedDeliveryDate: { gte: start, lte: end },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    // 4. Payments Due sum for today
    const paymentsDueResult = await this.prisma.order.aggregate({
      where: {
        workspaceId,
        paymentDueDate: { gte: start, lte: end },
        balanceAmount: { gt: 0 },
      },
      _sum: {
        balanceAmount: true,
      },
    });
    const paymentsDue = paymentsDueResult._sum.balanceAmount ?? 0;

    // 5. Birthdays today
    const allCustomers = await this.prisma.customer.findMany({
      where: { workspaceId, dateOfBirth: { not: null } },
      select: { dateOfBirth: true },
    });
    const birthdaysCount = allCustomers.filter((c) => {
      const dob = c.dateOfBirth!;
      return (
        dob.getDate() === day.getDate() && dob.getMonth() === day.getMonth()
      );
    }).length;

    // 6. Low stock products (quantity < 5)
    const lowStockCount = await this.prisma.product.count({
      where: { workspaceId, quantity: { lt: 5 } },
    });

    // 7. Pending supplier orders (PO.status = PENDING)
    const pendingSupplierOrdersCount = await this.prisma.purchaseOrder.count({
      where: { workspaceId, status: 'PENDING' },
    });

    // 8. Follow ups today
    const followUpsCount = await this.prisma.appointment.count({
      where: {
        workspaceId,
        scheduledAt: { gte: start, lte: end },
        type: 'Follow-up',
      },
    });

    // 9. Visits today
    const visitsCount = await this.prisma.visit.count({
      where: { workspaceId, date: { gte: start, lte: end } },
    });

    return {
      appointments: appointmentsCount,
      ordersReady: ordersReadyCount,
      pendingDeliveries: pendingDeliveriesCount,
      paymentsDue,
      birthdays: birthdaysCount,
      lowStock: lowStockCount,
      pendingOrders: pendingSupplierOrdersCount,
      followUps: followUpsCount,
      visits: visitsCount,
    };
  }

  // Reminder CRUD
  async createReminder(
    workspaceId: string,
    title: string,
    notes: string | null,
    dateStr: string,
    timeStr: string | null,
  ) {
    return this.prisma.calendarReminder.create({
      data: {
        title,
        notes,
        date: new Date(dateStr),
        time: timeStr,
        workspaceId,
      },
    });
  }

  async getReminders(workspaceId: string) {
    return this.prisma.calendarReminder.findMany({
      where: { workspaceId },
      orderBy: { date: 'asc' },
    });
  }

  async deleteReminder(id: string, workspaceId: string) {
    const reminder = await this.prisma.calendarReminder.findFirst({
      where: { id, workspaceId },
    });
    if (!reminder) {
      throw new NotFoundException(`Reminder "${id}" not found`);
    }
    await this.prisma.calendarReminder.delete({ where: { id } });
    return { success: true };
  }

  // Staff Schedule CRUD
  async createStaffSchedule(
    workspaceId: string,
    userId: string,
    dateStr: string,
    type: string,
    notes: string | null,
  ) {
    return this.prisma.staffSchedule.create({
      data: {
        userId,
        date: new Date(dateStr),
        type,
        notes,
        workspaceId,
      },
    });
  }

  async getStaffSchedules(workspaceId: string) {
    return this.prisma.staffSchedule.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { date: 'asc' },
    });
  }

  async deleteStaffSchedule(id: string, workspaceId: string) {
    const schedule = await this.prisma.staffSchedule.findFirst({
      where: { id, workspaceId },
    });
    if (!schedule) {
      throw new NotFoundException(`Staff schedule "${id}" not found`);
    }
    await this.prisma.staffSchedule.delete({ where: { id } });
    return { success: true };
  }

  async getWorkspaceUsers(workspaceId: string) {
    return this.prisma.user.findMany({
      where: { workspaceId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
    });
  }

  private formatTime(date: Date): string {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  }
}
