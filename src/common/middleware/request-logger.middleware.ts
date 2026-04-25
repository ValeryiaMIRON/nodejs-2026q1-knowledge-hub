import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

type JsonLike =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: JsonLike }
  | JsonLike[];

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    const sanitizedBody = this.sanitize(req.body);

    if (this.isProduction()) {
      this.logger.log(
        JSON.stringify({
          event: 'incoming_request',
          method: req.method,
          url: req.originalUrl,
          query: req.query,
          body: sanitizedBody,
        }),
      );
    } else {
      this.logger.log(
        `Incoming ${req.method} ${req.originalUrl} query=${JSON.stringify(
          req.query,
        )} body=${JSON.stringify(sanitizedBody)}`,
      );
    }

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const duration = Number(durationMs.toFixed(2));

      if (this.isProduction()) {
        this.logger.log(
          JSON.stringify({
            event: 'outgoing_response',
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTimeMs: duration,
          }),
        );
      } else {
        this.logger.log(
          `Outgoing ${req.method} ${req.originalUrl} status=${res.statusCode} responseTimeMs=${duration}`,
        );
      }
    });

    next();
  }

  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private sanitize(value: JsonLike): JsonLike {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value !== null && typeof value === 'object') {
      const source = value as Record<string, JsonLike>;
      const result: Record<string, JsonLike> = {};

      for (const [key, val] of Object.entries(source)) {
        if (this.isSensitiveKey(key)) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.sanitize(val);
        }
      }

      return result;
    }

    return value;
  }

  private isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return (
      normalized.includes('password') ||
      normalized.includes('token') ||
      normalized === 'authorization'
    );
  }
}
