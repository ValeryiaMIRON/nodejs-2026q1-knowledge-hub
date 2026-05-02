import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class TranslateArticleDto {
  @ApiProperty({ example: 'Spanish' })
  @IsString()
  @MinLength(1)
  targetLanguage: string;

  @ApiPropertyOptional({ example: 'English' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  sourceLanguage?: string;
}
