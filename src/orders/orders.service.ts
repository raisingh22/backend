import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async create(workspaceId: string, dto: CreateOrderDto) {
    await this.ensureCustomerBelongsToWorkspace(dto.customerId, workspaceId);
    if (dto.prescriptionId) {
      await this.ensurePrescriptionBelongsToCustomer(dto.prescriptionId, dto.customerId, workspaceId);
    }

    const subtotal = dto.subtotal ?? 0;
    const discount = dto.discount ?? 0;
    const tax = dto.tax ?? 0;
    const total = dto.total ?? subtotal - discount + tax;
    const paidAmount = dto.paidAmount ?? 0;

    const order = await this.prisma.order.create({
      data: {
        orderNumber: await this.generateOrderNumber(),
        customerId: dto.customerId,
        prescriptionId: dto.prescriptionId,
        frameName: dto.frameName,
        frameBrand: dto.frameBrand,
        frameModel: dto.frameModel,
        lensType: dto.lensType,
        lensCoating: dto.lensCoating,
        quantity: dto.quantity ?? 1,
        subtotal,
        discount,
        tax,
        total,
        paidAmount,
        balanceAmount: Math.max(total - paidAmount, 0),
        status: dto.status ?? 'PENDING',
        paymentStatus: dto.paymentStatus ?? this.resolvePaymentStatus(total, paidAmount),
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined,
        notes: dto.notes,
        workspaceId,
      },
      include: this.defaultInclude(),
    });

    if (paidAmount > 0) {
      const addedPoints = Math.floor(paidAmount / 100);
      if (addedPoints > 0) {
        await this.prisma.customer.update({
          where: { id: dto.customerId },
          data: { loyaltyPoints: { increment: addedPoints } },
        });
        await this.updateMembershipTier(dto.customerId);
      }
    }

    // Ledger Automation: Create Ledger entries for the Order Invoice and Payment
    try {
      const ledger = await this.ledgerService.getOrCreateLedger(order.customerId, workspaceId);
      
      // 1. Create Invoice debit entry
      await this.prisma.ledgerTransaction.create({
        data: {
          ledgerId: ledger.id,
          type: 'INVOICE_CREATED',
          referenceId: order.id,
          amount: total,
          debit: total,
          credit: 0,
          balance: 0,
          notes: `Invoice created automatically for Order ${order.orderNumber}`,
        },
      });

      // 2. Create Payment credit entry if paidAmount > 0
      if (paidAmount > 0) {
        await this.prisma.ledgerTransaction.create({
          data: {
            ledgerId: ledger.id,
            type: total === paidAmount ? 'FULL_PAYMENT' : 'ADVANCE_PAYMENT',
            referenceId: order.id,
            amount: paidAmount,
            debit: 0,
            credit: paidAmount,
            balance: 0,
            notes: `Auto payment recorded for Order ${order.orderNumber}`,
          },
        });
      }

      await this.ledgerService.recalculateRunningBalances(ledger.id);
    } catch (err) {
      console.error('Failed to automate ledger entry on order creation:', err);
    }

    return order;
  }

  async findAll(workspaceId: string) {
    return this.prisma.order.findMany({
      where: { workspaceId },
      include: this.defaultInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllForCustomer(customerId: string, workspaceId: string) {
    await this.ensureCustomerBelongsToWorkspace(customerId, workspaceId);

    return this.prisma.order.findMany({
      where: { customerId, workspaceId },
      include: this.defaultInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, workspaceId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, workspaceId },
      include: this.defaultInclude(),
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }

    return order;
  }

  async update(id: string, workspaceId: string, dto: UpdateOrderDto) {
    const existingOrder = await this.findOne(id, workspaceId);
    if (dto.prescriptionId) {
      await this.ensurePrescriptionBelongsToCustomer(
        dto.prescriptionId,
        existingOrder.customerId,
        workspaceId,
      );
    }

    const subtotal = dto.subtotal ?? existingOrder.subtotal;
    const discount = dto.discount ?? existingOrder.discount;
    const tax = dto.tax ?? existingOrder.tax;
    const total = dto.total ?? subtotal - discount + tax;
    const paidAmount = dto.paidAmount ?? existingOrder.paidAmount;
    const difference = paidAmount - existingOrder.paidAmount;

    const order = await this.prisma.order.update({
      where: { id },
      data: {
        prescriptionId: dto.prescriptionId,
        frameName: dto.frameName,
        frameBrand: dto.frameBrand,
        frameModel: dto.frameModel,
        lensType: dto.lensType,
        lensCoating: dto.lensCoating,
        quantity: dto.quantity,
        subtotal: dto.subtotal,
        discount: dto.discount,
        tax: dto.tax,
        total,
        paidAmount,
        balanceAmount: Math.max(total - paidAmount, 0),
        status: dto.status,
        paymentStatus: dto.paymentStatus ?? this.resolvePaymentStatus(total, paidAmount),
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined,
        notes: dto.notes,
      },
      include: this.defaultInclude(),
    });

    if (difference > 0) {
      const addedPoints = Math.floor(difference / 100);
      if (addedPoints > 0) {
        await this.prisma.customer.update({
          where: { id: order.customerId },
          data: { loyaltyPoints: { increment: addedPoints } },
        });
        await this.updateMembershipTier(order.customerId);
      }
    }

    // Ledger Automation: Recalculate Ledger entries for the updated Order
    try {
      const ledger = await this.ledgerService.getOrCreateLedger(order.customerId, workspaceId);
      
      // Delete existing auto-created ledger transactions for this order
      await this.prisma.ledgerTransaction.deleteMany({
        where: {
          ledgerId: ledger.id,
          referenceId: order.id,
        },
      });

      // Re-create invoice debit entry
      await this.prisma.ledgerTransaction.create({
        data: {
          ledgerId: ledger.id,
          type: 'INVOICE_CREATED',
          referenceId: order.id,
          amount: order.total,
          debit: order.total,
          credit: 0,
          balance: 0,
          notes: `Invoice updated automatically for Order ${order.orderNumber}`,
        },
      });

      // Re-create payment credit entry if paidAmount > 0
      if (order.paidAmount > 0) {
        await this.prisma.ledgerTransaction.create({
          data: {
            ledgerId: ledger.id,
            type: order.total === order.paidAmount ? 'FULL_PAYMENT' : 'PARTIAL_PAYMENT',
            referenceId: order.id,
            amount: order.paidAmount,
            debit: 0,
            credit: order.paidAmount,
            balance: 0,
            notes: `Auto payment recorded/updated for Order ${order.orderNumber}`,
          },
        });
      }

      await this.ledgerService.recalculateRunningBalances(ledger.id);
    } catch (err) {
      console.error('Failed to update automated ledger entries on order update:', err);
    }

    return order;
  }

  async remove(id: string, workspaceId: string) {
    const order = await this.findOne(id, workspaceId);

    // Ledger Automation: Remove associated ledger entries and recalculate
    try {
      const ledger = await this.ledgerService.getOrCreateLedger(order.customerId, workspaceId);
      
      await this.prisma.ledgerTransaction.deleteMany({
        where: {
          ledgerId: ledger.id,
          referenceId: order.id,
        },
      });

      await this.prisma.order.delete({
        where: { id },
      });

      await this.ledgerService.recalculateRunningBalances(ledger.id);
      return { success: true };
    } catch (err) {
      console.error('Failed to clean up ledger entries on order removal:', err);
      // Fallback: make sure to delete order anyway
      await this.prisma.order.delete({
        where: { id },
      });
      return { success: true };
    }
  }

  private async ensureCustomerBelongsToWorkspace(customerId: string, workspaceId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, workspaceId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID "${customerId}" not found`);
    }
  }

  private async ensurePrescriptionBelongsToCustomer(
    prescriptionId: string,
    customerId: string,
    workspaceId: string,
  ) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, customerId, workspaceId },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID "${prescriptionId}" not found`);
    }
  }

  private async generateOrderNumber() {
    const count = await this.prisma.order.count();
    return `ORD-${String(count + 1).padStart(6, '0')}`;
  }

  private resolvePaymentStatus(total: number, paidAmount: number) {
    if (paidAmount <= 0) {
      return 'UNPAID';
    }

    if (paidAmount >= total) {
      return 'PAID';
    }

    return 'PARTIALLY_PAID';
  }

  private defaultInclude() {
    return {
      customer: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      prescription: {
        select: {
          id: true,
          prescriptionDate: true,
        },
      },
    };
  }

  private async updateMembershipTier(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyPoints: true },
    });
    if (!customer) return;

    let tier = 'Bronze';
    if (customer.loyaltyPoints >= 1000) {
      tier = 'VIP';
    } else if (customer.loyaltyPoints >= 500) {
      tier = 'Gold';
    } else if (customer.loyaltyPoints >= 200) {
      tier = 'Silver';
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { membershipTier: tier },
    });
  }
}
