import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RequestLoggerMiddleware } from './request-logger.middleware';

describe('RequestLoggerMiddleware', () => {
  it('logs request and response then calls next', () => {
    const middleware = new RequestLoggerMiddleware();
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const next = vi.fn();
    const req = {
      method: 'GET',
      originalUrl: '/health',
      query: {},
      body: {},
    } as never;
    const res = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') {
          cb();
        }
      }),
    } as never;

    middleware.use(req, res, next);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Incoming GET /health'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Outgoing GET /health status=200 responseTimeMs=',
      ),
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
