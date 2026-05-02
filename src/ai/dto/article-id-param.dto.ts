import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ArticleIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  articleId: string;
}
