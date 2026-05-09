import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { RagSearchFilter, RagVectorPayload } from './rag.types';

type QdrantPoint = {
  id: string;
  vector: number[];
  payload: RagVectorPayload;
};

type QdrantSearchResponse = {
  result?: Array<{
    score: number;
    payload?: RagVectorPayload;
  }>;
};

type QdrantScrollResponse = {
  result?: {
    points?: Array<{
      id: string | number;
      payload?: RagVectorPayload;
    }>;
    next_page_offset?: string | number | null;
  };
};

class QdrantHttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

@Injectable()
export class RagVectorDbService {
  private readonly logger = new Logger(RagVectorDbService.name);
  private readonly vectorDbUrl =
    process.env.RAG_VECTOR_DB_URL || 'http://vectordb:6333';
  private readonly collectionName =
    process.env.RAG_VECTOR_COLLECTION || 'knowledge_hub_articles';
  private readonly timeoutMs = 10000;

  getCollectionName(): string {
    return this.collectionName;
  }

  async ensureCollection(vectorSize: number): Promise<void> {
    const collectionExists = await this.collectionAlreadyExists();
    if (collectionExists) {
      return;
    }

    await this.callQdrant(
      `/collections/${encodeURIComponent(this.collectionName)}`,
      'PUT',
      {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      },
    );
  }

  async upsertPoints(points: QdrantPoint[]): Promise<void> {
    if (!points.length) {
      return;
    }

    await this.callQdrant(
      `/collections/${encodeURIComponent(this.collectionName)}/points`,
      'PUT',
      {
        points,
      },
    );
  }

  async deleteByArticleId(articleId: string): Promise<boolean> {
    const response = await this.callQdrant(
      `/collections/${encodeURIComponent(this.collectionName)}/points/delete`,
      'POST',
      {
        filter: {
          must: [{ key: 'articleId', match: { value: articleId } }],
        },
      },
    );

    return Boolean(response?.result);
  }

  async hasVectorsForArticle(articleId: string): Promise<boolean> {
    const response = (await this.callQdrant(
      `/collections/${encodeURIComponent(this.collectionName)}/points/scroll`,
      'POST',
      {
        filter: {
          must: [{ key: 'articleId', match: { value: articleId } }],
        },
        limit: 1,
        with_payload: false,
        with_vector: false,
      },
    )) as QdrantScrollResponse;

    return Boolean(response.result?.points?.length);
  }

  async deleteArticlesNotInSet(allowedArticleIds: Set<string>): Promise<number> {
    const indexedIds = await this.listIndexedArticleIds();
    let deleted = 0;

    for (const articleId of indexedIds) {
      if (allowedArticleIds.has(articleId)) {
        continue;
      }
      await this.deleteByArticleId(articleId);
      deleted += 1;
    }

    return deleted;
  }

  async search(
    vector: number[],
    limit: number,
    filter: RagSearchFilter,
  ): Promise<Array<{ score: number; payload: RagVectorPayload }>> {
    const payloadFilter = this.toQdrantFilter(filter);
    const response = (await this.callQdrant(
      `/collections/${encodeURIComponent(this.collectionName)}/points/search`,
      'POST',
      {
        vector,
        limit,
        with_payload: true,
        ...(payloadFilter ? { filter: payloadFilter } : {}),
      },
    )) as QdrantSearchResponse;

    const points = response.result || [];
    return points
      .filter((point) => point.payload)
      .map((point) => ({
        score: point.score,
        payload: point.payload as RagVectorPayload,
      }));
  }

  private async collectionAlreadyExists(): Promise<boolean> {
    try {
      await this.callQdrant(
        `/collections/${encodeURIComponent(this.collectionName)}`,
        'GET',
      );
      return true;
    } catch (error: unknown) {
      if (error instanceof QdrantHttpError && error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  private toQdrantFilter(
    filter: RagSearchFilter,
  ): { must: Array<Record<string, unknown>> } | null {
    const must: Array<Record<string, unknown>> = [];

    if (filter.articleStatus) {
      must.push({
        key: 'articleStatus',
        match: { value: filter.articleStatus.toUpperCase() },
      });
    }

    if (filter.categoryId) {
      must.push({
        key: 'categoryId',
        match: { value: filter.categoryId },
      });
    }

    if (filter.tags?.length) {
      must.push({
        key: 'tags',
        match: { any: filter.tags },
      });
    }

    return must.length ? { must } : null;
  }

  private async callQdrant(
    path: string,
    method: 'GET' | 'POST' | 'PUT',
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const baseUrl = this.vectorDbUrl.replace(/\/+$/, '');
    const url = `${baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new QdrantHttpError(404, `Resource not found at ${path}`);
        }
        this.logger.error(`Vector DB request failed: ${method} ${path}`);
        throw new ServiceUnavailableException(
          'Vector DB is temporarily unavailable',
        );
      }

      if (response.status === 204) {
        return null;
      }

      return (await response.json()) as Record<string, unknown>;
    } catch (error: unknown) {
      if (error instanceof QdrantHttpError) {
        throw error;
      }
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(
        `Vector DB integration error on ${method} ${path}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Vector DB is temporarily unavailable',
      );
    }
  }

  private async listIndexedArticleIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    let offset: string | number | null | undefined = null;

    do {
      const response = (await this.callQdrant(
        `/collections/${encodeURIComponent(this.collectionName)}/points/scroll`,
        'POST',
        {
          limit: 100,
          with_payload: true,
          with_vector: false,
          ...(offset !== null ? { offset } : {}),
        },
      )) as QdrantScrollResponse;

      for (const point of response.result?.points ?? []) {
        if (point.payload?.articleId) {
          ids.add(point.payload.articleId);
        }
      }

      offset = response.result?.next_page_offset ?? null;
    } while (offset !== null);

    return ids;
  }
}
