import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: {
        customerId: dto.customerId,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes ?? 30,
        type: dto.type ?? 'Examination',
        notes: dto.notes,
        workspaceId,
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }

  async createWalkIn(workspaceId: string, customerId: string) {
    return this.prisma.appointment.create({
      data: {
        customerId,
        scheduledAt: new Date(),
        durationMinutes: 30,
        type: 'Walk-in',
        status: AppointmentStatus.WALK_IN,
        workspaceId,
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }

  async findAll(workspaceId: string, dateStr?: string) {
    const where: any = { workspaceId };

    if (dateStr) {
      const start = new Date(dateStr);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateStr);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }

  async findAllForCustomer(customerId: string, workspaceId: string) {
    return this.prisma.appointment.findMany({
      where: { customerId, workspaceId },
      orderBy: { scheduledAt: 'desc' },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }

  async findOne(id: string, workspaceId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, workspaceId },
      include: {
        customer: { select: { id: true, fullName: true, phone: true, email: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment "${id}" not found`);
    }
    return appointment;
  }

  async update(id: string, workspaceId: string, dto: UpdateAppointmentDto) {
    await this.findOne(id, workspaceId);

    return this.prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        durationMinutes: dto.durationMinutes,
        type: dto.type,
        status: dto.status,
        notes: dto.notes,
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    await this.prisma.appointment.delete({ where: { id } });
    return { success: true };
  }
}
