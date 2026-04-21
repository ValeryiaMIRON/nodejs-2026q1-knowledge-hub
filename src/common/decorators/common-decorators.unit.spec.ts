import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  IS_PUBLIC_KEY,
  RATE_LIMIT_KEY,
  ROLES_KEY,
} from '../constants/auth.constants';
import { UserRole } from '../enums/user-role.enum';
import { Public } from './public.decorator';
import { RateLimit } from './rate-limit.decorator';
import { Roles } from './roles.decorator';

describe('common decorators', () => {
  it('Public sets public metadata', () => {
    class TestClass {
      test(): void {}
    }

    Public()(
      TestClass.prototype,
      'test',
      Object.getOwnPropertyDescriptor(TestClass.prototype, 'test')!,
    );

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, TestClass.prototype.test)).toBe(
      true,
    );
  });

  it('Roles sets role metadata', () => {
    class TestClass {
      test(): void {}
    }

    Roles(UserRole.ADMIN, UserRole.EDITOR)(
      TestClass.prototype,
      'test',
      Object.getOwnPropertyDescriptor(TestClass.prototype, 'test')!,
    );

    expect(Reflect.getMetadata(ROLES_KEY, TestClass.prototype.test)).toEqual([
      UserRole.ADMIN,
      UserRole.EDITOR,
    ]);
  });

  it('RateLimit sets rate limit metadata', () => {
    class TestClass {
      test(): void {}
    }

    RateLimit({ limit: 5, ttlMs: 60_000 })(
      TestClass.prototype,
      'test',
      Object.getOwnPropertyDescriptor(TestClass.prototype, 'test')!,
    );

    expect(
      Reflect.getMetadata(RATE_LIMIT_KEY, TestClass.prototype.test),
    ).toEqual({
      limit: 5,
      ttlMs: 60_000,
    });
  });
});
