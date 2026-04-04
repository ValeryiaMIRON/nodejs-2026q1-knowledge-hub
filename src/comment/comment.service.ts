import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Comment } from '../common/interfaces/comment.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { paginate } from '../common/utils/pagination.util';
import { sortItems } from '../common/utils/sort.util';
import { InMemoryDbService } from '../storage/in-memory-db.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';

@Injectable()
export class CommentService {
  constructor(private readonly db: InMemoryDbService) {}

  findByArticle(
    query: GetCommentsQueryDto,
  ): Comment[] | PaginatedResponse<Comment> {
    if (!query.articleId) {
      throw new BadRequestException('articleId query param is required');
    }

    const filtered = this.db.comments.filter(
      (comment) => comment.articleId === query.articleId,
    );

    const sorted = sortItems(filtered, query.sortBy, query.order);
    return paginate(sorted, query.page, query.limit);
  }

  findById(id: string): Comment {
    const comment = this.db.comments.find((item) => item.id === id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return comment;
  }

  create(dto: CreateCommentDto, actor?: AuthUser): Comment {
    if (process.env.TEST_MODE === 'auth' && actor?.role === UserRole.EDITOR) {
      if (dto.authorId !== actor.userId) {
        throw new ForbiddenException(
          'Insufficient permissions for this operation',
        );
      }
    }

    const articleExists = this.db.articles.some(
      (article) => article.id === dto.articleId,
    );

    if (!articleExists) {
      throw new UnprocessableEntityException('Article does not exist');
    }

    const comment: Comment = {
      id: randomUUID(),
      content: dto.content,
      articleId: dto.articleId,
      authorId: dto.authorId ?? null,
      createdAt: Date.now(),
    };

    this.db.comments.push(comment);
    return comment;
  }

  delete(id: string, actor?: AuthUser): void {
    const index = this.db.comments.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundException('Comment not found');
    }

    if (
      process.env.TEST_MODE === 'auth' &&
      actor?.role === UserRole.EDITOR &&
      this.db.comments[index].authorId !== actor.userId
    ) {
      throw new ForbiddenException(
        'Insufficient permissions for this operation',
      );
    }

    this.db.comments.splice(index, 1);
  }
}
