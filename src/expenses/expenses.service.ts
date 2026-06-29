import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: { description: string; category: string; amount: number }) {
    return this.prisma.expense.create({
      data: {
        description: dto.description,
        category: dto.category,
        amount: dto.amount,
        workspaceId,
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.expense.findMany({
      where: { workspaceId },
      orderBy: { date: 'desc' },
    });
  }

  async remove(id: string, workspaceId: string) {
    return this.prisma.expense.deleteMany({
      where: { id, workspaceId },
    });
  }
}
