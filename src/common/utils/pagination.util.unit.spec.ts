import { describe, expect, it } from 'vitest';
import { paginate } from './pagination.util';

describe('paginate', () => {
  it('returns original items when page and limit are missing', () => {
    expect(paginate([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('uses default page and limit when only page is provided', () => {
    expect(paginate([1, 2, 3], 1)).toEqual({
      total: 3,
      page: 1,
      limit: 10,
      data: [1, 2, 3],
    });
  });

  it('uses default page when only limit is provided', () => {
    expect(paginate([1, 2, 3], undefined, 2)).toEqual({
      total: 3,
      page: 1,
      limit: 2,
      data: [1, 2],
    });
  });

  it('returns sliced data for page and limit', () => {
    expect(paginate([1, 2, 3, 4], 2, 2)).toEqual({
      total: 4,
      page: 2,
      limit: 2,
      data: [3, 4],
    });
  });
});
