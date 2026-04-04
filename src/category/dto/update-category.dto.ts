import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiProperty({ example: 'Frontend' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'Articles related to frontend development' })
  @IsString()
  @MinLength(1)
  description: string;
}
