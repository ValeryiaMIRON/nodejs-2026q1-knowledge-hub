import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

describe('AuthRateLimitGuard', () => {
  let guard: AuthRateLimitGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  const originalEnv = { ...process.env };

  const createContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => 'handler',
      getClass: () => class TestClass {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'development';

    reflector = {
      getAllAndOverride: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthRateLimitGuard,
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get(AuthRateLimitGuard);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('returns true when throttling is disabled by TEST_MODE', () => {
    process.env.TEST_MODE = 'auth';

    expect(guard.canActivate(createContext({ headers: {} }))).toBe(true);
  });

  it('returns true for non-public routes', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false);

    expect(guard.canActivate(createContext({ headers: {} }))).toBe(true);
  });

  it('returns true when no rate limit metadata exists', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(undefined);

    expect(guard.canActivate(createContext({ headers: {} }))).toBe(true);
  });

  it('bypasses test auth requests with TEST_ login', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(true)
      .mockReturnValueOnce({ limit: 1, ttlMs: 1000 });

    expect(
      guard.canActivate(
        createContext({
          body: { login: 'TEST_AUTH_LOGIN' },
          headers: {},
          method: 'POST',
          path: '/auth/login',
        }),
      ),
    ).toBe(true);
  });

  it('allows requests below the limit', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(true)
      .mockReturnValueOnce({ limit: 2, ttlMs: 1000 });

    const request = {
      headers: {},
      method: 'POST',
      path: '/auth/login',
      route: { path: '/auth/login' },
      ip: '127.0.0.1',
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
  });

  it('throws 429 when limit is exceeded', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(true)
      .mockReturnValueOnce({ limit: 1, ttlMs: 1000 })
      .mockReturnValueOnce(true)
      .mockReturnValueOnce({ limit: 1, ttlMs: 1000 });

    const request = {
      headers: {},
      method: 'POST',
      path: '/auth/login',
      route: { path: '/auth/login' },
      ip: '127.0.0.1',
    };

    guard.canActivate(createContext(request));

    expect(() => guard.canActivate(createContext(request))).toThrowError(
      new HttpException(
        'Too many requests from this IP',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  });

  it('uses x-forwarded-for as tracker when present', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(3000);

    reflector.getAllAndOverride
      .mockReturnValueOnce(true)
      .mockReturnValueOnce({ limit: 1, ttlMs: 1000 })
      .mockReturnValueOnce(true)
      .mockReturnValueOnce({ limit: 1, ttlMs: 1000 });

    const request = {
      headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
      method: 'POST',
      path: '/auth/signup',
      route: { path: '/auth/signup' },
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
    expect(guard.canActivate(createContext(request))).toBe(true);
  });
});
