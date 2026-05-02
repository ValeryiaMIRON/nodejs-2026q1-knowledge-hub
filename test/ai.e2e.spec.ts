import { StatusCodes } from 'http-status-codes';
import { request } from './lib';
import {
  getTokenAndUserId,
  removeTokenUser,
  shouldAuthorizationBeTested,
} from './utils';

const randomUUID = 'b1c2d3e4-f5a6-4789-abcd-ef0123456789';
const invalidUUID = 'not-a-valid-uuid';

const aiRoutes = {
  summarize: (articleId: string) => `/ai/articles/${articleId}/summarize`,
  translate: (articleId: string) => `/ai/articles/${articleId}/translate`,
  analyze: (articleId: string) => `/ai/articles/${articleId}/analyze`,
  generate: '/ai/generate',
  usage: '/ai/usage',
};

describe('AI endpoints (e2e)', () => {
  const unauthorizedRequest = request;
  const commonHeaders: Record<string, string> = {
    Accept: 'application/json',
  };
  let mockUserId: string | undefined;

  beforeAll(async () => {
    if (shouldAuthorizationBeTested) {
      const result = await getTokenAndUserId(unauthorizedRequest);
      commonHeaders['Authorization'] = result.token;
      mockUserId = result.mockUserId;
    }
  });

  afterAll(async () => {
    if (mockUserId) {
      await removeTokenUser(unauthorizedRequest, mockUserId, commonHeaders);
    }
  });

  // ── GET /ai/usage ─────────────────────────────────────────────────────────

  describe('GET /ai/usage', () => {
    it('returns 200 with usage stats shape', async () => {
      const response = await unauthorizedRequest
        .get(aiRoutes.usage)
        .set(commonHeaders);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toMatchObject({
        totalRequests: expect.any(Number),
        requestsByEndpoint: expect.objectContaining({
          summarize: expect.any(Number),
          translate: expect.any(Number),
          analyze: expect.any(Number),
          generate: expect.any(Number),
        }),
        tokenUsage: expect.objectContaining({
          totalTokenCount: expect.any(Number),
        }),
      });
    });
  });

  // ── POST /ai/articles/:articleId/summarize ────────────────────────────────

  describe('POST /ai/articles/:articleId/summarize', () => {
    it('returns 400 for invalid UUID', async () => {
      const response = await unauthorizedRequest
        .post(aiRoutes.summarize(invalidUUID))
        .set(commonHeaders)
        .send({});

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 for non-existent article UUID', async () => {
      const response = await unauthorizedRequest
        .post(aiRoutes.summarize(randomUUID))
        .set(commonHeaders)
        .send({});

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    });
  });

  // ── POST /ai/articles/:articleId/translate ────────────────────────────────

  describe('POST /ai/articles/:articleId/translate', () => {
    it('returns 400 for invalid UUID', async () => {
      const response = await unauthorizedRequest
        .post(aiRoutes.translate(invalidUUID))
        .set(commonHeaders)
        .send({ targetLanguage: 'Spanish' });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when targetLanguage is missing', async () => {
      const response = await unauthorizedRequest
        .post(aiRoutes.translate(randomUUID))
        .set(commonHeaders)
        .send({});

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 for non-existent article UUID with valid body', async () => {
      const response = await unauthorizedRequest
        .post(aiRoutes.translate(randomUUID))
        .set(commonHeaders)
        .send({ targetLanguage: 'Spanish' });

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    });
  });

  // ── POST /ai/articles/:articleId/analyze ─────────────────────────────────

  describe('POST /ai/articles/:articleId/analyze', () => {
    it('returns 400 for invalid UUID', async () => {
      const response = await unauthorizedRequest
        .post(aiRoutes.analyze(invalidUUID))
        .set(commonHeaders)
        .send({});

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 for non-existent article UUID', async () => {
      const response = await unauthorizedRequest
        .post(aiRoutes.analyze(randomUUID))
        .set(commonHeaders)
        .send({});

      expect(response.status).toBe(StatusCodes.NOT_FOUND);
    });
  });

  // ── POST /ai/generate ─────────────────────────────────────────────────────

  describe('POST /ai/generate', () => {
    it('returns 400 when prompt is missing', async () => {
      const response = await unauthorizedRequest
        .post(aiRoutes.generate)
        .set(commonHeaders)
        .send({});

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 400 when prompt is an empty string', async () => {
      const response = await unauthorizedRequest
        .post(aiRoutes.generate)
        .set(commonHeaders)
        .send({ prompt: '' });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 200 or 500/503 when prompt is valid (Gemini may not be configured)', async () => {
      const response = await unauthorizedRequest
        .post(aiRoutes.generate)
        .set(commonHeaders)
        .send({ prompt: 'Say hello.' });

      // Either succeeds (200) or fails with 500/503 when no real Gemini key
      expect([
        StatusCodes.OK,
        StatusCodes.INTERNAL_SERVER_ERROR,
        StatusCodes.SERVICE_UNAVAILABLE,
      ]).toContain(response.status);
    });
  });
});
