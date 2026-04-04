import { StatusCodes } from 'http-status-codes';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { request } from './lib';
import {
  getTokenAndUserId,
  removeTokenUser,
  shouldAuthorizationBeTested,
} from './utils';
import { articlesRoutes } from './endpoints';

describe('Hacker Scope (e2e)', () => {
  const unauthorizedRequest = request;
  const commonHeaders: Record<string, string> = { Accept: 'application/json' };
  const createdArticleIds: string[] = [];
  const uniqueTag = `hacker-scope-tag-${Date.now()}`;

  let mockUserId: string | undefined;

  beforeAll(async () => {
    if (shouldAuthorizationBeTested) {
      const result = await getTokenAndUserId(unauthorizedRequest);
      commonHeaders.Authorization = result.token;
      mockUserId = result.mockUserId;
    }

    const payloads = [
      { title: 'PAG_A', content: 'A content' },
      { title: 'PAG_B', content: 'B content' },
      { title: 'PAG_C', content: 'C content' },
    ];

    for (const payload of payloads) {
      const response = await unauthorizedRequest
        .post(articlesRoutes.create)
        .set(commonHeaders)
        .send({ ...payload, tags: [uniqueTag] });

      expect([StatusCodes.CREATED, StatusCodes.OK]).toContain(
        response.statusCode,
      );
      createdArticleIds.push(response.body.id);
    }
  });

  afterAll(async () => {
    for (const id of createdArticleIds) {
      await unauthorizedRequest
        .delete(articlesRoutes.delete(id))
        .set(commonHeaders);
    }

    if (mockUserId) {
      await removeTokenUser(unauthorizedRequest, mockUserId, commonHeaders);
    }

    if (commonHeaders.Authorization) {
      delete commonHeaders.Authorization;
    }
  });

  it('should return paginated result with total/page/limit/data', async () => {
    const response = await unauthorizedRequest
      .get(
        `${articlesRoutes.getAll}?tag=${uniqueTag}&sortBy=title&order=asc&page=1&limit=2`,
      )
      .set(commonHeaders);

    expect(response.statusCode).toBe(StatusCodes.OK);
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page', 1);
    expect(response.body).toHaveProperty('limit', 2);
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.total).toBe(3);

    const titles = response.body.data.map((article) => article.title);
    expect(titles).toEqual(['PAG_A', 'PAG_B']);
  });

  it('should return sorted array when only sortBy/order are provided', async () => {
    const response = await unauthorizedRequest
      .get(`${articlesRoutes.getAll}?tag=${uniqueTag}&sortBy=title&order=desc`)
      .set(commonHeaders);

    expect(response.statusCode).toBe(StatusCodes.OK);
    expect(Array.isArray(response.body)).toBe(true);

    const titles = response.body.map((article) => article.title);
    expect(titles).toEqual(['PAG_C', 'PAG_B', 'PAG_A']);
  });
});
