import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RagArticleParamDto {
  @ApiProperty()
  @IsUUID('4')
  articleId: string;
}

export class RagConversationParamDto {
  @ApiProperty()
  @IsUUID('4')
  conversationId: string;
}
