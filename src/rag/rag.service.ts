import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ArticleStatus, Prisma } from '@prisma/client';
import { GeminiService } from '../ai/gemini/gemini.service';
import { PrismaService } from '../prisma/prisma.service';
import { RagIndexRequestDto, RagIndexResponseDto } from './dto/rag-index.dto';
import { RagSearchRequestDto, RagSearchResponseDto } from './dto/rag-search.dto';
import { chunkText } from './rag-chunker';
import { RagVectorDbService } from './rag-vector-db.service';
import { RagArticleForIndex } from './rag.types';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly chunkSize = Number(process.env.RAG_CHUNK_SIZE || 800);
  private readonly chunkOverlap = Number(process.env.RAG_CHUNK_OVERLAP || 200);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly vectorDbService: RagVectorDbService,
  ) {}

  async reindex(request: RagIndexRequestDto): Promise<RagIndexResponseDto> {
    try {
      const onlyPublished = request.onlyPublished ?? true;
      const articles = await this.findArticlesForIndex(
        onlyPublished,
        request.articleIds,
      );

      let indexedArticles = 0;
      let indexedChunks = 0;
      let collectionPrepared = false;

      for (const article of articles) {
        const contentForEmbedding = this.buildContentForEmbedding(article);
        const chunks = chunkText(contentForEmbedding, this.chunkSize, this.chunkOverlap);

        await this.vectorDbService.deleteByArticleId(article.id);
        if (!chunks.length) {
          continue;
        }

        const points: Array<{
          id: string;
          vector: number[];
          payload: {
            articleId: string;
            articleTitle: string;
            chunk: string;
            chunkIndex: number;
            articleStatus: string;
            categoryId: string | null;
            tags: string[];
            updatedAt: string;
          };
        }> = [];

        for (const chunk of chunks) {
          const embedding = await this.geminiService.embedText(chunk.text);
          if (!collectionPrepared) {
            await this.vectorDbService.ensureCollection(embedding.length);
            collectionPrepared = true;
          }

          points.push({
            id: `${article.id}:${chunk.index}`,
            vector: embedding,
            payload: {
              articleId: article.id,
              articleTitle: article.title,
              chunk: chunk.text,
              chunkIndex: chunk.index,
              articleStatus: article.status,
              categoryId: article.categoryId,
              tags: article.tags,
              updatedAt: article.updatedAt.toISOString(),
            },
          });
        }

        await this.vectorDbService.upsertPoints(points);
        indexedArticles += 1;
        indexedChunks += points.length;
      }

      return {
        indexedArticles,
        indexedChunks,
        vectorCollection: this.vectorDbService.getCollectionName(),
      };
    } catch (error: unknown) {
      this.logger.error(
        'RAG reindex failed',
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('RAG indexing is temporarily unavailable');
    }
  }

  async search(request: RagSearchRequestDto): Promise<RagSearchResponseDto> {
    try {
      const queryEmbedding = await this.geminiService.embedText(request.query);
      const topK = request.limit ?? 5;

      const found = await this.vectorDbService.search(queryEmbedding, topK, {
        articleStatus: request.articleStatus,
        categoryId: request.categoryId,
        tags: request.tags,
      });

      return {
        results: found.map((entry) => ({
          articleId: entry.payload.articleId,
          articleTitle: entry.payload.articleTitle,
          chunk: entry.payload.chunk,
          similarity: entry.score,
        })),
      };
    } catch (error: unknown) {
      this.logger.error(
        'RAG search failed',
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('RAG search is temporarily unavailable');
    }
  }

  private async findArticlesForIndex(
    onlyPublished: boolean,
    articleIds?: string[],
  ): Promise<RagArticleForIndex[]> {
    const where: Prisma.ArticleWhereInput = {};
    if (onlyPublished) {
      where.status = ArticleStatus.PUBLISHED;
    }
    if (articleIds?.length) {
      where.id = { in: articleIds };
    }

    const articles = await this.prisma.article.findMany({
      where,
      include: { tags: true },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      content: article.content,
      status: article.status,
      categoryId: article.categoryId,
      tags: article.tags.map((tag) => tag.name),
      updatedAt: article.updatedAt,
    }));
  }

  private buildContentForEmbedding(article: RagArticleForIndex): string {
    return `Title: ${article.title}\n\nContent:\n${article.content}`;
  }
}
