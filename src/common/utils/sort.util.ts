type SortOrder = 'asc' | 'desc';

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  return String(a).localeCompare(String(b));
}

export function sortItems<T>(
  items: T[],
  sortBy?: string,
  order: SortOrder = 'asc',
): T[] {
  if (!sortBy) {
    return items;
  }

  const sorted = [...items].sort((left, right) => {
    const leftValue = (left as Record<string, unknown>)[sortBy];
    const rightValue = (right as Record<string, unknown>)[sortBy];

    if (leftValue === undefined && rightValue === undefined) {
      return 0;
    }

    if (leftValue === undefined) {
      return 1;
    }

    if (rightValue === undefined) {
      return -1;
    }

    return compareValues(leftValue, rightValue);
  });

  return order === 'desc' ? sorted.reverse() : sorted;
}
