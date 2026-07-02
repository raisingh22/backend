import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    workspaceId: string,
    query: {
      page?: number;
      limit?: number;
      userId?: string;
      entityType?: string;
      entityId?: string;
      action?: string;
      from?: string;
      to?: string;
    },
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };

    if (query.userId) where.userId = query.userId;
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.action) where.action = query.action;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats(workspaceId: string) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, last24hCount, last7dCount, byAction, byEntity] =
      await Promise.all([
        this.prisma.auditLog.count({ where: { workspaceId } }),
        this.prisma.auditLog.count({
          where: { workspaceId, createdAt: { gte: last24h } },
        }),
        this.prisma.auditLog.count({
          where: { workspaceId, createdAt: { gte: last7d } },
        }),
        this.prisma.auditLog.groupBy({
          by: ['action'],
          where: { workspaceId },
          _count: true,
        }),
        this.prisma.auditLog.groupBy({
          by: ['entityType'],
          where: { workspaceId },
          _count: true,
        }),
      ]);

    return {
      total,
      last24h: last24hCount,
      last7d: last7dCount,
      byAction: byAction.map((g) => ({ action: g.action, count: g._count })),
      byEntity: byEntity.map((g) => ({
        entityType: g.entityType,
        count: g._count,
      })),
    };
  }
}
