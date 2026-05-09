import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('RAG')
@Controller('ai/rag')
export class RagController {}
