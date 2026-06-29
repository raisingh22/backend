import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

@Injectable()
export class PrescriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerId: string, workspaceId: string, dto: CreatePrescriptionDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, workspaceId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID "${customerId}" not found`);
    }

    return this.prisma.prescription.create({
      data: {
        rightSphere: dto.rightSphere,
        rightCylinder: dto.rightCylinder,
        rightAxis: dto.rightAxis,
        rightAdd: dto.rightAdd,
        leftSphere: dto.leftSphere,
        leftCylinder: dto.leftCylinder,
        leftAxis: dto.leftAxis,
        leftAdd: dto.leftAdd,
        pupillaryDistance: dto.pupillaryDistance,
        doctorName: dto.doctorName,
        prescriptionDate: dto.prescriptionDate ? new Date(dto.prescriptionDate) : undefined,
        notes: dto.notes,
        customerId,
        workspaceId,
      },
    });
  }

  async findAllForCustomer(customerId: string, workspaceId: string) {
    await this.ensureCustomerBelongsToWorkspace(customerId, workspaceId);

    return this.prisma.prescription.findMany({
      where: { customerId, workspaceId },
      orderBy: { prescriptionDate: 'desc' },
    });
  }

  async findOne(id: string, workspaceId: string) {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id, workspaceId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with ID "${id}" not found`);
    }

    return prescription;
  }

  async update(id: string, workspaceId: string, dto: UpdatePrescriptionDto) {
    await this.findOne(id, workspaceId);

    return this.prisma.prescription.update({
      where: { id },
      data: {
        rightSphere: dto.rightSphere,
        rightCylinder: dto.rightCylinder,
        rightAxis: dto.rightAxis,
        rightAdd: dto.rightAdd,
        leftSphere: dto.leftSphere,
        leftCylinder: dto.leftCylinder,
        leftAxis: dto.leftAxis,
        leftAdd: dto.leftAdd,
        pupillaryDistance: dto.pupillaryDistance,
        doctorName: dto.doctorName,
        prescriptionDate: dto.prescriptionDate ? new Date(dto.prescriptionDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);

    await this.prisma.prescription.delete({
      where: { id },
    });

    return { success: true };
  }

  private async ensureCustomerBelongsToWorkspace(customerId: string, workspaceId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, workspaceId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID "${customerId}" not found`);
    }
  }
}
