import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.workspaceId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: ListCustomersDto) {
    return this.customersService.findAll(user.workspaceId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customersService.findOne(id, user.workspaceId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, user.workspaceId, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customersService.softDelete(id, user.workspaceId);
  }

  // ─── Soft Delete & Restore ─────────────────────────────────────────────────

  @Post(':id/restore')
  @Roles('OWNER', 'MANAGER')
  restore(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customersService.restore(id, user.workspaceId);
  }

  @Delete(':id/hard-delete')
  @Roles('OWNER')
  hardDelete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customersService.hardDelete(id, user.workspaceId);
  }

  // ─── Bulk Operations ───────────────────────────────────────────────────────

  @Post('bulk/create')
  @Roles('OWNER', 'MANAGER')
  bulkCreate(
    @CurrentUser() user: any,
    @Body() body: { items: CreateCustomerDto[] },
  ) {
    return this.customersService.bulkCreate(user.workspaceId, body.items);
  }

  @Post('bulk/soft-delete')
  @Roles('OWNER', 'MANAGER')
  bulkSoftDelete(@CurrentUser() user: any, @Body() body: { ids: string[] }) {
    return this.customersService.bulkSoftDelete(user.workspaceId, body.ids);
  }

  @Post('bulk/restore')
  @Roles('OWNER', 'MANAGER')
  bulkRestore(@CurrentUser() user: any, @Body() body: { ids: string[] }) {
    return this.customersService.bulkRestore(user.workspaceId, body.ids);
  }

  @Post('bulk/hard-delete')
  @Roles('OWNER')
  bulkHardDelete(@CurrentUser() user: any, @Body() body: { ids: string[] }) {
    return this.customersService.bulkHardDelete(user.workspaceId, body.ids);
  }
}
