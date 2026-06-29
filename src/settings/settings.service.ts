import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getWorkspaceSettings(workspaceId: string) {
    const settings = await this.prisma.workspaceSettings.findUnique({
      where: { workspaceId },
    });
    
    // Auto-create settings if they don't exist yet
    if (!settings) {
      return await this.prisma.workspaceSettings.create({
        data: { workspaceId },
      });
    }

    return settings;
  }

  async updateWorkspaceSettings(workspaceId: string, data: any) {
    return this.prisma.workspaceSettings.upsert({
      where: { workspaceId },
      create: { workspaceId, ...data },
      update: { ...data },
    });
  }

  async getBranches(workspaceId: string) {
    return this.prisma.branch.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createBranch(workspaceId: string, data: { name: string; address: string; phone?: string; businessHours?: string }) {
    return this.prisma.branch.create({
      data: {
        ...data,
        workspaceId,
      },
    });
  }

  async deleteBranch(workspaceId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, workspaceId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return this.prisma.branch.delete({
      where: { id: branchId },
    });
  }
}
