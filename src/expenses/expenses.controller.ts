import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  async create(
    @Request() req: any,
    @Body() body: { description: string; category: string; amount: number },
  ) {
    return this.expensesService.create(req.user.workspaceId, body);
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.expensesService.findAll(req.user.workspaceId);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.expensesService.remove(id, req.user.workspaceId);
  }
}
