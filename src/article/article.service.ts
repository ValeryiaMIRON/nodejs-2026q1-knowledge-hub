import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ArticleStatus } from '../common/enums/article-status.enum';
import { Article } from '../common/interfaces/article.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { paginate } from '../common/utils/pagination.util';
import { sortItems } from '../common/utils/sort.util';
import { InMemoryDbService } from '../storage/in-memory-db.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { GetArticlesQueryDto } from './dto/get-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticleService {
  constructor(private readonly db: InMemoryDbService) {}

  findAll(query: GetArticlesQueryDto): Article[] | PaginatedResponse<Article> {
    const filtered = this.db.articles.filter((article) => {
      const byStatus = query.status ? article.status === query.status : true;
      const byCategoryId = query.categoryId
        ? article.categoryId === query.categoryId
        : true;
      const byTag = query.tag ? article.tags.includes(query.tag) : true;

      return byStatus && byCategoryId && byTag;
    });

    const sorted = sortItems(filtered, query.sortBy, query.order);
    return paginate(sorted, query.page, query.limit);
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

    if (dto.title !== undefined) article.title = dto.title;
    if (dto.content !== undefined) article.content = dto.content;
    if (dto.status !== undefined) article.status = dto.status;
    if (dto.authorId !== undefined) article.authorId = dto.authorId;
    if (dto.categoryId !== undefined) article.categoryId = dto.categoryId;
    if (dto.tags !== undefined) article.tags = dto.tags;
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
