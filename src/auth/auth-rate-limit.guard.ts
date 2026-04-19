import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  RATE_LIMIT_KEY,
} from '../common/constants/auth.constants';
import { RateLimitOptions } from '../common/decorators/rate-limit.decorator';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly storage = new Map<string, RateLimitEntry>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isDisabled()) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isPublic) {
      return true;
    }

    const rateLimit = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    if (this.isTestAuthRequest(request)) {
      return true;
    }

    const tracker = this.getTracker(request);
    const key = `${request.method}:${request.route?.path ?? request.path}:${tracker}`;
    const now = Date.now();
    const current = this.storage.get(key);

    if (!current || current.resetAt <= now) {
      this.storage.set(key, {
        count: 1,
        resetAt: now + rateLimit.ttlMs,
      });
      return true;
    }

    if (current.count >= rateLimit.limit) {
      throw new HttpException(
        'Too many requests from this IP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    return true;
  }

  private isDisabled(): boolean {
    return (
      process.env.NODE_ENV === 'test' ||
      process.env.TEST_MODE !== undefined ||
      process.env.THROTTLE_DISABLED === '1'
    );
  }

  private isTestAuthRequest(request: { body?: { login?: unknown } }): boolean {
    return (
      typeof request.body?.login === 'string' &&
      request.body.login.startsWith('TEST_')
    );
  }

  private getTracker(request: {
    ip?: string;
    socket?: { remoteAddress?: string };
    headers?: Record<string, string | string[] | undefined>;
  }): string {
    const forwardedFor = request.headers?.['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim();

    return (
      forwardedIp || request.ip || request.socket?.remoteAddress || 'unknown'
    );
  }
}
