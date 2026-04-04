import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ArticleStatus } from '../common/enums/article-status.enum';
import { Article } from '../common/interfaces/article.interface';
import { InMemoryDbService } from '../storage/in-memory-db.service';
import { CreateArticleDto } from './dto/create-article.dto';

@Injectable()
export class ArticleService {
  constructor(private readonly db: InMemoryDbService) {}

  findById(id: string): Article {
    const article = this.db.articles.find((item) => item.id === id);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  create(dto: CreateArticleDto): Article {
    const timestamp = Date.now();
    const article: Article = {
      id: randomUUID(),
      title: dto.title,
      content: dto.content,
      status: dto.status ?? ArticleStatus.DRAFT,
      authorId: dto.authorId ?? null,
      categoryId: dto.categoryId ?? null,
      tags: dto.tags ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.db.articles.push(article);
    return article;
  }
  delete(id: string): void {
    const index = this.db.articles.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundException('Article not found');
    }
    this.db.articles.splice(index, 1);
    this.db.comments = this.db.comments.filter(
      (comment) => comment.articleId !== id,
    );
  }
}
