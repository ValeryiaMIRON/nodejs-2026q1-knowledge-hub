import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ArticleStatus as PrismaArticleStatus, Prisma } from '@prisma/client';
import { ArticleStatus } from '../common/enums/article-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { Article } from '../common/interfaces/article.interface';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { paginate } from '../common/utils/pagination.util';
import { sortItems } from '../common/utils/sort.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { GetArticlesQueryDto } from './dto/get-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: GetArticlesQueryDto,
  ): Promise<Article[] | PaginatedResponse<Article>> {
    const where: Prisma.ArticleWhereInput = {};
    if (query.status) {
      where.status = this.toPrismaStatus(query.status);
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.tag) {
      where.tags = { some: { name: query.tag } };
    }

    const filtered = (
      await this.prisma.article.findMany({
        where,
        include: { tags: true },
      })
    ).map((article) => this.toResponse(article));

    const sorted = sortItems(filtered, query.sortBy, query.order);
    return paginate(sorted, query.page, query.limit);
  }

  async findById(id: string): Promise<Article> {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: { tags: true },
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return this.toResponse(article);
  }

  async create(dto: CreateArticleDto, actor?: AuthUser): Promise<Article> {
    if (actor?.role === UserRole.EDITOR) {
      if (dto.authorId !== actor.userId) {
        throw new ForbiddenException(
          'Insufficient permissions for this operation',
        );
      }
    }

    const article = await this.prisma.article.create({
      data: {
        title: dto.title,
        content: dto.content,
        status: this.toPrismaStatus(dto.status ?? ArticleStatus.DRAFT),
        authorId: dto.authorId ?? null,
        categoryId: dto.categoryId ?? null,
        tags: {
          connectOrCreate: (dto.tags ?? []).map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
      include: { tags: true },
    });

    return this.toResponse(article);
  }

  async update(
    id: string,
    dto: UpdateArticleDto,
    actor?: AuthUser,
  ): Promise<Article> {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: { tags: true },
    });
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (actor?.role === UserRole.EDITOR && article.authorId !== actor.userId) {
      throw new ForbiddenException(
        'Insufficient permissions for this operation',
      );
    }

    const data: Prisma.ArticleUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.status !== undefined) {
      this.assertValidStatusTransition(
        this.fromPrismaStatus(article.status),
        dto.status,
      );
      data.status = this.toPrismaStatus(dto.status);
    }
    if (dto.authorId !== undefined) data.authorId = dto.authorId;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        ...data,
        ...(dto.tags !== undefined
          ? {
              tags: {
                set: [],
                connectOrCreate: dto.tags.map((name) => ({
                  where: { name },
                  create: { name },
                })),
              },
            }
          : {}),
      },
      include: { tags: true },
    });

    return this.toResponse(updated);
  }

  async delete(id: string): Promise<void> {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    await this.prisma.article.delete({ where: { id } });
  }

  private toResponse(article: {
    id: string;
    title: string;
    content: string;
    status: PrismaArticleStatus;
    authorId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
    tags: Array<{ name: string }>;
  }): Article {
    return {
      id: article.id,
      title: article.title,
      content: article.content,
      status: this.fromPrismaStatus(article.status),
      authorId: article.authorId,
      categoryId: article.categoryId,
      tags: article.tags.map((tag) => tag.name),
      createdAt: article.createdAt.getTime(),
      updatedAt: article.updatedAt.getTime(),
    };
  }

  private toPrismaStatus(status: ArticleStatus): PrismaArticleStatus {
    return PrismaArticleStatus[
      status.toUpperCase() as keyof typeof PrismaArticleStatus
    ];
  }

  private assertValidStatusTransition(
    currentStatus: ArticleStatus,
    nextStatus: ArticleStatus,
  ): void {
    if (currentStatus === nextStatus) {
      return;
    }

    const allowedTransitions: Record<ArticleStatus, ArticleStatus[]> = {
      [ArticleStatus.DRAFT]: [ArticleStatus.PUBLISHED],
      [ArticleStatus.PUBLISHED]: [ArticleStatus.ARCHIVED],
      [ArticleStatus.ARCHIVED]: [],
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new BadRequestException('Invalid article status transition');
    }
  }

  private fromPrismaStatus(status: PrismaArticleStatus): ArticleStatus {
    return status.toLowerCase() as ArticleStatus;
  }
}
