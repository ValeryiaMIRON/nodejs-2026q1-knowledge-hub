import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Backend' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'Articles related to backend development' })
  @IsString()
  @MinLength(1)
  description: string;
}
