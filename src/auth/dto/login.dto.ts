import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'john_doe' })
  @IsString()
  @MinLength(1)
  login: string;

  @ApiProperty({ example: 'secure_password' })
  @IsString()
  @MinLength(1)
  password: string;
}
