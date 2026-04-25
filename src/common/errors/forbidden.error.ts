import { HttpStatus } from '@nestjs/common';
import { HttpErrorBase } from './http-error.base';

export class ForbiddenError extends HttpErrorBase {
  constructor(message = 'Forbidden') {
    super(HttpStatus.FORBIDDEN, message);
  }
}
