import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiProperty({ example: 'old_password' })
  @IsString()
  @MinLength(1)
  oldPassword: string;

  @ApiProperty({ example: 'new_password' })
  @IsString()
  @MinLength(1)
  newPassword: string;
}
