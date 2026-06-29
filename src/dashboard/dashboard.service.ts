import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(workspaceId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalCustomers,
      activeOrders,
      completedOrders,
      todaysOrders,
      recentCustomers,
      recentOrders,
      ordersFinancials,
      expensesFinancials,
    ] = await Promise.all([
      this.prisma.customer.count({
        where: { workspaceId },
      }),
      this.prisma.order.count({
        where: {
          workspaceId,
          status: {
            in: ['PENDING', 'IN_PROGRESS', 'READY'],
          },
        },
      }),
      this.prisma.order.count({
        where: {
          workspaceId,
          status: 'DELIVERED',
        },
      }),
      this.prisma.order.count({
        where: {
          workspaceId,
          createdAt: {
            gte: startOfToday,
          },
        },
      }),
      this.prisma.customer.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.order.findMany({
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
      }),
      this.prisma.order.aggregate({
        where: { workspaceId },
        _sum: { paidAmount: true },
      }),
      this.prisma.expense.aggregate({
        where: { workspaceId },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = ordersFinancials._sum.paidAmount ?? 0;
    const totalExpenses = expensesFinancials._sum.amount ?? 0;
    const netProfit = totalRevenue - totalExpenses;

    return {
      stats: {
        totalCustomers,
        activeOrders,
        completedOrders,
        todaysOrders,
        totalRevenue,
        totalExpenses,
        netProfit,
      },
      recentCustomers,
      recentOrders,
    };
  }
}
