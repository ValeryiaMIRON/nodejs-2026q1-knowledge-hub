import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { STATUS_CODES } from 'http';
import { HttpErrorBase } from '../errors/http-error.base';

type ErrorPayload = {
  statusCode: number;
  error: string;
  message: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logException(exception);

    if (exception instanceof HttpErrorBase) {
      response
        .status(exception.statusCode)
        .json(this.buildPayload(exception.statusCode, exception.message));
      return;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message = this.extractHttpExceptionMessage(exceptionResponse);

      response.status(statusCode).json(this.buildPayload(statusCode, message));
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  }

  private buildPayload(statusCode: number, message: string): ErrorPayload {
    return {
      statusCode,
      error: STATUS_CODES[statusCode] || 'Error',
      message,
    };
  }

  private extractHttpExceptionMessage(response: unknown): string {
    if (typeof response === 'string') {
      return response;
    }

    if (response && typeof response === 'object') {
      const responseObject = response as {
        message?: string | string[];
      };

      if (Array.isArray(responseObject.message)) {
        return responseObject.message.join(', ');
      }

      if (typeof responseObject.message === 'string') {
        return responseObject.message;
      }
    }

    return 'Request failed';
  }

  private logException(exception: unknown): void {
    if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      return;
    }

    this.logger.error(`Unhandled exception: ${JSON.stringify(exception)}`);
  }
}
