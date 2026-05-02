import { Injectable } from '@nestjs/common';

@Injectable()
export class AiPromptsService {
  buildSummarizePrompt(
    articleContent: string,
    maxLength: 'short' | 'medium' | 'detailed',
  ): string {
    return [
      'You are a technical editor.',
      `Summarize the following article in ${maxLength} format.`,
      'Return only plain text summary without markdown.',
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
      'Return only translated text without commentary.',
      '',
      articleContent,
    ].join('\n');
  }

  buildAnalyzePrompt(
    articleContent: string,
    task: 'review' | 'bugs' | 'optimize' | 'explain',
  ): string {
    return [
      'You are a senior software reviewer.',
      `Analyze the article content with focus on: ${task}.`,
      'Provide concise findings and practical recommendations.',
      '',
      articleContent,
    ].join('\n');
  }
}
