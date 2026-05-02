import { ApiProperty } from '@nestjs/swagger';

export class SummarizeArticleResponseDto {
  @ApiProperty({ format: 'uuid' })
  articleId: string;

  @ApiProperty()
  summary: string;

  @ApiProperty({ example: 1024 })
  originalLength: number;

  @ApiProperty({ example: 256 })
  summaryLength: number;
}

export class TranslateArticleResponseDto {
  @ApiProperty({ format: 'uuid' })
  articleId: string;

  @ApiProperty()
  translatedText: string;

  @ApiProperty({ example: 'English' })
  detectedLanguage: string;
}

export class AnalyzeArticleResponseDto {
  @ApiProperty({ format: 'uuid' })
  articleId: string;

  @ApiProperty()
  analysis: string;

  @ApiProperty({ type: [String] })
  suggestions: string[];

  @ApiProperty({ enum: ['info', 'warning', 'error'] })
  severity: 'info' | 'warning' | 'error';
}
