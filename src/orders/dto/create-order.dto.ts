import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  prescriptionId?: string;

  @IsOptional()
  @IsString()
  frameName?: string;

  @IsOptional()
  @IsString()
  frameBrand?: string;

  @IsOptional()
  @IsString()
  frameModel?: string;

  @IsOptional()
  @IsString()
  lensType?: string;

  @IsOptional()
  @IsString()
  lensCoating?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount?: number = 0;

  @IsOptional()
  @IsIn(['PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED'])
  status?: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'CANCELLED';

  @IsOptional()
  @IsIn(['UNPAID', 'PARTIALLY_PAID', 'PAID'])
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

  @IsOptional()
  @IsISO8601()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
