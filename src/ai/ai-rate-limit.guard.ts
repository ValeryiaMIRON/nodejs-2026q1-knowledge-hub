import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly storage = new Map<string, RateLimitEntry>();
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    if (process.env.THROTTLE_DISABLED === '1') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const limit = this.resolveLimit();
    const tracker = this.getTracker(request);
    const key = `${request.method}:${request.route?.path ?? request.path}:${tracker}`;
    const now = Date.now();
    const current = this.storage.get(key);

    if (!current || current.resetAt <= now) {
      this.storage.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    if (current.count >= limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );
      response.setHeader('Retry-After', String(retryAfterSeconds));
      throw new HttpException(
        'Too many AI requests. Please retry later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    return true;
  }

  private resolveLimit(): number {
    const raw = Number(process.env.AI_RATE_LIMIT_RPM || '20');
    if (Number.isNaN(raw) || raw <= 0) {
      return 20;
    }

    return raw;
  }

  private getTracker(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim();

    return (
      forwardedIp || request.ip || request.socket?.remoteAddress || 'unknown'
    );
  }
}
