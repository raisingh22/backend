import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePrescriptionDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rightSphere?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rightCylinder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(180)
  rightAxis?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rightAdd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  leftSphere?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  leftCylinder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(180)
  leftAxis?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  leftAdd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pupillaryDistance?: number;

  @IsOptional()
  @IsString()
  doctorName?: string;

  @IsOptional()
  @IsISO8601()
  prescriptionDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
