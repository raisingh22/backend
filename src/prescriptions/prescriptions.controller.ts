import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { PrescriptionsService } from './prescriptions.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post('customers/:customerId/prescriptions')
  create(
    @CurrentUser() user: any,
    @Param('customerId') customerId: string,
    @Body() createPrescriptionDto: CreatePrescriptionDto,
  ) {
    return this.prescriptionsService.create(
      customerId,
      user.workspaceId,
      createPrescriptionDto,
    );
  }

  @Get('customers/:customerId/prescriptions')
  findAllForCustomer(
    @CurrentUser() user: any,
    @Param('customerId') customerId: string,
  ) {
    return this.prescriptionsService.findAllForCustomer(
      customerId,
      user.workspaceId,
    );
  }

  @Get('prescriptions/:id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.prescriptionsService.findOne(id, user.workspaceId);
  }

  @Patch('prescriptions/:id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updatePrescriptionDto: UpdatePrescriptionDto,
  ) {
    return this.prescriptionsService.update(
      id,
      user.workspaceId,
      updatePrescriptionDto,
    );
  }

  @Delete('prescriptions/:id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.prescriptionsService.remove(id, user.workspaceId);
  }
}
