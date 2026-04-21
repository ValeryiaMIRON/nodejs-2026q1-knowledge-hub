import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

describe('ParseUUIDPipe', () => {
  const pipe = new ParseUUIDPipe({ version: '4' });

  it('passes through a valid UUID v4', async () => {
    const value = '550e8400-e29b-41d4-a716-446655440000';

    await expect(pipe.transform(value, {} as never)).resolves.toBe(value);
  });

  it('throws BadRequestException for an invalid UUID', async () => {
    await expect(
      pipe.transform('not-a-uuid', {} as never),
    ).rejects.toThrowError(BadRequestException);
  });
});
