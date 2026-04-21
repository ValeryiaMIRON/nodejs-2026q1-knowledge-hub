import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let authService: { verifyAccessToken: ReturnType<typeof vi.fn> };

  const createContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => 'handler',
      getClass: () => class TestClass {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    reflector = {
      getAllAndOverride: vi.fn(),
    };

    authService = {
      verifyAccessToken: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: reflector,
        },
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
  });

  it('returns true for public routes', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const result = guard.canActivate(createContext({ headers: {} }));

    expect(result).toBe(true);
    expect(authService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('throws when authorization header is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    expect(() =>
      guard.canActivate(createContext({ headers: {} })),
    ).toThrowError(
      new UnauthorizedException('Access token is missing or invalid'),
    );
  });

  it('throws when authorization header is malformed', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    expect(() =>
      guard.canActivate(
        createContext({ headers: { authorization: 'InvalidHeader' } }),
      ),
    ).toThrowError(
      new UnauthorizedException('Access token is missing or invalid'),
    );
  });

  it('sets request.user for a valid bearer token', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    const request = {
      headers: { authorization: 'Bearer valid-token' },
    } as Record<string, unknown>;

    authService.verifyAccessToken.mockReturnValue({
      userId: 'user-1',
      login: 'john',
      role: UserRole.ADMIN,
    });

    const result = guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(authService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual({
      userId: 'user-1',
      login: 'john',
      role: UserRole.ADMIN,
    });
  });

  it('propagates UnauthorizedException for expired or invalid tokens', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.verifyAccessToken.mockImplementation(() => {
      throw new UnauthorizedException('Access token is missing or invalid');
    });

    expect(() =>
      guard.canActivate(
        createContext({ headers: { authorization: 'Bearer expired-token' } }),
      ),
    ).toThrowError(
      new UnauthorizedException('Access token is missing or invalid'),
    );
  });
});
