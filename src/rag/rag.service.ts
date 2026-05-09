import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ArticleStatus, Prisma } from '@prisma/client';
import { GeminiService } from '../ai/gemini/gemini.service';
import { GeminiContent } from '../ai/gemini/gemini.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  RagChatRequestDto,
  RagChatResponseDto,
  RagConversationHistoryResponseDto,
} from './dto/rag-chat.dto';
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
  private readonly maxConversationMessages = Number(
    process.env.RAG_CONVERSATION_MAX_MESSAGES || 20,
  );
  private readonly conversations = new Map<string, GeminiContent[]>();

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

      if (!request.articleIds?.length) {
        await this.vectorDbService.deleteArticlesNotInSet(
          new Set(articles.map((article) => article.id)),
        );
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

  async chat(request: RagChatRequestDto): Promise<RagChatResponseDto> {
    try {
      const topChunks = await this.search({
        query: request.question,
        limit: 5,
      });

      const sources = topChunks.results.map((item) => ({
        articleId: item.articleId,
        articleTitle: item.articleTitle,
        relevantChunk: item.chunk,
      }));

      const groundedPrompt = this.buildGroundedPrompt(request.question, sources);
      const conversationId = request.conversationId ?? crypto.randomUUID();
      const history = this.conversations.get(conversationId) ?? [];

      const messageForModel: GeminiContent = {
        role: 'user',
        parts: [{ text: groundedPrompt }],
      };

      const answer = await this.geminiService.generateWithHistory([
        ...history,
        messageForModel,
      ]);

      const updatedHistory = [
        ...history,
        { role: 'user', parts: [{ text: request.question }] } as GeminiContent,
        { role: 'model', parts: [{ text: answer.text }] } as GeminiContent,
      ];

      this.conversations.set(
        conversationId,
        this.trimConversation(updatedHistory),
      );

      return {
        answer: answer.text,
        sources,
        conversationId,
      };
    } catch (error: unknown) {
      this.logger.error(
        'RAG chat failed',
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('RAG chat is temporarily unavailable');
    }
  }

  async removeArticleFromIndex(articleId: string): Promise<void> {
    try {
      const exists = await this.vectorDbService.hasVectorsForArticle(articleId);
      if (!exists) {
        throw new NotFoundException('Article vectors not found in index');
      }
      await this.vectorDbService.deleteByArticleId(articleId);
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        'RAG article index delete failed',
        error instanceof Error ? error.stack : undefined,
      );
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        'RAG index delete is temporarily unavailable',
      );
    }
  }

  getConversationHistory(
    conversationId: string,
  ): RagConversationHistoryResponseDto {
    const history = this.conversations.get(conversationId);
    if (!history) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      conversationId,
      messages: history.map((entry) => ({
        role: entry.role,
        text: entry.parts[0]?.text ?? '',
      })),
    };
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

  private buildGroundedPrompt(
    question: string,
    sources: Array<{
      articleId: string;
      articleTitle: string;
      relevantChunk: string;
    }>,
  ): string {
    const contextBlock = sources
      .map(
        (source, index) =>
          `Source ${index + 1}\nArticle ID: ${source.articleId}\nTitle: ${source.articleTitle}\nChunk: ${source.relevantChunk}`,
      )
      .join('\n\n');

    return [
      'You are a Knowledge Hub assistant.',
      'Answer ONLY with information from the provided sources.',
      'If sources are insufficient, clearly state uncertainty.',
      '',
      `Question: ${question}`,
      '',
      'Sources:',
      contextBlock || 'No relevant sources found.',
    ].join('\n');
  }

  private trimConversation(messages: GeminiContent[]): GeminiContent[] {
    const safeMax = Math.max(2, this.maxConversationMessages);
    if (messages.length <= safeMax) {
      return messages;
    }
    return messages.slice(messages.length - safeMax);
  }
}
