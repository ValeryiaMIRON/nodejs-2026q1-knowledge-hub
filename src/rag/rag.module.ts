import { Module } from '@nestjs/common';
import { GeminiService } from '../ai/gemini/gemini.service';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RagVectorDbService } from './rag-vector-db.service';

@Module({
  controllers: [RagController],
  providers: [RagService, RagVectorDbService, GeminiService],
})
export class RagModule {}
