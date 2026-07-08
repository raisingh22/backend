import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseCrudService, CrudConfig } from '../common/crud/base-crud.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService extends BaseCrudService {
  protected readonly config: CrudConfig = {
    model: 'customer',
    searchFields: ['fullName', 'phone', 'email'],
    defaultSortBy: 'createdAt',
  };

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // ─── Override create to map DTO fields properly ───────────────────────────────

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

  // ─── Override findAll to use inherited generic implementation ─────────────────

  async findAll(workspaceId: string, query: ListCustomersDto) {
    return super.findAll(workspaceId, query);
  }

  // ─── Override findOne to include family member relationships ─────────────────

  async findOne(id: string, workspaceId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        familyMembers: {
          where: { deletedAt: null },
          select: { id: true, fullName: true, phone: true, relationType: true },
        },
        primaryMember: {
          select: { id: true, fullName: true, phone: true, relationType: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID "${id}" not found`);
    }

    return customer;
  }

  // ─── Override update to map DTO fields properly ───────────────────────────────

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
        primaryMemberId:
          dto.primaryMemberId !== undefined
            ? dto.primaryMemberId || null
            : undefined,
        relationType:
          dto.relationType !== undefined ? dto.relationType || null : undefined,
      },
    });
  }

  // ─── Legacy alias (hard delete) kept for backwards compat ────────────────────

  async remove(id: string, workspaceId: string) {
    return this.softDelete(id, workspaceId);
  }
}
