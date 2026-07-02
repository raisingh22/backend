import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class NestedPrescriptionDto {
  @IsNumber()
  @IsOptional()
  rightSphere?: number;

  @IsNumber()
  @IsOptional()
  rightCylinder?: number;

  @IsNumber()
  @IsOptional()
  rightAxis?: number;

  @IsNumber()
  @IsOptional()
  rightAdd?: number;

  @IsNumber()
  @IsOptional()
  leftSphere?: number;

  @IsNumber()
  @IsOptional()
  leftCylinder?: number;

  @IsNumber()
  @IsOptional()
  leftAxis?: number;

  @IsNumber()
  @IsOptional()
  leftAdd?: number;

  @IsNumber()
  @IsOptional()
  pupillaryDistance?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

class NestedOrderDto {
  @IsString()
  @IsOptional()
  frameName?: string;

  @IsString()
  @IsOptional()
  frameBrand?: string;

  @IsString()
  @IsOptional()
  frameModel?: string;

  @IsString()
  @IsOptional()
  lensType?: string;

  @IsString()
  @IsOptional()
  lensCoating?: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @IsNotEmpty()
  subtotal: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsNumber()
  @IsOptional()
  tax?: number;

  @IsNumber()
  @IsOptional()
  paidAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;
}

export class CreateVisitDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsOptional()
  doctorName?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => NestedPrescriptionDto)
  prescription?: NestedPrescriptionDto;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => NestedOrderDto)
  order?: NestedOrderDto;

  @IsOptional()
  @IsString()
  branchId?: string;
}
