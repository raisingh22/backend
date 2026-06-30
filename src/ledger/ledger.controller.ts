import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { LedgerService } from './ledger.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ListLedgerDto } from './dto/list-ledger.dto';

@Controller('ledger')
@UseGuards(JwtAuthGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: ListLedgerDto) {
    return this.ledgerService.findAllLedgers(user.workspaceId, query);
  }

  @Get('report')
  getReport(@CurrentUser() user: any) {
    return this.ledgerService.getLedgerReport(user.workspaceId);
  }

  @Get(':customerId')
  findOne(@CurrentUser() user: any, @Param('customerId') customerId: string) {
    return this.ledgerService.findOneCustomerLedger(customerId, user.workspaceId);
  }

  @Post('payment')
  addPayment(@CurrentUser() user: any, @Body() dto: CreatePaymentDto) {
    return this.ledgerService.addPayment(user.workspaceId, dto);
  }

  @Post('adjustment')
  addAdjustment(@CurrentUser() user: any, @Body() dto: CreateAdjustmentDto) {
    return this.ledgerService.addAdjustment(user.workspaceId, dto);
  }

  @Patch(':transactionId')
  updateTransaction(
    @CurrentUser() user: any,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.ledgerService.updateTransaction(transactionId, user.workspaceId, dto);
  }

  @Delete(':transactionId')
  deleteTransaction(@CurrentUser() user: any, @Param('transactionId') transactionId: string) {
    return this.ledgerService.deleteTransaction(transactionId, user.workspaceId);
  }
}
