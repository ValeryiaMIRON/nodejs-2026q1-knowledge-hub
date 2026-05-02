import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum AnalyzeTask {
  REVIEW = 'review',
  BUGS = 'bugs',
  OPTIMIZE = 'optimize',
  EXPLAIN = 'explain',
}

export class AnalyzeArticleDto {
  @ApiPropertyOptional({ enum: AnalyzeTask, default: AnalyzeTask.REVIEW })
  @IsOptional()
  @IsEnum(AnalyzeTask)
  task?: AnalyzeTask;
}
