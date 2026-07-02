import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsNotEmpty()
  @IsString()
  mobileNumber: string;

  @MinLength(8)
  @IsString()
  password: string;
}
