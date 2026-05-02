import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiService } from './gemini/gemini.service';
import { AiPromptsService } from './prompts/ai-prompts.service';

@Module({
  controllers: [AiController],
  providers: [AiService, GeminiService, AiPromptsService],
  exports: [AiService, GeminiService],
})
export class AiModule {}
