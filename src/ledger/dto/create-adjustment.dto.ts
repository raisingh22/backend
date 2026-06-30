import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreateAdjustmentDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsEnum(['REFUND', 'ADJUSTMENT', 'DISCOUNT', 'RETURN', 'EXCHANGE', 'OPENING_BALANCE'])
  type: 'REFUND' | 'ADJUSTMENT' | 'DISCOUNT' | 'RETURN' | 'EXCHANGE' | 'OPENING_BALANCE';

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
