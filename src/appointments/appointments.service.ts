import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateAppointmentDto) {
    const appointment = await this.prisma.appointment.create({
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

    // Auto-create Contact Lens follow-up appointments if initial trial is booked
    if (dto.type === 'Contact Lens Trial') {
      const followUpIntervals = [
        { days: 7, label: '7-Day Follow-up' },
        { days: 30, label: '30-Day Follow-up' },
        { days: 180, label: '6-Month Follow-up' },
      ];

      for (const interval of followUpIntervals) {
        const scheduledDate = new Date(appointment.scheduledAt);
        scheduledDate.setDate(scheduledDate.getDate() + interval.days);

        await this.prisma.appointment.create({
          data: {
            customerId: dto.customerId,
            scheduledAt: scheduledDate,
            durationMinutes: 30,
            type: 'Follow-up',
            notes: `Auto-generated: Contact Lens ${interval.label} from initial trial on ${new Date(dto.scheduledAt).toLocaleDateString('en-IN')}`,
            workspaceId,
          },
        });
      }
    }

    return appointment;
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
    const existingAppt = await this.findOne(id, workspaceId);

    const updated = await this.prisma.appointment.update({
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

    // Auto-create Annual Checkup reminder 12 months later when an Examination is marked COMPLETED
    if (dto.status === 'COMPLETED' && updated.type === 'Examination') {
      const annualDate = new Date(updated.scheduledAt);
      annualDate.setFullYear(annualDate.getFullYear() + 1);

      // Check if an eye checkup is already scheduled around that date to avoid duplicate
      const rangeStart = new Date(annualDate);
      rangeStart.setDate(rangeStart.getDate() - 30);
      const rangeEnd = new Date(annualDate);
      rangeEnd.setDate(rangeEnd.getDate() + 30);

      const existing = await this.prisma.appointment.findFirst({
        where: {
          customerId: updated.customerId,
          workspaceId,
          type: 'Examination',
          scheduledAt: {
            gte: rangeStart,
            lte: rangeEnd,
          },
        },
      });

      if (!existing) {
        await this.prisma.appointment.create({
          data: {
            customerId: updated.customerId,
            scheduledAt: annualDate,
            durationMinutes: 30,
            type: 'Examination',
            notes: 'Auto-generated: Annual Eye Checkup reminder (12 months later)',
            workspaceId,
          },
        });
      }
    }

    return updated;
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    await this.prisma.appointment.delete({ where: { id } });
    return { success: true };
  }
}
