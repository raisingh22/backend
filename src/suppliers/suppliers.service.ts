import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    workspaceId: string,
    dto: {
      name: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
    },
  ) {
    return this.prisma.supplier.create({
      data: {
        ...dto,
        workspaceId,
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.supplier.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  async remove(id: string, workspaceId: string) {
    return this.prisma.supplier.deleteMany({
      where: { id, workspaceId },
    });
  }
}
