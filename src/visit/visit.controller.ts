import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { VisitService } from './visit.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('visits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisitController {
  constructor(private readonly visitService: VisitService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateVisitDto) {
    return this.visitService.create(user.workspaceId, dto, user.branchId);
  }

  @Get('customer/:customerId')
  async findByCustomer(
    @CurrentUser() user: any,
    @Param('customerId') customerId: string,
  ) {
    return this.visitService.findByCustomer(customerId, user.workspaceId);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.visitService.findOne(id, user.workspaceId);
  }

  @Delete(':id')
  @Roles('OWNER', 'MANAGER')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.visitService.remove(id, user.workspaceId);
  }
}
