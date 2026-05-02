import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeEach, expect, it } from 'vitest';
import { AnalyzeTask } from '../dto/analyze-article.dto';
import { SummaryLength } from '../dto/summarize-article.dto';
import { AiPromptsService } from './ai-prompts.service';

describe('AiPromptsService', () => {
  let service: AiPromptsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiPromptsService],
    }).compile();

    service = module.get(AiPromptsService);
  });

  // ── buildSummarizePrompt ──────────────────────────────────────────────────

  describe('buildSummarizePrompt', () => {
    it('includes the article content in the prompt', () => {
      const prompt = service.buildSummarizePrompt(
        'NestJS is a framework.',
        SummaryLength.SHORT,
      );

      expect(prompt).toContain('NestJS is a framework.');
    });

    it('includes the summary length in the prompt', () => {
      const short = service.buildSummarizePrompt(
        'content',
        SummaryLength.SHORT,
      );
      const detailed = service.buildSummarizePrompt(
        'content',
        SummaryLength.DETAILED,
      );

      expect(short).toContain(SummaryLength.SHORT);
      expect(detailed).toContain(SummaryLength.DETAILED);
    });

    it('returns a non-empty string', () => {
      const prompt = service.buildSummarizePrompt(
        'some content',
        SummaryLength.MEDIUM,
      );

      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  // ── buildTranslatePrompt ──────────────────────────────────────────────────

  describe('buildTranslatePrompt', () => {
    it('includes article content and target language', () => {
      const prompt = service.buildTranslatePrompt('Hello world', 'Spanish');

      expect(prompt).toContain('Hello world');
      expect(prompt).toContain('Spanish');
    });

    it('includes source language hint when provided', () => {
      const prompt = service.buildTranslatePrompt(
        'content',
        'French',
        'english',
      );

      expect(prompt).toContain('english');
    });

    it('uses auto-detect wording when source language is omitted', () => {
      const prompt = service.buildTranslatePrompt('content', 'German');

      expect(prompt.toLowerCase()).toContain('auto');
    });

    it('instructs model to return JSON', () => {
      const prompt = service.buildTranslatePrompt('content', 'Japanese');

      expect(prompt).toContain('JSON');
      expect(prompt).toContain('translatedText');
      expect(prompt).toContain('detectedLanguage');
    });
  });

  // ── buildAnalyzePrompt ────────────────────────────────────────────────────

  describe('buildAnalyzePrompt', () => {
    it('includes article content and task in the prompt', () => {
      const prompt = service.buildAnalyzePrompt(
        'Code snippet here.',
        AnalyzeTask.BUGS,
      );

      expect(prompt).toContain('Code snippet here.');
      expect(prompt).toContain(AnalyzeTask.BUGS);
    });

    it('instructs model to return JSON with expected schema fields', () => {
      const prompt = service.buildAnalyzePrompt('content', AnalyzeTask.REVIEW);

      expect(prompt).toContain('analysis');
      expect(prompt).toContain('suggestions');
      expect(prompt).toContain('severity');
    });

    it('produces different prompts for different tasks', () => {
      const reviewPrompt = service.buildAnalyzePrompt(
        'content',
        AnalyzeTask.REVIEW,
      );
      const optimizePrompt = service.buildAnalyzePrompt(
        'content',
        AnalyzeTask.OPTIMIZE,
      );

      expect(reviewPrompt).not.toBe(optimizePrompt);
    });
  });
});
