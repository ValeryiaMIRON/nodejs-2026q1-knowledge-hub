import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class GetCommentsQueryDto extends PaginationQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  @MinLength(1)
  articleId: string;

  @ApiPropertyOptional({ example: 1 })
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  limit?: number;
}
