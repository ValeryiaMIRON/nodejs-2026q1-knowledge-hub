import { HttpStatus } from '@nestjs/common';
import { HttpErrorBase } from './http-error.base';

export class NotFoundError extends HttpErrorBase {
  constructor(message = 'Resource not found') {
    super(HttpStatus.NOT_FOUND, message);
  }
}
