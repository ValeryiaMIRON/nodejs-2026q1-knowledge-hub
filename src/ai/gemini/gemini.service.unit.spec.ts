import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiService } from './gemini.service';

const buildOkResponse = (text: string) => ({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue({
    candidates: [{ content: { parts: [{ text }] } }],
    usageMetadata: {
      promptTokenCount: 5,
      candidatesTokenCount: 10,
      totalTokenCount: 15,
    },
  }),
});

const buildErrorResponse = (status: number) => ({
  ok: false,
  status,
  json: vi.fn().mockResolvedValue({}),
});

describe('GeminiService', () => {
  let service: GeminiService;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = 'test-api-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [GeminiService],
    }).compile();

    service = module.get(GeminiService);
    // Silence logger in tests
    vi.spyOn(service['logger'], 'error').mockReturnValue(undefined);
    // Make all retry delays instant
    vi.spyOn(service as any, 'delay').mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // ── missing API key ───────────────────────────────────────────────────────

  it('throws InternalServerErrorException when API key is not set', async () => {
    process.env.GEMINI_API_KEY = '';

    const module: TestingModule = await Test.createTestingModule({
      providers: [GeminiService],
    }).compile();

    const noKeyService = module.get(GeminiService);

    await expect(noKeyService.generateText('hello')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  // ── auth errors ───────────────────────────────────────────────────────────

  it('throws InternalServerErrorException for 401 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildErrorResponse(401)));

    await expect(service.generateText('hello')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('throws InternalServerErrorException for 403 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildErrorResponse(403)));

    await expect(service.generateText('hello')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  // ── retryable errors ──────────────────────────────────────────────────────

  it('retries on 429 and eventually throws ServiceUnavailableException', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildErrorResponse(429));
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.generateText('hello')).rejects.toThrow(
      ServiceUnavailableException,
    );

    // maxRetries=3 means 4 total attempts (0,1,2,3)
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('retries on 500 and eventually throws ServiceUnavailableException', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildErrorResponse(500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.generateText('hello')).rejects.toThrow(
      ServiceUnavailableException,
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('succeeds on retry after transient failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(503))
      .mockResolvedValueOnce(buildOkResponse('Recovered text.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await service.generateText('hello');

    expect(result).toBe('Recovered text.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // ── network/timeout errors ────────────────────────────────────────────────

  it('retries on TypeError (network error) and throws ServiceUnavailableException', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(Object.assign(new TypeError('Failed to fetch'), {}));
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.generateText('hello')).rejects.toThrow(
      ServiceUnavailableException,
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('throws ServiceUnavailableException for AbortError (timeout)', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    const fetchMock = vi.fn().mockRejectedValue(abortErr);
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.generateText('hello')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  // ── non-retryable non-ok status ───────────────────────────────────────────

  it('throws ServiceUnavailableException for non-retryable error status (e.g. 400)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildErrorResponse(400)));

    await expect(service.generateText('hello')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  // ── empty response ────────────────────────────────────────────────────────

  it('throws ServiceUnavailableException when Gemini returns empty text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          candidates: [],
          usageMetadata: {},
        }),
      }),
    );

    await expect(service.generateText('hello')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  // ── success ───────────────────────────────────────────────────────────────

  it('returns generated text on successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(buildOkResponse('Hello!')),
    );

    const result = await service.generateText('prompt');

    expect(result).toBe('Hello!');
  });

  it('returns text and usageMetadata via generateTextWithMeta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildOkResponse('Meta!')));

    const result = await service.generateTextWithMeta('prompt');

    expect(result.text).toBe('Meta!');
    expect(result.usageMetadata?.promptTokenCount).toBe(5);
    expect(result.usageMetadata?.totalTokenCount).toBe(15);
  });
});
