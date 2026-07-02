import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  create(@CurrentUser() user: any, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(user.workspaceId, createOrderDto, user.branchId);
  }

  @Get('orders')
  findAll(@CurrentUser() user: any) {
    return this.ordersService.findAll(user.workspaceId, user.branchId);
  }

  @Get('customers/:customerId/orders')
  findAllForCustomer(@CurrentUser() user: any, @Param('customerId') customerId: string) {
    return this.ordersService.findAllForCustomer(customerId, user.workspaceId, user.branchId);
  }

  @Get('orders/:orderId')
  findOne(@CurrentUser() user: any, @Param('orderId') orderId: string) {
    return this.ordersService.findOne(orderId, user.workspaceId, user.branchId);
  }

  @Patch('orders/:orderId')
  update(
    @CurrentUser() user: any,
    @Param('orderId') orderId: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.ordersService.update(orderId, user.workspaceId, updateOrderDto, user.branchId);
  }

  @Delete('orders/:orderId')
  @Roles('OWNER', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('orderId') orderId: string) {
    return this.ordersService.remove(orderId, user.workspaceId);
  }
}
