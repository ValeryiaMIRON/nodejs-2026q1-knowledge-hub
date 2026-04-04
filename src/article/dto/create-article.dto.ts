import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleStatus } from '../../common/enums/article-status.enum';

export class CreateArticleDto {
  @ApiProperty({ example: 'NestJS Guide' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ example: 'Detailed content here...' })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ enum: ArticleStatus, example: ArticleStatus.DRAFT })
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  authorId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['nodejs', 'nestjs'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
