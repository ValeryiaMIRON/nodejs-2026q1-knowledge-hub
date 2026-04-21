import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../common/enums/user-role.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

    guard = module.get(RolesGuard);
  });

  it('returns true when roles metadata is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext({}))).toBe(true);
  });

  it('returns true for admin regardless of required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.EDITOR]);

    const result = guard.canActivate(
      createContext({
        user: {
          userId: 'admin-id',
          login: 'admin',
          role: UserRole.ADMIN,
        },
      }),
    );

    expect(result).toBe(true);
  });

  it('returns true when user has a required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.EDITOR]);

    const result = guard.canActivate(
      createContext({
        user: {
          userId: 'editor-id',
          login: 'editor',
          role: UserRole.EDITOR,
        },
      }),
    );

    expect(result).toBe(true);
  });

  it('throws when user is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.VIEWER]);

    expect(() => guard.canActivate(createContext({}))).toThrowError(
      new ForbiddenException('Insufficient permissions for this operation'),
    );
  });

  it('throws when user role is insufficient', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.EDITOR]);

    expect(() =>
      guard.canActivate(
        createContext({
          user: {
            userId: 'viewer-id',
            login: 'viewer',
            role: UserRole.VIEWER,
          },
        }),
      ),
    ).toThrowError(
      new ForbiddenException('Insufficient permissions for this operation'),
    );
  });
});
