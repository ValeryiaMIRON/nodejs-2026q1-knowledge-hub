import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyzeTask } from './dto/analyze-article.dto';
import {
  AnalyzeArticleResponseDto,
  SummarizeArticleResponseDto,
  TranslateArticleResponseDto,
} from './dto/ai-response.dto';
import { SummaryLength } from './dto/summarize-article.dto';
import { GeminiService } from './gemini/gemini.service';
import { AiPromptsService } from './prompts/ai-prompts.service';

type AnalyzePayload = {
  analysis: string;
  suggestions: string[];
  severity: 'info' | 'warning' | 'error';
};

type TranslatePayload = {
  translatedText: string;
  detectedLanguage: string;
};

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly promptsService: AiPromptsService,
  ) {}

  async summarizeArticle(
    articleId: string,
    maxLength: SummaryLength = SummaryLength.MEDIUM,
  ): Promise<SummarizeArticleResponseDto> {
    const article = await this.getArticleOrFail(articleId);
    const prompt = this.promptsService.buildSummarizePrompt(
      article.content,
      maxLength,
    );
    const summary = await this.geminiService.generateText(prompt);

    return {
      articleId: article.id,
      summary,
      originalLength: article.content.length,
      summaryLength: summary.length,
    };
  }

  async translateArticle(
    articleId: string,
    targetLanguage: string,
    sourceLanguage?: string,
  ): Promise<TranslateArticleResponseDto> {
    const article = await this.getArticleOrFail(articleId);
    const prompt = this.promptsService.buildTranslatePrompt(
      article.content,
      targetLanguage,
      sourceLanguage,
    );
    const generatedText = await this.geminiService.generateText(prompt);
    const parsedPayload =
      this.parseJsonPayload<TranslatePayload>(generatedText);

    if (parsedPayload?.translatedText && parsedPayload?.detectedLanguage) {
      return {
        articleId: article.id,
        translatedText: parsedPayload.translatedText,
        detectedLanguage: parsedPayload.detectedLanguage,
      };
    }

    return {
      articleId: article.id,
      translatedText: generatedText,
      detectedLanguage: sourceLanguage || 'unknown',
    };
  }

  async analyzeArticle(
    articleId: string,
    task: AnalyzeTask = AnalyzeTask.REVIEW,
  ): Promise<AnalyzeArticleResponseDto> {
    const article = await this.getArticleOrFail(articleId);
    const prompt = this.promptsService.buildAnalyzePrompt(
      article.content,
      task,
    );
    const generatedText = await this.geminiService.generateText(prompt);
    const parsedPayload = this.parseJsonPayload<AnalyzePayload>(generatedText);

    if (
      parsedPayload?.analysis &&
      Array.isArray(parsedPayload.suggestions) &&
      this.isSeverity(parsedPayload.severity)
    ) {
      return {
        articleId: article.id,
        analysis: parsedPayload.analysis,
        suggestions: parsedPayload.suggestions,
        severity: parsedPayload.severity,
      };
    }

    return {
      articleId: article.id,
      analysis: generatedText,
      suggestions: ['Model returned non-structured output'],
      severity: 'info',
    };
  }

  async generate(prompt: string): Promise<string> {
    return this.geminiService.generateText(prompt);
  }

  private async getArticleOrFail(articleId: string): Promise<{
    id: string;
    content: string;
  }> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        content: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  private parseJsonPayload<T>(rawText: string): T | null {
    const trimmedText = rawText.trim();
    const withoutFence = trimmedText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    try {
      return JSON.parse(withoutFence) as T;
    } catch {
      return null;
    }
  }

  private isSeverity(value: unknown): value is 'info' | 'warning' | 'error' {
    return value === 'info' || value === 'warning' || value === 'error';
  }
}
