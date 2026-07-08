import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseListQueryDto } from '../dto/base-list-query.dto';

export interface CrudConfig {
  /** Prisma model delegate key, e.g. 'customer', 'order' */
  model: string;
  /** Fields to match against when a `search` query param is supplied */
  searchFields?: string[];
  /** Default Prisma `include` object to apply on findMany / findOne */
  defaultInclude?: Record<string, any>;
  /** Default sortBy field when none is specified */
  defaultSortBy?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export abstract class BaseCrudService {
  protected abstract readonly config: CrudConfig;

  constructor(protected readonly prisma: PrismaService) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private get delegate(): any {
    return (this.prisma as any)[this.config.model];
  }

  private buildSearchWhere(search?: string): any {
    if (!search || !this.config.searchFields?.length) return {};
    return {
      OR: this.config.searchFields.map((field) => ({
        [field]: { contains: search, mode: 'insensitive' },
      })),
    };
  }

  private buildSoftDeleteWhere(includeDeleted = false): any {
    return includeDeleted ? {} : { deletedAt: null };
  }

  private buildOrderBy(
    sortBy?: string,
    sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC',
  ): any {
    const field = sortBy ?? this.config.defaultSortBy ?? 'createdAt';
    const dir = (sortOrder ?? 'desc').toLowerCase() as 'asc' | 'desc';
    return { [field]: dir };
  }

  // ─── Standard CRUD ────────────────────────────────────────────────────────────

  async create(workspaceId: string, data: Record<string, any>): Promise<any> {
    return this.delegate.create({
      data: { ...data, workspaceId },
      include: this.config.defaultInclude,
    });
  }

  async findAll(
    workspaceId: string,
    query: BaseListQueryDto,
    additionalWhere: Record<string, any> = {},
  ): Promise<PaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      workspaceId,
      ...this.buildSoftDeleteWhere(query.includeDeleted),
      ...this.buildSearchWhere(query.search),
      ...additionalWhere,
    };

    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder as any);

    const [items, total] = await this.prisma.$transaction([
      this.delegate.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: this.config.defaultInclude,
      }),
      this.delegate.count({ where }),
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

  async findOne(id: string, workspaceId: string): Promise<any> {
    const record = await this.delegate.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: this.config.defaultInclude,
    });

    if (!record) {
      throw new NotFoundException(
        `${this.config.model} with ID "${id}" not found`,
      );
    }

    return record;
  }

  async update(
    id: string,
    workspaceId: string,
    data: Record<string, any>,
  ): Promise<any> {
    await this.findOne(id, workspaceId);
    return this.delegate.update({
      where: { id },
      data,
      include: this.config.defaultInclude,
    });
  }

  // ─── Soft Delete & Restore ───────────────────────────────────────────────────

  async softDelete(id: string, workspaceId: string): Promise<{ success: true }> {
    await this.findOne(id, workspaceId);
    await this.delegate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async restore(id: string, workspaceId: string): Promise<any> {
    const record = await this.delegate.findFirst({
      where: { id, workspaceId },
    });
    if (!record) {
      throw new NotFoundException(
        `${this.config.model} with ID "${id}" not found`,
      );
    }
    return this.delegate.update({
      where: { id },
      data: { deletedAt: null },
      include: this.config.defaultInclude,
    });
  }

  async hardDelete(id: string, workspaceId: string): Promise<{ success: true }> {
    await this.findOne(id, workspaceId);
    await this.delegate.delete({ where: { id } });
    return { success: true };
  }

  // ─── Bulk Operations ─────────────────────────────────────────────────────────

  async bulkCreate(
    workspaceId: string,
    items: Record<string, any>[],
  ): Promise<{ count: number }> {
    const result = await this.delegate.createMany({
      data: items.map((item) => ({ ...item, workspaceId })),
      skipDuplicates: true,
    });
    return { count: result.count };
  }

  async bulkUpdate(
    workspaceId: string,
    ids: string[],
    data: Record<string, any>,
  ): Promise<{ count: number }> {
    const result = await this.delegate.updateMany({
      where: { id: { in: ids }, workspaceId, deletedAt: null },
      data,
    });
    return { count: result.count };
  }

  async bulkSoftDelete(
    workspaceId: string,
    ids: string[],
  ): Promise<{ count: number }> {
    const result = await this.delegate.updateMany({
      where: { id: { in: ids }, workspaceId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { count: result.count };
  }

  async bulkRestore(
    workspaceId: string,
    ids: string[],
  ): Promise<{ count: number }> {
    const result = await this.delegate.updateMany({
      where: { id: { in: ids }, workspaceId },
      data: { deletedAt: null },
    });
    return { count: result.count };
  }

  async bulkHardDelete(
    workspaceId: string,
    ids: string[],
  ): Promise<{ count: number }> {
    const result = await this.delegate.deleteMany({
      where: { id: { in: ids }, workspaceId },
    });
    return { count: result.count };
  }
}
