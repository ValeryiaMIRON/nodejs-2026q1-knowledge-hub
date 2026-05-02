import { IsArray, IsIn, IsString, MinLength } from 'class-validator';

/**
 * Structured DTOs for validating Gemini JSON responses via class-validator.
 * Used internally by AiService.validateStructuredPayload().
 */

export class TranslatePayloadDto {
  @IsString()
  @MinLength(1)
  translatedText: string;

  @IsString()
  @MinLength(1)
  detectedLanguage: string;
}

export class AnalyzePayloadDto {
  @IsString()
  @MinLength(1)
  analysis: string;

  @IsArray()
  @IsString({ each: true })
  suggestions: string[];

  @IsIn(['info', 'warning', 'error'])
  severity: 'info' | 'warning' | 'error';
}
