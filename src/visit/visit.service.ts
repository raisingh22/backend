import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { CreateVisitDto } from './dto/create-visit.dto';

@Injectable()
export class VisitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  async create(
    workspaceId: string,
    dto: CreateVisitDto,
    userBranchId?: string,
  ) {
    // Verify customer exists and belongs to workspace
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, workspaceId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // 1. Create the parent Visit record
    const visit = await this.prisma.visit.create({
      data: {
        customerId: dto.customerId,
        type: dto.type,
        doctorName: dto.doctorName || null,
        notes: dto.notes || null,
        workspaceId,
        branchId: dto.branchId || userBranchId || null,
      },
    });

    let prescriptionId: string | null = null;

    // 2. If prescription payload exists, create prescription
    if (dto.prescription) {
      const rx = await this.prisma.prescription.create({
        data: {
          rightSphere: dto.prescription.rightSphere || null,
          rightCylinder: dto.prescription.rightCylinder || null,
          rightAxis: dto.prescription.rightAxis || null,
          rightAdd: dto.prescription.rightAdd || null,
          leftSphere: dto.prescription.leftSphere || null,
          leftCylinder: dto.prescription.leftCylinder || null,
          leftAxis: dto.prescription.leftAxis || null,
          leftAdd: dto.prescription.leftAdd || null,
          pupillaryDistance: dto.prescription.pupillaryDistance || null,
          notes: dto.prescription.notes || null,
          doctorName: dto.doctorName || null,
          customerId: dto.customerId,
          visitId: visit.id,
          workspaceId,
        },
      });
      prescriptionId = rx.id;
    }

    // 3. If order payload exists, create order and link it to this visit
    if (dto.order) {
      const order = await this.ordersService.create(
        workspaceId,
        {
          customerId: dto.customerId,
          prescriptionId: prescriptionId || undefined,
          frameName: dto.order.frameName || '',
          frameBrand: dto.order.frameBrand || '',
          frameModel: dto.order.frameModel || '',
          lensType: dto.order.lensType || '',
          lensCoating: dto.order.lensCoating || '',
          quantity: dto.order.quantity || 1,
          subtotal: dto.order.subtotal,
          discount: dto.order.discount || 0,
          tax: dto.order.tax || 0,
          paidAmount: dto.order.paidAmount || 0,
          status: 'PENDING',
          paymentStatus: 'UNPAID', // calculated inside ordersService
          expectedDeliveryDate: dto.order.expectedDeliveryDate,
          notes: dto.order.notes || '',
        },
        userBranchId,
      );

      // Link order to visit
      await this.prisma.order.update({
        where: { id: order.id },
        data: { visitId: visit.id },
      });

      // Link automatically generated order transactions to visit
      await this.prisma.ledgerTransaction.updateMany({
        where: { referenceId: order.id },
        data: { visitId: visit.id },
      });
    }

    // Return full visit with populated relations
    return this.findOne(visit.id, workspaceId);
  }

  async findOne(id: string, workspaceId: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id, workspaceId },
      include: {
        prescriptions: true,
        orders: {
          include: {
            prescription: true,
          },
        },
        transactions: true,
      },
    });
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }
    return visit;
  }

  async findByCustomer(customerId: string, workspaceId: string) {
    return this.prisma.visit.findMany({
      where: { customerId, workspaceId },
      orderBy: { date: 'desc' },
      include: {
        prescriptions: true,
        orders: {
          include: {
            prescription: true,
          },
        },
        transactions: true,
      },
    });
  }

  async remove(id: string, workspaceId: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id, workspaceId },
    });
    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    // Before removing, we must delete orders and prescriptions associated.
    // Deleting orders will trigger ledger service recalculations inside ordersService delete logic.
    const orders = await this.prisma.order.findMany({
      where: { visitId: id },
    });

    for (const order of orders) {
      await this.ordersService.remove(order.id, workspaceId);
    }

    // Delete prescriptions created in this visit
    await this.prisma.prescription.deleteMany({
      where: { visitId: id },
    });

    // Delete ledger transactions created in this visit
    await this.prisma.ledgerTransaction.deleteMany({
      where: { visitId: id },
    });

    // Delete the visit
    return this.prisma.visit.delete({
      where: { id },
    });
  }
}
