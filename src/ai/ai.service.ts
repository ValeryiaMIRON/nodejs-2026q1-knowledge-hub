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

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

@Injectable()
export class AiService {
  private readonly summarizeCache = new Map<
    string,
    CacheEntry<SummarizeArticleResponseDto>
  >();
  private readonly translateCache = new Map<
    string,
    CacheEntry<TranslateArticleResponseDto>
  >();

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
    const cacheKey = this.buildSummarizeCacheKey(
      article.id,
      maxLength,
      article.updatedAt,
    );
    const cached = this.getCachedValue(this.summarizeCache, cacheKey);
    if (cached) {
      return cached;
    }

    const prompt = this.promptsService.buildSummarizePrompt(
      article.content,
      maxLength,
    );
    const summary = await this.geminiService.generateText(prompt);

    const response: SummarizeArticleResponseDto = {
      articleId: article.id,
      summary,
      originalLength: article.content.length,
      summaryLength: summary.length,
    };

    this.setCachedValue(this.summarizeCache, cacheKey, response);
    return response;
  }

  async translateArticle(
    articleId: string,
    targetLanguage: string,
    sourceLanguage?: string,
  ): Promise<TranslateArticleResponseDto> {
    const article = await this.getArticleOrFail(articleId);
    const cacheKey = this.buildTranslateCacheKey(
      article.id,
      targetLanguage,
      sourceLanguage,
      article.updatedAt,
    );
    const cached = this.getCachedValue(this.translateCache, cacheKey);
    if (cached) {
      return cached;
    }

    const prompt = this.promptsService.buildTranslatePrompt(
      article.content,
      targetLanguage,
      sourceLanguage,
    );
    const generatedText = await this.geminiService.generateText(prompt);
    const parsedPayload =
      this.parseJsonPayload<TranslatePayload>(generatedText);

    if (parsedPayload?.translatedText && parsedPayload?.detectedLanguage) {
      const response: TranslateArticleResponseDto = {
        articleId: article.id,
        translatedText: parsedPayload.translatedText,
        detectedLanguage: parsedPayload.detectedLanguage,
      };
      this.setCachedValue(this.translateCache, cacheKey, response);
      return response;
    }

    const fallbackResponse: TranslateArticleResponseDto = {
      articleId: article.id,
      translatedText: generatedText,
      detectedLanguage: sourceLanguage || 'unknown',
    };

    this.setCachedValue(this.translateCache, cacheKey, fallbackResponse);
    return fallbackResponse;
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
    updatedAt: Date;
  }> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        content: true,
        updatedAt: true,
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

  private getCacheTtlMs(): number {
    const ttlSec = Number(process.env.AI_CACHE_TTL_SEC || '300');
    if (Number.isNaN(ttlSec) || ttlSec <= 0) {
      return 300_000;
    }

    return ttlSec * 1000;
  }

  private buildSummarizeCacheKey(
    articleId: string,
    maxLength: SummaryLength,
    updatedAt: Date,
  ): string {
    return `summarize:${articleId}:${maxLength}:${updatedAt.toISOString()}`;
  }

  private buildTranslateCacheKey(
    articleId: string,
    targetLanguage: string,
    sourceLanguage: string | undefined,
    updatedAt: Date,
  ): string {
    const source = sourceLanguage || 'auto';
    return `translate:${articleId}:${targetLanguage}:${source}:${updatedAt.toISOString()}`;
  }

  private getCachedValue<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
  ): T | null {
    const existing = cache.get(key);
    if (!existing) {
      return null;
    }

    if (existing.expiresAt <= Date.now()) {
      cache.delete(key);
      return null;
    }

    return existing.value;
  }

  private setCachedValue<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    value: T,
  ): void {
    this.pruneExpiredEntries(cache);
    cache.set(key, {
      value,
      expiresAt: Date.now() + this.getCacheTtlMs(),
    });
  }

  private pruneExpiredEntries<T>(cache: Map<string, CacheEntry<T>>): void {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt <= now) {
        cache.delete(key);
      }
    }
  }
}
