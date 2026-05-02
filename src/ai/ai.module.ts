import { Module } from '@nestjs/common';
import { AiRateLimitGuard } from './ai-rate-limit.guard';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ConversationService } from './conversation/conversation.service';
import { GeminiService } from './gemini/gemini.service';
import { AiPromptsService } from './prompts/ai-prompts.service';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    GeminiService,
    AiPromptsService,
    AiRateLimitGuard,
    ConversationService,
  ],
  exports: [AiService, GeminiService],
})
export class AiModule {}
