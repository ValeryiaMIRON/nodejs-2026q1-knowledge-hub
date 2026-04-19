import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_KEY } from '../constants/auth.constants';

export type RateLimitOptions = {
  limit: number;
  ttlMs: number;
};

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
