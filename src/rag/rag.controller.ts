import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  RagChatRequestDto,
  RagChatResponseDto,
  RagConversationHistoryResponseDto,
} from './dto/rag-chat.dto';
import {
  RagArticleParamDto,
  RagConversationParamDto,
} from './dto/rag-article-param.dto';
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

  @Post('chat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ask a grounded question using RAG context' })
  @ApiResponse({ status: 200, type: RagChatResponseDto })
  @ApiResponse({ status: 400, description: 'question is required' })
  chat(@Body() body: RagChatRequestDto): Promise<RagChatResponseDto> {
    return this.ragService.chat(body);
  }

  @Delete('index/articles/:articleId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete all indexed chunks for an article' })
  @ApiResponse({ status: 204, description: 'Article vectors deleted' })
  @ApiResponse({ status: 404, description: 'Article vectors not found' })
  async removeArticleFromIndex(@Param() params: RagArticleParamDto): Promise<void> {
    await this.ragService.removeArticleFromIndex(params.articleId);
  }

  @Get('chat/:conversationId/history')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get RAG conversation history by conversation ID' })
  @ApiResponse({ status: 200, type: RagConversationHistoryResponseDto })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  getConversationHistory(
    @Param() params: RagConversationParamDto,
  ): RagConversationHistoryResponseDto {
    return this.ragService.getConversationHistory(params.conversationId);
  }
}
