import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /** POST /appointments */
  @Post('appointments')
  create(@CurrentUser() user: any, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(user.workspaceId, dto, user.branchId);
  }

  /** POST /appointments/walk-in */
  @Post('appointments/walk-in')
  createWalkIn(
    @CurrentUser() user: any,
    @Body('customerId') customerId: string,
  ) {
    return this.appointmentsService.createWalkIn(user.workspaceId, customerId, user.branchId);
  }

  /** GET /appointments?date=YYYY-MM-DD */
  @Get('appointments')
  findAll(@CurrentUser() user: any, @Query('date') date?: string) {
    return this.appointmentsService.findAll(user.workspaceId, date, user.branchId);
  }

  /** GET /customers/:customerId/appointments */
  @Get('customers/:customerId/appointments')
  findAllForCustomer(
    @CurrentUser() user: any,
    @Param('customerId') customerId: string,
  ) {
    return this.appointmentsService.findAllForCustomer(customerId, user.workspaceId);
  }

  /** GET /appointments/:id */
  @Get('appointments/:id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.appointmentsService.findOne(id, user.workspaceId);
  }

  /** PATCH /appointments/:id */
  @Patch('appointments/:id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(id, user.workspaceId, dto);
  }

  /** DELETE /appointments/:id */
  @Delete('appointments/:id')
  @Roles('OWNER', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.appointmentsService.remove(id, user.workspaceId);
  }
}
