import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiRateLimitGuard } from './ai-rate-limit.guard';

describe('AiRateLimitGuard', () => {
  let guard: AiRateLimitGuard;

  const originalEnv = { ...process.env };

  const mockResponse = {
    setHeader: vi.fn(),
  };

  const createContext = (
    ip?: string,
    forwardedFor?: string,
  ): ExecutionContext =>
    ({
      getHandler: () => 'handler',
      getClass: () => class TestClass {},
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          path: '/ai/articles/some-id/summarize',
          route: { path: '/ai/articles/:articleId/summarize' },
          ip: ip || '127.0.0.1',
          headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
          socket: {},
        }),
        getResponse: () => mockResponse,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AiRateLimitGuard],
    }).compile();

    guard = module.get(AiRateLimitGuard);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns true when THROTTLE_DISABLED is set to 1', () => {
    process.env.THROTTLE_DISABLED = '1';

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows first request below limit', () => {
    process.env.AI_RATE_LIMIT_RPM = '5';

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows multiple requests below the limit', () => {
    process.env.AI_RATE_LIMIT_RPM = '3';

    expect(guard.canActivate(createContext())).toBe(true);
    expect(guard.canActivate(createContext())).toBe(true);
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('throws 429 when rate limit is exceeded', () => {
    process.env.AI_RATE_LIMIT_RPM = '2';

    guard.canActivate(createContext());
    guard.canActivate(createContext());

    expect(() => guard.canActivate(createContext())).toThrowError(
      new HttpException(
        'Too many AI requests. Please retry later.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  });

  it('sets Retry-After header when rate limit is exceeded', () => {
    process.env.AI_RATE_LIMIT_RPM = '1';

    guard.canActivate(createContext());

    try {
      guard.canActivate(createContext());
    } catch {
      // expected
    }

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.any(String),
    );
  });

  it('uses x-forwarded-for as tracker key', () => {
    process.env.AI_RATE_LIMIT_RPM = '1';

    // Request from forwarded IP 10.0.0.1 - first request, allowed
    guard.canActivate(createContext('127.0.0.1', '10.0.0.1, 10.0.0.2'));
    // Second request from same forwarded IP should be blocked
    expect(() =>
      guard.canActivate(createContext('127.0.0.1', '10.0.0.1, 10.0.0.2')),
    ).toThrow();
  });

  it('tracks different IPs independently', () => {
    process.env.AI_RATE_LIMIT_RPM = '1';

    // Two different IPs can each make one request
    expect(guard.canActivate(createContext('1.2.3.4'))).toBe(true);
    expect(guard.canActivate(createContext('5.6.7.8'))).toBe(true);
  });

  it('resets count after window expires', () => {
    process.env.AI_RATE_LIMIT_RPM = '1';
    const nowSpy = vi.spyOn(Date, 'now');

    // At t=0 first request is allowed
    nowSpy.mockReturnValue(0);
    expect(guard.canActivate(createContext())).toBe(true);

    // At t=0+epsilon second request is blocked
    nowSpy.mockReturnValue(100);
    expect(() => guard.canActivate(createContext())).toThrow();

    // After window (60s+) request resets and is allowed again
    nowSpy.mockReturnValue(61_000);
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('falls back to default limit of 20 for invalid AI_RATE_LIMIT_RPM', () => {
    process.env.AI_RATE_LIMIT_RPM = 'not-a-number';

    // Should not throw for first 20 requests
    for (let i = 0; i < 20; i++) {
      expect(guard.canActivate(createContext())).toBe(true);
    }

    expect(() => guard.canActivate(createContext())).toThrow();
  });
});
