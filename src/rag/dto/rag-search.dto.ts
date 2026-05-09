import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

enum RagArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export class RagSearchRequestDto {
  @ApiProperty({
    description: 'Search query text',
    example: 'How to implement authorization in NestJS?',
  })
  @IsString()
  @MinLength(1)
  query: string;

  @ApiPropertyOptional({
    description: 'Maximum number of chunks to return',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiPropertyOptional({ enum: RagArticleStatus })
  @IsOptional()
  @IsEnum(RagArticleStatus)
  articleStatus?: RagArticleStatus;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by article tags', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
}

export class RagSearchResultDto {
  @ApiProperty()
  articleId: string;

  @ApiProperty()
  articleTitle: string;

  @ApiProperty()
  chunk: string;

  @ApiProperty()
  similarity: number;
}

export class RagSearchResponseDto {
  @ApiProperty({ type: [RagSearchResultDto] })
  results: RagSearchResultDto[];
}
