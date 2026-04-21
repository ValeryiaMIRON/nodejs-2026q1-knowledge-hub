import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../common/enums/user-role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CommentService } from './comment.service';

describe('CommentService', () => {
  let service: CommentService;

  const prismaMock = {
    comment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    article: {
      findUnique: vi.fn(),
    },
  };

  const editorActor = {
    userId: 'editor-id',
    login: 'editor',
    role: UserRole.EDITOR,
  };

  const buildComment = (overrides?: Partial<Record<string, unknown>>) => ({
    id: 'comment-id',
    content: 'Comment',
    articleId: 'article-id',
    authorId: 'author-id',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(CommentService);
  });

  it('findByArticle throws when articleId query is missing', async () => {
    await expect(
      service.findByArticle(
        {} as unknown as Parameters<CommentService['findByArticle']>[0],
      ),
    ).rejects.toThrowError(
      new BadRequestException('articleId query param is required'),
    );
  });

  it('findByArticle returns sorted paginated comments', async () => {
    prismaMock.comment.findMany.mockResolvedValue([
      buildComment({ id: '2', content: 'Z comment' }),
      buildComment({ id: '1', content: 'A comment' }),
    ]);

    await expect(
      service.findByArticle({
        articleId: 'article-id',
        sortBy: 'content',
        order: 'asc',
        page: 1,
        limit: 1,
      }),
    ).resolves.toEqual({
      total: 2,
      page: 1,
      limit: 1,
      data: [
        {
          id: '1',
          content: 'A comment',
          articleId: 'article-id',
          authorId: 'author-id',
          createdAt: new Date('2024-01-01T00:00:00.000Z').getTime(),
        },
      ],
    });
  });

  it('findById returns comment', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(buildComment());

    await expect(service.findById('comment-id')).resolves.toEqual({
      id: 'comment-id',
      content: 'Comment',
      articleId: 'article-id',
      authorId: 'author-id',
      createdAt: new Date('2024-01-01T00:00:00.000Z').getTime(),
    });
  });

  it('findById throws when comment is missing', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrowError(
      new NotFoundException('Comment not found'),
    );
  });

  it('denies comment creation for editor when authorId belongs to another user', async () => {
    await expect(
      service.create(
        { content: 'Comment', articleId: 'article-id', authorId: 'other-id' },
        editorActor,
      ),
    ).rejects.toThrowError(
      new ForbiddenException('Insufficient permissions for this operation'),
    );
  });

  it('throws when target article does not exist', async () => {
    prismaMock.article.findUnique.mockResolvedValue(null);

    await expect(
      service.create({ content: 'Comment', articleId: 'article-id' }),
    ).rejects.toThrowError(
      new UnprocessableEntityException('Article does not exist'),
    );
  });

  it('creates comment when article exists', async () => {
    prismaMock.article.findUnique.mockResolvedValue({ id: 'article-id' });
    prismaMock.comment.create.mockResolvedValue(buildComment());

    await service.create({
      content: 'Comment',
      articleId: 'article-id',
      authorId: 'author-id',
    });

    expect(prismaMock.comment.create).toHaveBeenCalledWith({
      data: {
        content: 'Comment',
        articleId: 'article-id',
        authorId: 'author-id',
      },
    });
  });

  it('delete throws when comment is missing', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(null);

    await expect(service.delete('missing')).rejects.toThrowError(
      new NotFoundException('Comment not found'),
    );
  });

  it('delete denies editor on foreign comment', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(
      buildComment({ authorId: 'other-id' }),
    );

    await expect(
      service.delete('comment-id', editorActor),
    ).rejects.toThrowError(
      new ForbiddenException('Insufficient permissions for this operation'),
    );
  });

  it('delete removes existing comment', async () => {
    prismaMock.comment.findUnique.mockResolvedValue(buildComment());
    prismaMock.comment.delete.mockResolvedValue(undefined);

    await service.delete('comment-id');

    expect(prismaMock.comment.delete).toHaveBeenCalledWith({
      where: { id: 'comment-id' },
    });
  });
});
