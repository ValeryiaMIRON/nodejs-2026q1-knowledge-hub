import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';
import { AnalyzeTask } from './dto/analyze-article.dto';
import { SummaryLength } from './dto/summarize-article.dto';
import { GeminiService } from './gemini/gemini.service';
import { AiPromptsService } from './prompts/ai-prompts.service';

describe('AiService', () => {
  let service: AiService;

  const ARTICLE_ID = 'a0000000-0000-4000-8000-000000000001';
  const updatedAt = new Date('2025-01-01T00:00:00.000Z');

  const prismaMock = {
    article: {
      findUnique: vi.fn(),
    },
  };

  const geminiMock = {
    generateTextWithMeta: vi.fn(),
  };

  const promptsMock = {
    buildSummarizePrompt: vi.fn().mockReturnValue('summarize-prompt'),
    buildTranslatePrompt: vi.fn().mockReturnValue('translate-prompt'),
    buildAnalyzePrompt: vi.fn().mockReturnValue('analyze-prompt'),
  };

  const buildArticle = (overrides?: Record<string, unknown>) => ({
    id: ARTICLE_ID,
    content: 'Article content here.',
    updatedAt,
    ...overrides,
  });

  const buildGeneration = (text: string) => ({
    text,
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      totalTokenCount: 30,
    },
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: GeminiService, useValue: geminiMock },
        { provide: AiPromptsService, useValue: promptsMock },
      ],
    }).compile();

    service = module.get(AiService);
  });

  // ── summarizeArticle ─────────────────────────────────────────────────────

  describe('summarizeArticle', () => {
    it('throws NotFoundException when article does not exist', async () => {
      prismaMock.article.findUnique.mockResolvedValue(null);

      await expect(service.summarizeArticle(ARTICLE_ID)).rejects.toThrowError(
        new NotFoundException('Article not found'),
      );
    });

    it('calls Gemini and returns summary response on cache miss', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration('This is the summary.'),
      );

      const result = await service.summarizeArticle(
        ARTICLE_ID,
        SummaryLength.SHORT,
      );

      expect(geminiMock.generateTextWithMeta).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        articleId: ARTICLE_ID,
        summary: 'This is the summary.',
        originalLength: 'Article content here.'.length,
        summaryLength: 'This is the summary.'.length,
      });
    });

    it('returns cached result on second call with same params', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration('Cached summary.'),
      );

      const first = await service.summarizeArticle(
        ARTICLE_ID,
        SummaryLength.SHORT,
      );
      const second = await service.summarizeArticle(
        ARTICLE_ID,
        SummaryLength.SHORT,
      );

      // Gemini called only once
      expect(geminiMock.generateTextWithMeta).toHaveBeenCalledOnce();
      expect(first).toEqual(second);
    });

    it('does NOT use cache when maxLength differs', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      geminiMock.generateTextWithMeta
        .mockResolvedValueOnce(buildGeneration('Short summary.'))
        .mockResolvedValueOnce(buildGeneration('Detailed summary.'));

      await service.summarizeArticle(ARTICLE_ID, SummaryLength.SHORT);
      await service.summarizeArticle(ARTICLE_ID, SummaryLength.DETAILED);

      expect(geminiMock.generateTextWithMeta).toHaveBeenCalledTimes(2);
    });

    it('does NOT use cache when article updatedAt changes', async () => {
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration('Summary v1.'),
      );

      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      await service.summarizeArticle(ARTICLE_ID, SummaryLength.SHORT);

      prismaMock.article.findUnique.mockResolvedValue(
        buildArticle({ updatedAt: new Date('2025-06-01T00:00:00.000Z') }),
      );
      await service.summarizeArticle(ARTICLE_ID, SummaryLength.SHORT);

      expect(geminiMock.generateTextWithMeta).toHaveBeenCalledTimes(2);
    });
  });

  // ── translateArticle ──────────────────────────────────────────────────────

  describe('translateArticle', () => {
    it('throws NotFoundException when article does not exist', async () => {
      prismaMock.article.findUnique.mockResolvedValue(null);

      await expect(
        service.translateArticle(ARTICLE_ID, 'Spanish'),
      ).rejects.toThrowError(new NotFoundException('Article not found'));
    });

    it('parses structured JSON response from Gemini', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      const jsonResponse = JSON.stringify({
        translatedText: 'Hola mundo',
        detectedLanguage: 'english',
      });
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration(jsonResponse),
      );

      const result = await service.translateArticle(ARTICLE_ID, 'Spanish');

      expect(result).toEqual({
        articleId: ARTICLE_ID,
        translatedText: 'Hola mundo',
        detectedLanguage: 'english',
      });
    });

    it('returns fallback when Gemini returns non-JSON text', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration('Just plain translated text.'),
      );

      const result = await service.translateArticle(
        ARTICLE_ID,
        'Spanish',
        'english',
      );

      expect(result).toEqual({
        articleId: ARTICLE_ID,
        translatedText: 'Just plain translated text.',
        detectedLanguage: 'english',
      });
    });

    it('strips JSON fences before parsing translate response', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      const fencedJson =
        '```json\n{"translatedText":"Bonjour","detectedLanguage":"english"}\n```';
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration(fencedJson),
      );

      const result = await service.translateArticle(ARTICLE_ID, 'French');

      expect(result.translatedText).toBe('Bonjour');
    });

    it('caches translate result on second call with same params', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration(
          JSON.stringify({ translatedText: 'Hola', detectedLanguage: 'en' }),
        ),
      );

      await service.translateArticle(ARTICLE_ID, 'Spanish');
      await service.translateArticle(ARTICLE_ID, 'Spanish');

      expect(geminiMock.generateTextWithMeta).toHaveBeenCalledOnce();
    });
  });

  // ── analyzeArticle ────────────────────────────────────────────────────────

  describe('analyzeArticle', () => {
    it('throws NotFoundException when article does not exist', async () => {
      prismaMock.article.findUnique.mockResolvedValue(null);

      await expect(service.analyzeArticle(ARTICLE_ID)).rejects.toThrowError(
        new NotFoundException('Article not found'),
      );
    });

    it('parses structured JSON analysis response from Gemini', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      const jsonResponse = JSON.stringify({
        analysis: 'Good article overall.',
        suggestions: ['Add more examples', 'Fix typo in section 2'],
        severity: 'info',
      });
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration(jsonResponse),
      );

      const result = await service.analyzeArticle(
        ARTICLE_ID,
        AnalyzeTask.REVIEW,
      );

      expect(result).toEqual({
        articleId: ARTICLE_ID,
        analysis: 'Good article overall.',
        suggestions: ['Add more examples', 'Fix typo in section 2'],
        severity: 'info',
      });
    });

    it('returns fallback when Gemini returns non-JSON analyze response', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration('This is a plain analysis.'),
      );

      const result = await service.analyzeArticle(
        ARTICLE_ID,
        AnalyzeTask.REVIEW,
      );

      expect(result.articleId).toBe(ARTICLE_ID);
      expect(result.analysis).toBe('This is a plain analysis.');
      expect(result.suggestions).toEqual([
        'Model returned non-structured output',
      ]);
      expect(result.severity).toBe('info');
    });

    it('uses fallback for invalid severity value in parsed JSON', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      const jsonResponse = JSON.stringify({
        analysis: 'Good.',
        suggestions: ['Thing'],
        severity: 'critical', // not a valid severity
      });
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration(jsonResponse),
      );

      const result = await service.analyzeArticle(ARTICLE_ID);

      expect(result.severity).toBe('info');
    });
  });

  // ── generate ─────────────────────────────────────────────────────────────

  describe('generate', () => {
    it('calls Gemini with prompt and returns text', async () => {
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration('Generated output.'),
      );

      const result = await service.generate('My prompt');

      expect(geminiMock.generateTextWithMeta).toHaveBeenCalledWith('My prompt');
      expect(result).toBe('Generated output.');
    });
  });

  // ── getUsageStats ─────────────────────────────────────────────────────────

  describe('getUsageStats', () => {
    it('returns zeroed stats when no requests have been made', () => {
      const stats = service.getUsageStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.requestsByEndpoint.summarize).toBe(0);
      expect(stats.requestsByEndpoint.translate).toBe(0);
      expect(stats.requestsByEndpoint.analyze).toBe(0);
      expect(stats.requestsByEndpoint.generate).toBe(0);
      expect(stats.tokenUsage.totalTokenCount).toBe(0);
    });

    it('increments totalRequests and requestsByEndpoint after calls', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      geminiMock.generateTextWithMeta
        .mockResolvedValueOnce(buildGeneration('Summary.'))
        .mockResolvedValueOnce(buildGeneration('Generated.'));

      await service.summarizeArticle(ARTICLE_ID, SummaryLength.SHORT);
      await service.generate('prompt');

      const stats = service.getUsageStats();

      expect(stats.totalRequests).toBe(2);
      expect(stats.requestsByEndpoint.summarize).toBe(1);
      expect(stats.requestsByEndpoint.generate).toBe(1);
    });

    it('accumulates token usage across calls', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      geminiMock.generateTextWithMeta
        .mockResolvedValueOnce(buildGeneration('First.'))
        .mockResolvedValueOnce(buildGeneration('Second.'));

      await service.summarizeArticle(ARTICLE_ID, SummaryLength.SHORT);
      await service.summarizeArticle(ARTICLE_ID, SummaryLength.MEDIUM);

      const stats = service.getUsageStats();

      // Two non-cached calls: 2 × 30 tokens each
      expect(stats.tokenUsage.totalTokenCount).toBe(60);
    });

    it('tracks cache hits and misses', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration('Summary.'),
      );

      // First call → cache miss
      await service.summarizeArticle(ARTICLE_ID, SummaryLength.SHORT);
      // Second call → cache hit
      await service.summarizeArticle(ARTICLE_ID, SummaryLength.SHORT);

      const stats = service.getUsageStats();

      expect(stats.cacheByEndpoint.summarize.hits).toBe(1);
      expect(stats.cacheByEndpoint.summarize.misses).toBe(1);
    });

    it('records latency stats after a call', async () => {
      prismaMock.article.findUnique.mockResolvedValue(buildArticle());
      geminiMock.generateTextWithMeta.mockResolvedValue(
        buildGeneration('Summary.'),
      );

      await service.summarizeArticle(ARTICLE_ID, SummaryLength.SHORT);

      const stats = service.getUsageStats();

      expect(stats.latencyByEndpoint.summarize).toMatchObject({
        avgMs: expect.any(Number),
        lastMs: expect.any(Number),
      });
    });
  });
});
