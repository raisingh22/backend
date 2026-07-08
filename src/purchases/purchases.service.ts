import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    workspaceId: string,
    dto: {
      supplierId: string;
      totalAmount: number;
      status: string;
      items?: string;
    },
  ) {
    return this.prisma.purchaseOrder.create({
      data: {
        supplierId: dto.supplierId,
        totalAmount: dto.totalAmount,
        status: dto.status,
        items: dto.items,
        workspaceId,
      },
      include: {
        supplier: true,
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { workspaceId },
      include: {
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
