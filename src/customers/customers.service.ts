import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        address: dto.address,
        notes: dto.notes,
        tags: dto.tags ?? [],
        primaryMemberId: dto.primaryMemberId || null,
        relationType: dto.relationType || null,
        workspaceId,
      },
    });
  }

  async findAll(workspaceId: string, query: ListCustomersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({
        where: { workspaceId },
      }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, workspaceId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, workspaceId },
      include: {
        familyMembers: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            relationType: true,
          },
        },
        primaryMember: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            relationType: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID "${id}" not found`);
    }

    return customer;
  }

  async update(id: string, workspaceId: string, dto: UpdateCustomerDto) {
    await this.findOne(id, workspaceId);

    return this.prisma.customer.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        address: dto.address,
        notes: dto.notes,
        tags: dto.tags !== undefined ? dto.tags : undefined,
        primaryMemberId: dto.primaryMemberId !== undefined ? (dto.primaryMemberId || null) : undefined,
        relationType: dto.relationType !== undefined ? (dto.relationType || null) : undefined,
      },
    });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    await this.prisma.customer.delete({
      where: { id },
    });

    return { success: true };
  }
}
