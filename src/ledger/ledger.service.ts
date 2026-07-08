import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ListLedgerDto } from './dto/list-ledger.dto';
import { LedgerTransactionType } from '@prisma/client';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lazily fetches or creates a ledger for a customer.
   */
  async getOrCreateLedger(
    customerId: string,
    workspaceId: string,
    prismaClient: any = this.prisma,
  ) {
    let ledger = await prismaClient.ledger.findFirst({
      where: { customerId, workspaceId },
    });

    if (!ledger) {
      ledger = await prismaClient.ledger.create({
        data: {
          customerId,
          workspaceId,
          currentBalance: 0,
        },
      });
    }

    return ledger;
  }

  /**
   * List all customer ledgers in the workspace with summaries and search/filters.
   */
  async findAllLedgers(workspaceId: string, query: ListLedgerDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build the query filter
    const where: any = { workspaceId };

    if (query.search) {
      const q = query.search.trim();
      where.customer = {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      };
    }

    if (query.filter === 'outstanding') {
      where.currentBalance = { gt: 0 };
    } else if (query.filter === 'paid') {
      where.currentBalance = { lte: 0 };
    }

    const [ledgers, total] = await Promise.all([
      this.prisma.ledger.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              orders: {
                select: {
                  id: true,
                  total: true,
                  createdAt: true,
                },
              },
            },
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { currentBalance: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ledger.count({ where }),
    ]);

    // Map database structures to convenient UI summary objects
    const data = ledgers.map((l) => {
      const totalOrders = l.customer.orders.length;

      // Calculate total purchases (invoices) and total paid (payments)
      let totalPurchase = 0;
      let totalPaid = 0;
      let lastPaymentDate: Date | null = null;

      l.transactions.forEach((tx) => {
        totalPurchase += tx.debit;
        totalPaid += tx.credit;
        if (
          tx.credit > 0 &&
          (!lastPaymentDate || tx.createdAt > lastPaymentDate)
        ) {
          lastPaymentDate = tx.createdAt;
        }
      });

      return {
        id: l.id,
        customerId: l.customerId,
        customerName: l.customer.fullName,
        phone: l.customer.phone,
        email: l.customer.email,
        totalOrders,
        totalPurchase,
        totalPaid,
        totalDue: l.currentBalance,
        currentBalance: l.currentBalance,
        lastPaymentDate,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Fetch customer ledger details, including analytics and complete list of transactions.
   */
  async findOneCustomerLedger(customerId: string, workspaceId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, workspaceId },
      include: {
        orders: {
          select: {
            id: true,
            total: true,
            createdAt: true,
            orderNumber: true,
            paymentStatus: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID "${customerId}" not found`);
    }

    const ledger = await this.getOrCreateLedger(customerId, workspaceId);

    const transactions = await this.prisma.ledgerTransaction.findMany({
      where: { ledgerId: ledger.id },
      orderBy: { createdAt: 'asc' }, // Timeline in chronological order
    });

    // Compute detailed ledger analytics
    let totalPurchase = 0;
    let totalPaid = 0;
    let lastPaymentDate: Date | null = null;
    let lastPurchaseDate: Date | null = null;

    transactions.forEach((tx) => {
      totalPurchase += tx.debit;
      totalPaid += tx.credit;

      if (tx.credit > 0) {
        if (!lastPaymentDate || tx.createdAt > lastPaymentDate) {
          lastPaymentDate = tx.createdAt;
        }
      }
      if (tx.type === 'INVOICE_CREATED' || tx.debit > 0) {
        if (!lastPurchaseDate || tx.createdAt > lastPurchaseDate) {
          lastPurchaseDate = tx.createdAt;
        }
      }
    });

    const averagePurchase =
      customer.orders.length > 0
        ? customer.orders.reduce((sum, o) => sum + o.total, 0) /
          customer.orders.length
        : 0;

    const pendingBillsCount = customer.orders.filter(
      (o) => o.paymentStatus !== 'PAID',
    ).length;

    return {
      summary: {
        customerId,
        customerName: customer.fullName,
        phone: customer.phone,
        totalOrders: customer.orders.length,
        totalPurchase,
        totalPaid,
        totalDue: ledger.currentBalance,
        currentOutstandingBalance: ledger.currentBalance,
        lastPaymentDate,
        lastPurchaseDate,
        averagePurchase,
        pendingBills: pendingBillsCount,
      },
      transactions: transactions.reverse(), // Return reverse chronological for timeline views
    };
  }

  /**
   * Add a manual payment transaction (Credit).
   */
  async addPayment(workspaceId: string, dto: CreatePaymentDto) {
    return this.prisma.$transaction(async (txClient) => {
      const ledger = await this.getOrCreateLedger(
        dto.customerId,
        workspaceId,
        txClient,
      );

      const tx = await txClient.ledgerTransaction.create({
        data: {
          ledgerId: ledger.id,
          type: dto.type,
          amount: dto.amount,
          debit: 0,
          credit: dto.amount,
          balance: 0, // Set by recalculate
          notes: dto.notes,
          referenceId: dto.referenceId,
        },
      });

      await this.recalculateRunningBalances(ledger.id, txClient);

      return txClient.ledgerTransaction.findUnique({
        where: { id: tx.id },
      });
    });
  }

  /**
   * Add a manual adjustment transaction (Debit or Credit).
   */
  async addAdjustment(workspaceId: string, dto: CreateAdjustmentDto) {
    return this.prisma.$transaction(async (txClient) => {
      const ledger = await this.getOrCreateLedger(
        dto.customerId,
        workspaceId,
        txClient,
      );

      // Determine Debit vs Credit based on transaction type
      // Debit (money customer owes us): REFUND, OPENING_BALANCE, EXCHANGE (if positive debit)
      // Credit (reduction of customer due): DISCOUNT, ADJUSTMENT, RETURN
      const isDebit = ['REFUND', 'OPENING_BALANCE', 'EXCHANGE'].includes(
        dto.type,
      );
      const debit = isDebit ? dto.amount : 0;
      const credit = isDebit ? 0 : dto.amount;

      const tx = await txClient.ledgerTransaction.create({
        data: {
          ledgerId: ledger.id,
          type: dto.type,
          amount: dto.amount,
          debit,
          credit,
          balance: 0, // Set by recalculate
          notes: dto.notes,
          referenceId: dto.referenceId,
        },
      });

      await this.recalculateRunningBalances(ledger.id, txClient);

      return txClient.ledgerTransaction.findUnique({
        where: { id: tx.id },
      });
    });
  }

  /**
   * Update transaction notes.
   */
  async updateTransaction(
    transactionId: string,
    workspaceId: string,
    dto: UpdateTransactionDto,
  ) {
    const tx = await this.prisma.ledgerTransaction.findUnique({
      where: { id: transactionId },
      include: { ledger: true },
    });

    if (!tx || tx.ledger.workspaceId !== workspaceId) {
      throw new NotFoundException(
        `Transaction with ID "${transactionId}" not found`,
      );
    }

    return this.prisma.ledgerTransaction.update({
      where: { id: transactionId },
      data: { notes: dto.notes },
    });
  }

  /**
   * Delete manual ledger transaction and recalculate balances.
   */
  async deleteTransaction(transactionId: string, workspaceId: string) {
    return this.prisma.$transaction(async (txClient) => {
      const tx = await txClient.ledgerTransaction.findUnique({
        where: { id: transactionId },
        include: { ledger: true },
      });

      if (!tx || tx.ledger.workspaceId !== workspaceId) {
        throw new NotFoundException(
          `Transaction with ID "${transactionId}" not found`,
        );
      }

      // Auto-created invoice/payments linked to actual orders should not be deleted manually
      // through ledger to prevent discrepancies. They must be managed via the Order.
      if (tx.type === 'INVOICE_CREATED' && tx.referenceId) {
        throw new BadRequestException(
          'Cannot delete invoice transactions directly. Delete or modify the Order instead.',
        );
      }

      await txClient.ledgerTransaction.delete({
        where: { id: transactionId },
      });

      await this.recalculateRunningBalances(tx.ledgerId, txClient);

      return { success: true };
    });
  }

  /**
   * Recalculates all running balances for a ledger and updates current balance.
   */
  async recalculateRunningBalances(
    ledgerId: string,
    prismaClient: any = this.prisma,
  ) {
    const run = async (tx: any) => {
      const transactions = await tx.ledgerTransaction.findMany({
        where: { ledgerId },
        orderBy: { createdAt: 'asc' },
      });

      let runningBalance = 0;
      for (const t of transactions) {
        runningBalance = runningBalance + t.debit - t.credit;
        await tx.ledgerTransaction.update({
          where: { id: t.id },
          data: { balance: runningBalance },
        });
      }

      await tx.ledger.update({
        where: { id: ledgerId },
        data: { currentBalance: runningBalance },
      });
    };

    if (prismaClient !== this.prisma) {
      await run(prismaClient);
    } else {
      await this.prisma.$transaction(async (tx) => {
        await run(tx);
      });
    }
  }

  /**
   * Generate outstanding/collection report and customer aging analysis.
   */
  async getLedgerReport(workspaceId: string) {
    const ledgers = await this.prisma.ledger.findMany({
      where: { workspaceId, currentBalance: { gt: 0 } },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        transactions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const now = new Date();
    const aging = {
      days0_30: 0,
      days31_60: 0,
      days61_90: 0,
      days91_plus: 0,
    };

    const overdueCustomers: any[] = [];

    ledgers.forEach((l) => {
      // Find oldest transaction with pending balance
      // We look at invoice creations that are not fully paid
      const invoices = l.transactions.filter((t) => t.debit > 0);
      const oldestInvoice = invoices[0] || l.transactions[0];

      if (oldestInvoice) {
        const diffTime = Math.abs(
          now.getTime() - oldestInvoice.createdAt.getTime(),
        );
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) {
          aging.days0_30 += l.currentBalance;
        } else if (diffDays <= 60) {
          aging.days31_60 += l.currentBalance;
        } else if (diffDays <= 90) {
          aging.days61_90 += l.currentBalance;
        } else {
          aging.days91_plus += l.currentBalance;
        }

        if (diffDays > 30) {
          overdueCustomers.push({
            customerId: l.customerId,
            customerName: l.customer.fullName,
            phone: l.customer.phone,
            outstandingAmount: l.currentBalance,
            daysOverdue: diffDays,
          });
        }
      }
    });

    // Collection stats for Today vs Monthly
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [todayCollections, monthCollections] = await Promise.all([
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
    ]);

    const totalOutstanding = ledgers.reduce(
      (sum, l) => sum + l.currentBalance,
      0,
    );

    return {
      summary: {
        totalOutstanding,
        todayCollections: todayCollections._sum.credit ?? 0,
        monthCollections: monthCollections._sum.credit ?? 0,
        outstandingCustomersCount: ledgers.length,
      },
      aging,
      overdueCustomers: overdueCustomers.sort(
        (a, b) => b.daysOverdue - a.daysOverdue,
      ),
    };
  }
}
