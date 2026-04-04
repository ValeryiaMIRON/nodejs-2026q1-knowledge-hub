import { PaginatedResponse } from '../interfaces/paginated-response.interface';

export function paginate<T>(
  items: T[],
  page?: number,
  limit?: number,
): T[] | PaginatedResponse<T> {
  if (page === undefined && limit === undefined) {
    return items;
  }

  const resolvedPage = page ?? 1;
  const resolvedLimit = limit ?? 10;
  const start = (resolvedPage - 1) * resolvedLimit;
  const end = start + resolvedLimit;

  return {
    total: items.length,
    page: resolvedPage,
    limit: resolvedLimit,
    data: items.slice(start, end),
  };
}
