import { HttpStatus } from '@nestjs/common';
import { HttpErrorBase } from './http-error.base';

export class ValidationError extends HttpErrorBase {
  constructor(message = 'Validation failed') {
    super(HttpStatus.BAD_REQUEST, message);
  }
}
