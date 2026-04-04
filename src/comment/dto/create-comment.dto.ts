import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  content: string;

  @IsUUID('4')
  articleId: string;

  @IsOptional()
  @IsUUID('4')
  authorId?: string | null;
}
