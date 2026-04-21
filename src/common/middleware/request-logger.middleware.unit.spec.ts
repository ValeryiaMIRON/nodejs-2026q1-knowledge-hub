import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RequestLoggerMiddleware } from './request-logger.middleware';

describe('RequestLoggerMiddleware', () => {
  it('logs request method and url then calls next', () => {
    const middleware = new RequestLoggerMiddleware();
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const next = vi.fn();

    middleware.use(
      { method: 'GET', originalUrl: '/health' } as never,
      {} as never,
      next,
    );

    expect(logSpy).toHaveBeenCalledWith('GET /health');
    expect(next).toHaveBeenCalledOnce();
  });
});
