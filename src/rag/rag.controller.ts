import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RagIndexRequestDto, RagIndexResponseDto } from './dto/rag-index.dto';
import { RagSearchRequestDto, RagSearchResponseDto } from './dto/rag-search.dto';
import { RagService } from './rag.service';

@ApiTags('RAG')
@Controller('ai/rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('index')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Build or refresh article vectors in the external vector database',
  })
  @ApiResponse({ status: 200, type: RagIndexResponseDto })
  reindex(@Body() body: RagIndexRequestDto): Promise<RagIndexResponseDto> {
    return this.ragService.reindex(body);
  }

  @Post('search')
  @HttpCode(200)
  @ApiOperation({ summary: 'Semantic search in indexed knowledge hub chunks' })
  @ApiResponse({ status: 200, type: RagSearchResponseDto })
  @ApiResponse({ status: 400, description: 'query is required' })
  search(@Body() body: RagSearchRequestDto): Promise<RagSearchResponseDto> {
    return this.ragService.search(body);
  }
}
