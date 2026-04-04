import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'old_password' })
  @IsOptional()
  @ValidateIf((dto) => dto.newPassword !== undefined)
  @IsString()
  @MinLength(1)
  oldPassword?: string;

  @ApiPropertyOptional({ example: 'new_password' })
  @IsOptional()
  @ValidateIf((dto) => dto.oldPassword !== undefined)
  @IsString()
  @MinLength(1)
  newPassword?: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.EDITOR })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
