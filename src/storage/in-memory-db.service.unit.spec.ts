import { describe, expect, it } from 'vitest';
import { InMemoryDbService } from './in-memory-db.service';

describe('InMemoryDbService', () => {
  it('initializes empty collections', () => {
    const service = new InMemoryDbService();

    expect(service.users).toEqual([]);
    expect(service.articles).toEqual([]);
    expect(service.categories).toEqual([]);
    expect(service.comments).toEqual([]);
  });
});
