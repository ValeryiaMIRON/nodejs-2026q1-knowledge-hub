import { Injectable } from '@nestjs/common';
import { GeminiService } from './gemini/gemini.service';
import { AiPromptsService } from './prompts/ai-prompts.service';

@Injectable()
export class AiService {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly promptsService: AiPromptsService,
  ) {}

  async summarizeArticle(
    articleContent: string,
    maxLength: 'short' | 'medium' | 'detailed' = 'medium',
  ): Promise<string> {
    const prompt = this.promptsService.buildSummarizePrompt(
      articleContent,
      maxLength,
    );
    return this.geminiService.generateText(prompt);
  }

  async translateArticle(
    articleContent: string,
    targetLanguage: string,
    sourceLanguage?: string,
  ): Promise<string> {
    const prompt = this.promptsService.buildTranslatePrompt(
      articleContent,
      targetLanguage,
      sourceLanguage,
    );
    return this.geminiService.generateText(prompt);
  }

  async analyzeArticle(
    articleContent: string,
    task: 'review' | 'bugs' | 'optimize' | 'explain' = 'review',
  ): Promise<string> {
    const prompt = this.promptsService.buildAnalyzePrompt(articleContent, task);
    return this.geminiService.generateText(prompt);
  }

  async generate(prompt: string): Promise<string> {
    return this.geminiService.generateText(prompt);
  }
}
