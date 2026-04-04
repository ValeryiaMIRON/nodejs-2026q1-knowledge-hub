import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction): void {
    this.logger.log(`${req.method} ${req.originalUrl}`);
    next();
  }
}
