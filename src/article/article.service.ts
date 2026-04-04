import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ArticleStatus } from '../common/enums/article-status.enum';
import { Article } from '../common/interfaces/article.interface';
import { InMemoryDbService } from '../storage/in-memory-db.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { GetArticlesQueryDto } from './dto/get-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticleService {
  constructor(private readonly db: InMemoryDbService) {}

  findAll(query: GetArticlesQueryDto): Article[] {
    return this.db.articles.filter((article) => {
      const byStatus = query.status ? article.status === query.status : true;
      const byCategoryId = query.categoryId
        ? article.categoryId === query.categoryId
        : true;
      const byTag = query.tag ? article.tags.includes(query.tag) : true;

      return byStatus && byCategoryId && byTag;
    });
  }

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

  update(id: string, dto: UpdateArticleDto): Article {
    const article = this.db.articles.find((item) => item.id === id);
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    article.title = dto.title ?? article.title;
    article.content = dto.content ?? article.content;
    article.status = dto.status ?? article.status;
    article.authorId = dto.authorId ?? article.authorId;
    article.categoryId = dto.categoryId ?? article.categoryId;
    article.tags = dto.tags ?? article.tags;
    article.updatedAt = Date.now();

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
