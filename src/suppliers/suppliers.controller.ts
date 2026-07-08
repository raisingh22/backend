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
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  async create(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
    },
  ) {
    return this.suppliersService.create(req.user.workspaceId, body);
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.suppliersService.findAll(req.user.workspaceId);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.suppliersService.remove(id, req.user.workspaceId);
  }
}
