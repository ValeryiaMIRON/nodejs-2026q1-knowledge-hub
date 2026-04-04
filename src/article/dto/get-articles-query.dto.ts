import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ArticleStatus } from '../../common/enums/article-status.enum';

export class GetArticlesQueryDto {
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  tag?: string;
}
