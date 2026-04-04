import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Comment } from '../common/interfaces/comment.interface';
import { InMemoryDbService } from '../storage/in-memory-db.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentService {
  constructor(private readonly db: InMemoryDbService) {}
  findById(id: string): Comment {
    const comment = this.db.comments.find((item) => item.id === id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  create(dto: CreateCommentDto): Comment {
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

  delete(id: string): void {
    const index = this.db.comments.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundException('Comment not found');
    }
    this.db.comments.splice(index, 1);
  }
}
