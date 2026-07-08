import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  async create(
    @Request() req: any,
    @Body()
    body: {
      supplierId: string;
      totalAmount: number;
      status: string;
      items?: string;
    },
  ) {
    return this.purchasesService.create(req.user.workspaceId, body);
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.purchasesService.findAll(req.user.workspaceId);
  }
}
