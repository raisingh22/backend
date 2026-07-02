import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyMobileDto {
  @IsNotEmpty()
  @IsString()
  mobileNumber: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}
