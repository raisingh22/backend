import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  @Post()
  create(@CurrentUser() user: any, @Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(user.workspaceId, createCustomerDto);
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
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, user.workspaceId, updateCustomerDto);
  }

  @Delete(':id')
  @Roles('OWNER', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.customersService.remove(id, user.workspaceId);
  }
}
