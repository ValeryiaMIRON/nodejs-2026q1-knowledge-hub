import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleStatus } from '../../common/enums/article-status.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class GetArticlesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ArticleStatus,
    example: ArticleStatus.PUBLISHED,
  })
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'nodejs' })
  @IsOptional()
  @IsString()
  tag?: string;
}
