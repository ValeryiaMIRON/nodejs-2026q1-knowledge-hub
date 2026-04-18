import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'john_doe' })
  @IsString()
  @MinLength(1)
  login: string;

  @ApiProperty({ example: 'secure_password' })
  @IsString()
  @MinLength(1)
  password: string;
}
