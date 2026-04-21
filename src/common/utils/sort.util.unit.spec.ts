import { describe, expect, it } from 'vitest';
import { sortItems } from './sort.util';

describe('sortItems', () => {
  it('returns original items when sortBy is missing', () => {
    const items = [{ value: 2 }, { value: 1 }];

    expect(sortItems(items)).toEqual(items);
  });

  it('sorts numbers ascending', () => {
    expect(sortItems([{ value: 2 }, { value: 1 }], 'value', 'asc')).toEqual([
      { value: 1 },
      { value: 2 },
    ]);
  });

  it('sorts strings descending', () => {
    expect(
      sortItems(
        [{ value: 'a' }, { value: 'c' }, { value: 'b' }],
        'value',
        'desc',
      ),
    ).toEqual([{ value: 'c' }, { value: 'b' }, { value: 'a' }]);
  });

  it('moves undefined values to the end', () => {
    expect(
      sortItems([{ value: undefined }, { value: 1 }], 'value', 'asc'),
    ).toEqual([{ value: 1 }, { value: undefined }]);
  });

  it('keeps order when both values are undefined', () => {
    expect(
      sortItems([{ value: undefined }, { value: undefined }], 'value', 'asc'),
    ).toEqual([{ value: undefined }, { value: undefined }]);
  });
});
