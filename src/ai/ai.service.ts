import { Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyzeTask } from './dto/analyze-article.dto';
import {
  AnalyzeArticleResponseDto,
  SummarizeArticleResponseDto,
  TranslateArticleResponseDto,
} from './dto/ai-response.dto';
import {
  AnalyzePayloadDto,
  TranslatePayloadDto,
} from './dto/ai-structured-payloads.dto';
import { AiUsageResponseDto } from './dto/ai-usage-response.dto';
import { SummaryLength } from './dto/summarize-article.dto';
import { GeminiService } from './gemini/gemini.service';
import { AiPromptsService } from './prompts/ai-prompts.service';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type AiEndpoint = 'summarize' | 'translate' | 'analyze' | 'generate';

type LatencyStats = {
  count: number;
  totalMs: number;
  lastMs: number;
};

type CacheStats = {
  hits: number;
  misses: number;
};

type RequestLogEntry = {
  timestamp: number;
  endpoint: string;
  durationMs: number;
  success: boolean;
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
  private totalRequests = 0;
  private readonly requestsByEndpoint: Record<AiEndpoint, number> = {
    summarize: 0,
    translate: 0,
    analyze: 0,
    generate: 0,
  };
  private readonly latencyByEndpoint: Record<AiEndpoint, LatencyStats> = {
    summarize: { count: 0, totalMs: 0, lastMs: 0 },
    translate: { count: 0, totalMs: 0, lastMs: 0 },
    analyze: { count: 0, totalMs: 0, lastMs: 0 },
    generate: { count: 0, totalMs: 0, lastMs: 0 },
  };
  private readonly cacheByEndpoint: Record<
    'summarize' | 'translate',
    CacheStats
  > = {
    summarize: { hits: 0, misses: 0 },
    translate: { hits: 0, misses: 0 },
  };
  private tokenUsage = {
    promptTokenCount: 0,
    candidatesTokenCount: 0,
    totalTokenCount: 0,
  };
  private readonly serviceStartedAt = Date.now();
  private readonly errorsByEndpoint: Record<AiEndpoint, number> = {
    summarize: 0,
    translate: 0,
    analyze: 0,
    generate: 0,
  };
  private readonly latencyWindowByEndpoint: Record<AiEndpoint, number[]> = {
    summarize: [],
    translate: [],
    analyze: [],
    generate: [],
  };
  private readonly recentRequests: RequestLogEntry[] = [];
  private readonly LATENCY_WINDOW_SIZE = 100;
  private readonly RECENT_REQUESTS_LIMIT = 20;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly promptsService: AiPromptsService,
  ) {}

  async summarizeArticle(
    articleId: string,
    maxLength: SummaryLength = SummaryLength.MEDIUM,
  ): Promise<SummarizeArticleResponseDto> {
    const startedAt = this.markRequestStarted('summarize');
    let succeeded = false;
    try {
      const article = await this.getArticleOrFail(articleId);
      const cacheKey = this.buildSummarizeCacheKey(
        article.id,
        maxLength,
        article.updatedAt,
      );
      const cached = this.getCachedValue(this.summarizeCache, cacheKey);
      if (cached) {
        this.cacheByEndpoint.summarize.hits += 1;
        succeeded = true;
        return cached;
      }
      this.cacheByEndpoint.summarize.misses += 1;

      const prompt = this.promptsService.buildSummarizePrompt(
        article.content,
        maxLength,
      );
      const generation = await this.geminiService.generateTextWithMeta(prompt);
      const summary = generation.text;
      this.recordTokenUsage(generation.usageMetadata);

      const response: SummarizeArticleResponseDto = {
        articleId: article.id,
        summary,
        originalLength: article.content.length,
        summaryLength: summary.length,
      };

      this.setCachedValue(this.summarizeCache, cacheKey, response);
      succeeded = true;
      return response;
    } finally {
      this.markRequestFinished('summarize', startedAt, succeeded);
    }
  }

  async translateArticle(
    articleId: string,
    targetLanguage: string,
    sourceLanguage?: string,
  ): Promise<TranslateArticleResponseDto> {
    const startedAt = this.markRequestStarted('translate');
    let succeeded = false;
    try {
      const article = await this.getArticleOrFail(articleId);
      const cacheKey = this.buildTranslateCacheKey(
        article.id,
        targetLanguage,
        sourceLanguage,
        article.updatedAt,
      );
      const cached = this.getCachedValue(this.translateCache, cacheKey);
      if (cached) {
        this.cacheByEndpoint.translate.hits += 1;
        succeeded = true;
        return cached;
      }
      this.cacheByEndpoint.translate.misses += 1;

      const prompt = this.promptsService.buildTranslatePrompt(
        article.content,
        targetLanguage,
        sourceLanguage,
      );
      const generation = await this.geminiService.generateTextWithMeta(prompt);
      const generatedText = generation.text;
      this.recordTokenUsage(generation.usageMetadata);

      const validated = this.validateStructuredPayload(
        generatedText,
        TranslatePayloadDto,
      );

      if (validated) {
        const response: TranslateArticleResponseDto = {
          articleId: article.id,
          translatedText: validated.translatedText,
          detectedLanguage: validated.detectedLanguage,
        };
        this.setCachedValue(this.translateCache, cacheKey, response);
        succeeded = true;
        return response;
      }

      const fallbackResponse: TranslateArticleResponseDto = {
        articleId: article.id,
        translatedText: generatedText,
        detectedLanguage: sourceLanguage || 'unknown',
      };

      this.setCachedValue(this.translateCache, cacheKey, fallbackResponse);
      succeeded = true;
      return fallbackResponse;
    } finally {
      this.markRequestFinished('translate', startedAt, succeeded);
    }
  }

  async analyzeArticle(
    articleId: string,
    task: AnalyzeTask = AnalyzeTask.REVIEW,
  ): Promise<AnalyzeArticleResponseDto> {
    const startedAt = this.markRequestStarted('analyze');
    let succeeded = false;
    try {
      const article = await this.getArticleOrFail(articleId);
      const prompt = this.promptsService.buildAnalyzePrompt(
        article.content,
        task,
      );
      const generation = await this.geminiService.generateTextWithMeta(prompt);
      const generatedText = generation.text;
      this.recordTokenUsage(generation.usageMetadata);

      const validated = this.validateStructuredPayload(
        generatedText,
        AnalyzePayloadDto,
      );

      succeeded = true;

      if (validated) {
        return {
          articleId: article.id,
          analysis: validated.analysis,
          suggestions: validated.suggestions,
          severity: validated.severity,
        };
      }

      return {
        articleId: article.id,
        analysis: generatedText,
        suggestions: ['Model returned non-structured output'],
        severity: 'info',
      };
    } finally {
      this.markRequestFinished('analyze', startedAt, succeeded);
    }
  }

  async generate(prompt: string): Promise<string> {
    const startedAt = this.markRequestStarted('generate');
    let succeeded = false;
    try {
      const generation = await this.geminiService.generateTextWithMeta(prompt);
      this.recordTokenUsage(generation.usageMetadata);
      succeeded = true;
      return generation.text;
    } finally {
      this.markRequestFinished('generate', startedAt, succeeded);
    }
  }

  getUsageStats(): AiUsageResponseDto {
    return {
      totalRequests: this.totalRequests,
      requestsByEndpoint: {
        summarize: this.requestsByEndpoint.summarize,
        translate: this.requestsByEndpoint.translate,
        analyze: this.requestsByEndpoint.analyze,
        generate: this.requestsByEndpoint.generate,
      },
      errorsByEndpoint: {
        summarize: this.errorsByEndpoint.summarize,
        translate: this.errorsByEndpoint.translate,
        analyze: this.errorsByEndpoint.analyze,
        generate: this.errorsByEndpoint.generate,
      },
      latencyByEndpoint: {
        summarize: this.toLatencyResponse(this.latencyByEndpoint.summarize),
        translate: this.toLatencyResponse(this.latencyByEndpoint.translate),
        analyze: this.toLatencyResponse(this.latencyByEndpoint.analyze),
        generate: this.toLatencyResponse(this.latencyByEndpoint.generate),
      },
      p95LatencyByEndpoint: {
        summarize: this.computeP95(this.latencyWindowByEndpoint.summarize),
        translate: this.computeP95(this.latencyWindowByEndpoint.translate),
        analyze: this.computeP95(this.latencyWindowByEndpoint.analyze),
        generate: this.computeP95(this.latencyWindowByEndpoint.generate),
      },
      cacheByEndpoint: {
        summarize: this.toCacheResponse(this.cacheByEndpoint.summarize),
        translate: this.toCacheResponse(this.cacheByEndpoint.translate),
      },
      tokenUsage: {
        promptTokenCount: this.tokenUsage.promptTokenCount,
        candidatesTokenCount: this.tokenUsage.candidatesTokenCount,
        totalTokenCount: this.tokenUsage.totalTokenCount,
      },
      recentRequests: [...this.recentRequests],
      uptimeMs: Date.now() - this.serviceStartedAt,
    };
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

  private computeP95(window: number[]): number {
    if (window.length === 0) return 0;
    const sorted = [...window].sort((a, b) => a - b);
    const idx = Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1);
    return Number((sorted[idx] ?? 0).toFixed(2));
  }

  private validateStructuredPayload<T extends object>(
    rawText: string,
    cls: new () => T,
  ): T | null {
    const plain = this.parseJsonPayload<Record<string, unknown>>(rawText);
    if (!plain || typeof plain !== 'object') return null;
    const instance = plainToInstance(cls, plain);
    const errors = validateSync(instance as object);
    return errors.length === 0 ? instance : null;
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

  private markRequestStarted(endpoint: AiEndpoint): number {
    this.totalRequests += 1;
    this.requestsByEndpoint[endpoint] += 1;
    return Date.now();
  }

  private markRequestFinished(
    endpoint: AiEndpoint,
    startedAt: number,
    succeeded = true,
  ): void {
    const elapsedMs = Date.now() - startedAt;
    const stats = this.latencyByEndpoint[endpoint];
    stats.count += 1;
    stats.totalMs += elapsedMs;
    stats.lastMs = elapsedMs;

    const window = this.latencyWindowByEndpoint[endpoint];
    window.push(elapsedMs);
    if (window.length > this.LATENCY_WINDOW_SIZE) {
      window.shift();
    }

    if (!succeeded) {
      this.errorsByEndpoint[endpoint] += 1;
    }

    const entry: RequestLogEntry = {
      timestamp: Date.now(),
      endpoint,
      durationMs: elapsedMs,
      success: succeeded,
    };
    this.recentRequests.push(entry);
    if (this.recentRequests.length > this.RECENT_REQUESTS_LIMIT) {
      this.recentRequests.shift();
    }
  }

  private toLatencyResponse(stats: LatencyStats): {
    avgMs: number;
    lastMs: number;
  } {
    if (stats.count === 0) {
      return { avgMs: 0, lastMs: 0 };
    }

    return {
      avgMs: Number((stats.totalMs / stats.count).toFixed(2)),
      lastMs: Number(stats.lastMs.toFixed(2)),
    };
  }

  private toCacheResponse(stats: CacheStats): {
    hits: number;
    misses: number;
    hitRatio: number;
  } {
    const total = stats.hits + stats.misses;
    const hitRatio = total === 0 ? 0 : Number((stats.hits / total).toFixed(4));

    return {
      hits: stats.hits,
      misses: stats.misses,
      hitRatio,
    };
  }

  private recordTokenUsage(metadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  }): void {
    if (!metadata) {
      return;
    }

    this.tokenUsage.promptTokenCount += metadata.promptTokenCount || 0;
    this.tokenUsage.candidatesTokenCount += metadata.candidatesTokenCount || 0;
    this.tokenUsage.totalTokenCount += metadata.totalTokenCount || 0;
  }
}
