import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ArticleStatus as PrismaArticleStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleStatus } from '../common/enums/article-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleService } from './article.service';

describe('ArticleService', () => {
  let service: ArticleService;

  const prismaMock = {
    article: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const buildArticle = (overrides?: Partial<Record<string, unknown>>) => ({
    id: 'article-id',
    title: 'NestJS Guide',
    content: 'Detailed content here...',
    status: PrismaArticleStatus.DRAFT,
    authorId: 'author-id',
    categoryId: 'category-id',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    tags: [{ name: 'nestjs' }, { name: 'nodejs' }],
    ...overrides,
  });

  const editorActor = {
    userId: 'editor-id',
    login: 'editor',
    role: UserRole.EDITOR,
  };

  const adminActor = {
    userId: 'admin-id',
    login: 'admin',
    role: UserRole.ADMIN,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(ArticleService);
  });

  it('findAll applies status filter', async () => {
    prismaMock.article.findMany.mockResolvedValue([buildArticle()]);

    await service.findAll({ status: ArticleStatus.DRAFT });

    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      where: { status: PrismaArticleStatus.DRAFT },
      include: { tags: true },
    });
  });

  it('findAll applies categoryId and tag filters', async () => {
    prismaMock.article.findMany.mockResolvedValue([buildArticle()]);

    await service.findAll({ categoryId: 'category-id', tag: 'nestjs' });

    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      where: {
        categoryId: 'category-id',
        tags: { some: { name: 'nestjs' } },
      },
      include: { tags: true },
    });
  });

  it('findAll sorts and paginates mapped results', async () => {
    prismaMock.article.findMany.mockResolvedValue([
      buildArticle({ id: '2', title: 'Z article' }),
      buildArticle({ id: '1', title: 'A article' }),
    ]);

    const result = await service.findAll({
      sortBy: 'title',
      order: 'asc',
      page: 1,
      limit: 1,
    });

    expect(result).toEqual({
      total: 2,
      page: 1,
      limit: 1,
      data: [
        {
          id: '1',
          title: 'A article',
          content: 'Detailed content here...',
          status: ArticleStatus.DRAFT,
          authorId: 'author-id',
          categoryId: 'category-id',
          tags: ['nestjs', 'nodejs'],
          createdAt: new Date('2024-01-01T00:00:00.000Z').getTime(),
          updatedAt: new Date('2024-01-01T00:00:00.000Z').getTime(),
        },
      ],
    });
  });

  it('returns article by id', async () => {
    prismaMock.article.findUnique.mockResolvedValue(buildArticle());

    await expect(service.findById('article-id')).resolves.toEqual({
      id: 'article-id',
      title: 'NestJS Guide',
      content: 'Detailed content here...',
      status: ArticleStatus.DRAFT,
      authorId: 'author-id',
      categoryId: 'category-id',
      tags: ['nestjs', 'nodejs'],
      createdAt: new Date('2024-01-01T00:00:00.000Z').getTime(),
      updatedAt: new Date('2024-01-01T00:00:00.000Z').getTime(),
    });
  });

  it('throws NotFoundException when article is missing by id', async () => {
    prismaMock.article.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing-id')).rejects.toThrowError(
      new NotFoundException('Article not found'),
    );
  });

  it('creates article with default draft status and connectOrCreate tags', async () => {
    prismaMock.article.create.mockResolvedValue(buildArticle());

    await service.create(
      {
        title: 'NestJS Guide',
        content: 'Detailed content here...',
        authorId: 'author-id',
        categoryId: 'category-id',
        tags: ['nestjs', 'nodejs'],
      },
      adminActor,
    );

    expect(prismaMock.article.create).toHaveBeenCalledWith({
      data: {
        title: 'NestJS Guide',
        content: 'Detailed content here...',
        status: PrismaArticleStatus.DRAFT,
        authorId: 'author-id',
        categoryId: 'category-id',
        tags: {
          connectOrCreate: [
            { where: { name: 'nestjs' }, create: { name: 'nestjs' } },
            { where: { name: 'nodejs' }, create: { name: 'nodejs' } },
          ],
        },
      },
      include: { tags: true },
    });
  });

  it('denies create for editor when authorId is not own userId', async () => {
    await expect(
      service.create(
        {
          title: 'NestJS Guide',
          content: 'Detailed content here...',
          authorId: 'someone-else',
        },
        editorActor,
      ),
    ).rejects.toThrowError(
      new ForbiddenException('Insufficient permissions for this operation'),
    );
  });

  it('throws NotFoundException when updating a missing article', async () => {
    prismaMock.article.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing-id', { title: 'Updated' }),
    ).rejects.toThrowError(new NotFoundException('Article not found'));
  });

  it('denies update for editor on foreign article', async () => {
    prismaMock.article.findUnique.mockResolvedValue(
      buildArticle({ authorId: 'another-author' }),
    );

    await expect(
      service.update('article-id', { title: 'Updated' }, editorActor),
    ).rejects.toThrowError(
      new ForbiddenException('Insufficient permissions for this operation'),
    );
  });

  it('updates article status from draft to published', async () => {
    prismaMock.article.findUnique.mockResolvedValue(buildArticle());
    prismaMock.article.update.mockResolvedValue(
      buildArticle({ status: PrismaArticleStatus.PUBLISHED }),
    );

    const result = await service.update(
      'article-id',
      {
        status: ArticleStatus.PUBLISHED,
      },
      adminActor,
    );

    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 'article-id' },
      data: {
        status: PrismaArticleStatus.PUBLISHED,
      },
      include: { tags: true },
    });
    expect(result.status).toBe(ArticleStatus.PUBLISHED);
  });

  it('updates article status from published to archived', async () => {
    prismaMock.article.findUnique.mockResolvedValue(
      buildArticle({ status: PrismaArticleStatus.PUBLISHED }),
    );
    prismaMock.article.update.mockResolvedValue(
      buildArticle({ status: PrismaArticleStatus.ARCHIVED }),
    );

    const result = await service.update(
      'article-id',
      {
        status: ArticleStatus.ARCHIVED,
      },
      adminActor,
    );

    expect(result.status).toBe(ArticleStatus.ARCHIVED);
  });

  it('replaces tags when dto.tags is provided', async () => {
    prismaMock.article.findUnique.mockResolvedValue(buildArticle());
    prismaMock.article.update.mockResolvedValue(
      buildArticle({ tags: [{ name: 'typescript' }] }),
    );

    const result = await service.update(
      'article-id',
      {
        tags: ['typescript'],
      },
      adminActor,
    );

    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 'article-id' },
      data: {
        tags: {
          set: [],
          connectOrCreate: [
            { where: { name: 'typescript' }, create: { name: 'typescript' } },
          ],
        },
      },
      include: { tags: true },
    });
    expect(result.tags).toEqual(['typescript']);
  });

  it('throws NotFoundException when deleting missing article', async () => {
    prismaMock.article.findUnique.mockResolvedValue(null);

    await expect(service.delete('missing-id')).rejects.toThrowError(
      new NotFoundException('Article not found'),
    );
  });

  it('deletes existing article', async () => {
    prismaMock.article.findUnique.mockResolvedValue(buildArticle());
    prismaMock.article.delete.mockResolvedValue(undefined);

    await service.delete('article-id');

    expect(prismaMock.article.delete).toHaveBeenCalledWith({
      where: { id: 'article-id' },
    });
  });
});
