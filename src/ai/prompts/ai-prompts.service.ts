import { Injectable } from '@nestjs/common';
import { AnalyzeTask } from '../dto/analyze-article.dto';
import { SummaryLength } from '../dto/summarize-article.dto';

@Injectable()
export class AiPromptsService {
  buildSummarizePrompt(
    articleContent: string,
    maxLength: SummaryLength,
  ): string {
    return [
      'You are a technical editor.',
      `Summarize the following article in ${maxLength} format.`,
      'Return only plain text summary without markdown.',
      '',
      articleContent,
    ].join('\n');
  }

  buildAnalyzePrompt(articleContent: string, task: AnalyzeTask): string {
    return [
      'You are a senior software reviewer.',
      `Analyze the article content with focus on: ${task}.`,
      'Return strictly valid JSON with this schema:',
      '{"analysis":"string","suggestions":["string"],"severity":"info|warning|error"}',
      'Do not include markdown fences or extra text.',
      '',
      articleContent,
    ].join('\n');
  }

  buildTranslatePrompt(
    articleContent: string,
    targetLanguage: string,
    sourceLanguage?: string,
  ): string {
    const sourceHint = sourceLanguage
      ? `Source language is ${sourceLanguage}.`
      : 'Detect source language automatically.';

    return [
      'You are a professional technical translator.',
      sourceHint,
      `Translate the text to ${targetLanguage}.`,
      'Return strictly valid JSON with this schema:',
      '{"translatedText":"string","detectedLanguage":"string"}',
      'Do not include markdown fences or extra text.',
      '',
      articleContent,
    ].join('\n');
  }
}
