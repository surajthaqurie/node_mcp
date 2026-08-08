/**
 * @file pagination.util.ts
 * @description Helper functions for creating paginated response objects.
 */

import { PaginatedResponse } from '../dto/pagination.dto';

export function createPaginatedResponse<T>(
  data: T[],
  totalItems: number,
  page = 1,
  limit = 10,
): PaginatedResponse<T> {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  const totalPages = Math.ceil(totalItems / safeLimit) || 1;

  return {
    data,
    meta: {
      page: safePage,
      limit: safeLimit,
      totalItems,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
    },
  };
}
