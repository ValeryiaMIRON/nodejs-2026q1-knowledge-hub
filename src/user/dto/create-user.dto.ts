import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'john_doe' })
  @IsString()
  @MinLength(1)
  login: string;

  @ApiProperty({ example: 'secure_password' })
  @IsString()
  @MinLength(1)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.VIEWER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
