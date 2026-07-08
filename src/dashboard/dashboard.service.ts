import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(workspaceId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalCustomers,
      activeOrders,
      completedOrders,
      todaysOrders,
      recentCustomers,
      recentOrders,
      ordersFinancials,
      expensesFinancials,
      ledgerStats,
      topDebtors,
      todaysCollections,
      monthlyCollections,
      overdueCount,
      pendingPaymentsCount,
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
      // Ledger aggregations
      this.prisma.ledger.aggregate({
        where: { workspaceId },
        _sum: { currentBalance: true },
      }),
      this.prisma.ledger.findMany({
        where: { workspaceId, currentBalance: { gt: 0 } },
        orderBy: { currentBalance: 'desc' },
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
      this.prisma.ledgerTransaction.aggregate({
        where: {
          ledger: { workspaceId },
          credit: { gt: 0 },
          createdAt: { gte: startOfToday },
        },
        _sum: { credit: true },
      }),
      this.prisma.ledgerTransaction.aggregate({
        where: {
          ledger: { workspaceId },
          credit: { gt: 0 },
          createdAt: { gte: startOfMonth },
        },
        _sum: { credit: true },
      }),
      this.prisma.ledger.count({
        where: {
          workspaceId,
          currentBalance: { gt: 0 },
          transactions: {
            some: {
              debit: { gt: 0 },
              createdAt: { lt: thirtyDaysAgo },
            },
          },
        },
      }),
      this.prisma.ledger.count({
        where: {
          workspaceId,
          currentBalance: { gt: 0 },
        },
      }),
    ]);

    const totalRevenue = ordersFinancials._sum.paidAmount ?? 0;
    const totalExpenses = expensesFinancials._sum.amount ?? 0;
    const netProfit = totalRevenue - totalExpenses;

    const totalOutstanding = ledgerStats._sum.currentBalance ?? 0;
    const todayCollections = todaysCollections._sum.credit ?? 0;
    const monthCollections = monthlyCollections._sum.credit ?? 0;

    return {
      stats: {
        totalCustomers,
        activeOrders,
        completedOrders,
        todaysOrders,
        totalRevenue,
        totalExpenses,
        netProfit,
        // Ledger metrics
        totalOutstanding,
        todayCollections,
        monthCollections,
        overdueCustomers: overdueCount,
        pendingPayments: pendingPaymentsCount,
      },
      recentCustomers,
      recentOrders,
      topDebtors: topDebtors.map((td) => ({
        id: td.id,
        customerId: td.customerId,
        customerName: td.customer.fullName,
        phone: td.customer.phone,
        outstandingAmount: td.currentBalance,
      })),
    };
  }
}
