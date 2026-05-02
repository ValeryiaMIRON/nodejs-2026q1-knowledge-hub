import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AiRateLimitGuard } from './ai-rate-limit.guard';
import { AnalyzeArticleDto } from './dto/analyze-article.dto';
import {
  AnalyzeArticleResponseDto,
  SummarizeArticleResponseDto,
  TranslateArticleResponseDto,
} from './dto/ai-response.dto';
import { ArticleIdParamDto } from './dto/article-id-param.dto';
import { SummarizeArticleDto } from './dto/summarize-article.dto';
import { TranslateArticleDto } from './dto/translate-article.dto';

@ApiTags('AI')
@Controller('ai')
@UseGuards(AiRateLimitGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('articles/:articleId/summarize')
  @ApiOperation({ summary: 'Generate article summary' })
  @ApiResponse({
    status: 200,
    description: 'Summary generated',
    type: SummarizeArticleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request body or UUID' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiResponse({ status: 429, description: 'AI rate limit exceeded' })
  summarizeArticle(
    @Param() params: ArticleIdParamDto,
    @Body() body: SummarizeArticleDto,
  ): Promise<SummarizeArticleResponseDto> {
    return this.aiService.summarizeArticle(params.articleId, body.maxLength);
  }

  @Post('articles/:articleId/translate')
  @ApiOperation({ summary: 'Translate article content' })
  @ApiResponse({
    status: 200,
    description: 'Translation generated',
    type: TranslateArticleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request body or UUID' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiResponse({ status: 429, description: 'AI rate limit exceeded' })
  translateArticle(
    @Param() params: ArticleIdParamDto,
    @Body() body: TranslateArticleDto,
  ): Promise<TranslateArticleResponseDto> {
    return this.aiService.translateArticle(
      params.articleId,
      body.targetLanguage,
      body.sourceLanguage,
    );
  }

  @Post('articles/:articleId/analyze')
  @ApiOperation({ summary: 'Analyze article content' })
  @ApiResponse({
    status: 200,
    description: 'Analysis generated',
    type: AnalyzeArticleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request body or UUID' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiResponse({ status: 429, description: 'AI rate limit exceeded' })
  analyzeArticle(
    @Param() params: ArticleIdParamDto,
    @Body() body: AnalyzeArticleDto,
  ): Promise<AnalyzeArticleResponseDto> {
    return this.aiService.analyzeArticle(params.articleId, body.task);
  }
}
