import { HttpStatus } from '@nestjs/common';
import { HttpErrorBase } from './http-error.base';

export class UnauthorizedError extends HttpErrorBase {
  constructor(message = 'Unauthorized') {
    super(HttpStatus.UNAUTHORIZED, message);
  }
}
