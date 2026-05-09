import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class RagIndexRequestDto {
  @ApiPropertyOptional({
    description: 'Index only published articles',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  onlyPublished?: boolean;

  @ApiPropertyOptional({
    description: 'Selectively reindex by article IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  articleIds?: string[];

  @ApiPropertyOptional({
    description:
      'Incremental mode: index only changed articles for non-selective reindex',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  incremental?: boolean;
}

export class RagIndexResponseDto {
  @ApiProperty()
  indexedArticles: number;

  @ApiProperty()
  indexedChunks: number;

  @ApiProperty()
  vectorCollection: string;
}
