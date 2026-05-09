import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class RagChatRequestDto {
  @ApiProperty({
    description: 'User question for grounded RAG answering',
  })
  @IsString()
  @MinLength(1)
  question: string;

  @ApiPropertyOptional({
    description: 'Existing conversation ID to continue context',
  })
  @IsOptional()
  @IsUUID('4')
  conversationId?: string;
}

export class RagChatSourceDto {
  @ApiProperty()
  articleId: string;

  @ApiProperty()
  articleTitle: string;

  @ApiProperty()
  relevantChunk: string;
}

export class RagChatResponseDto {
  @ApiProperty()
  answer: string;

  @ApiProperty({ type: [RagChatSourceDto] })
  sources: RagChatSourceDto[];

  @ApiProperty()
  conversationId: string;
}

export class RagConversationMessageDto {
  @ApiProperty({ enum: ['user', 'model'] })
  role: 'user' | 'model';

  @ApiProperty()
  text: string;
}

export class RagConversationHistoryResponseDto {
  @ApiProperty()
  conversationId: string;

  @ApiProperty({ type: [RagConversationMessageDto] })
  messages: RagConversationMessageDto[];
}
