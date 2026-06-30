import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsEnum(['ADVANCE_PAYMENT', 'FULL_PAYMENT', 'PARTIAL_PAYMENT'])
  type: 'ADVANCE_PAYMENT' | 'FULL_PAYMENT' | 'PARTIAL_PAYMENT';

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
