import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class StartConversationDto {
  @ApiProperty({
    description: 'Opening message to start the conversation',
    example: 'What is NestJS and when should I use it?',
  })
  @IsString()
  @MinLength(1)
  message: string;
}

export class ConversationMessageDto {
  @ApiProperty({
    description: 'Follow-up message in the conversation',
    example: 'Can you give a concrete example?',
  })
  @IsString()
  @MinLength(1)
  message: string;
}

export class ConversationParamDto {
  @IsUUID('4')
  conversationId: string;
}

export class ConversationResponseDto {
  @ApiProperty({ description: 'Unique conversation identifier (UUID v4)' })
  conversationId: string;

  @ApiProperty({ description: 'AI reply to the latest message' })
  reply: string;

  @ApiProperty({
    description: 'Total messages in conversation (user + model turns)',
  })
  messageCount: number;
}
