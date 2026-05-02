import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GeminiGenerateContentResponse,
  GeminiGenerateTextResult,
} from './gemini.types';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey = process.env.GEMINI_API_KEY || '';
  private readonly baseUrl =
    process.env.GEMINI_API_BASE_URL ||
    'https://generativelanguage.googleapis.com';
  private readonly model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  private readonly timeoutMs = 15000;
  private readonly maxRetries = 3;
  private readonly initialRetryDelayMs = 200;

  async generateText(prompt: string): Promise<string> {
    const result = await this.generateTextWithMeta(prompt);
    return result.text;
  }

  async generateTextWithMeta(
    prompt: string,
  ): Promise<GeminiGenerateTextResult> {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'Gemini API key is not configured',
      );
    }

    const url = this.buildGenerateContentUrl();
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (response.status === 401 || response.status === 403) {
          this.logger.error(
            `Gemini authentication failed with status ${response.status}`,
          );
          throw new InternalServerErrorException(
            'AI provider authentication failed',
          );
        }

        if (this.isRetryableStatus(response.status)) {
          lastError = new ServiceUnavailableException(
            'AI provider temporarily unavailable',
          );

          if (attempt < this.maxRetries) {
            await this.delay(this.getRetryDelayMs(attempt));
            continue;
          }

          break;
        }

        if (!response.ok) {
          this.logger.error(
            `Gemini request failed with status ${response.status}`,
          );
          throw new ServiceUnavailableException(
            'AI service is temporarily unavailable',
          );
        }

        const payload =
          (await response.json()) as GeminiGenerateContentResponse;
        const generatedText = this.extractText(payload);

        if (!generatedText) {
          throw new ServiceUnavailableException(
            'AI service returned empty response',
          );
        }

        return {
          text: generatedText,
          usageMetadata: payload.usageMetadata,
        };
      } catch (error: unknown) {
        if (error instanceof InternalServerErrorException) {
          throw error;
        }

        if (this.isNetworkOrTimeoutError(error)) {
          this.logger.error(
            'Gemini request failed due to network or timeout error',
            error instanceof Error ? error.stack : undefined,
          );

          if (attempt < this.maxRetries) {
            await this.delay(this.getRetryDelayMs(attempt));
            continue;
          }

          throw new ServiceUnavailableException(
            'AI service is temporarily unavailable',
          );
        }

        if (error instanceof ServiceUnavailableException) {
          if (attempt < this.maxRetries) {
            await this.delay(this.getRetryDelayMs(attempt));
            continue;
          }
          throw error;
        }

        this.logger.error(
          'Unexpected Gemini integration error',
          error instanceof Error ? error.stack : undefined,
        );
        throw new ServiceUnavailableException(
          'AI service is temporarily unavailable',
        );
      }
    }

    this.logger.error(
      'Gemini request failed after retries',
      lastError instanceof Error ? lastError.stack : undefined,
    );
    throw new ServiceUnavailableException(
      'AI service is temporarily unavailable',
    );
  }

  private buildGenerateContentUrl(): string {
    const trimmedBaseUrl = this.baseUrl.replace(/\/+$/, '');
    const encodedModel = encodeURIComponent(this.model);
    const encodedKey = encodeURIComponent(this.apiKey);

    return `${trimmedBaseUrl}/v1beta/models/${encodedModel}:generateContent?key=${encodedKey}`;
  }

  private extractText(payload: GeminiGenerateContentResponse): string {
    return payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  }

  private isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private isNetworkOrTimeoutError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      error.name === 'TypeError'
    );
  }

  private getRetryDelayMs(attempt: number): number {
    return this.initialRetryDelayMs * Math.pow(2, attempt);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
