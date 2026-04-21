import { describe, expect, it } from 'vitest';
import { AppService } from './app.service';

describe('AppService', () => {
  it('returns hello world message', () => {
    expect(new AppService().getHello()).toBe('Hello World!');
  });
});
