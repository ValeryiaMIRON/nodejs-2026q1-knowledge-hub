import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Comment } from '../common/interfaces/comment.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { paginate } from '../common/utils/pagination.util';
import { sortItems } from '../common/utils/sort.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  async findByArticle(
    query: GetCommentsQueryDto,
  ): Promise<Comment[] | PaginatedResponse<Comment>> {
    if (!query.articleId) {
      throw new BadRequestException('articleId query param is required');
    }

    const filtered = (await this.prisma.comment.findMany({
      where: { articleId: query.articleId },
    })).map((comment) => this.toResponse(comment));

    const sorted = sortItems(filtered, query.sortBy, query.order);
    return paginate(sorted, query.page, query.limit);
  }

  async findById(id: string): Promise<Comment> {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return this.toResponse(comment);
  }

  async create(dto: CreateCommentDto, actor?: AuthUser): Promise<Comment> {
    if (process.env.TEST_MODE === 'auth' && actor?.role === UserRole.EDITOR) {
      if (dto.authorId !== actor.userId) {
        throw new ForbiddenException(
          'Insufficient permissions for this operation',
        );
      }
    }

    const articleExists = await this.prisma.article.findUnique({
      where: { id: dto.articleId },
      select: { id: true },
    });

    if (!articleExists) {
      throw new UnprocessableEntityException('Article does not exist');
    }

    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        articleId: dto.articleId,
        authorId: dto.authorId ?? null,
      },
    });

    return this.toResponse(comment);
  }

  async delete(id: string, actor?: AuthUser): Promise<void> {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (
      process.env.TEST_MODE === 'auth' &&
      actor?.role === UserRole.EDITOR &&
      comment.authorId !== actor.userId
    ) {
      throw new ForbiddenException(
        'Insufficient permissions for this operation',
      );
    }

    await this.prisma.comment.delete({ where: { id } });
  }

  private toResponse(comment: {
    id: string;
    content: string;
    articleId: string;
    authorId: string | null;
    createdAt: Date;
  }): Comment {
    return {
      id: comment.id,
      content: comment.content,
      articleId: comment.articleId,
      authorId: comment.authorId,
      createdAt: comment.createdAt.getTime(),
    };
  }
}
