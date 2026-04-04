import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Category } from '../common/interfaces/category.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { paginate } from '../common/utils/pagination.util';
import { sortItems } from '../common/utils/sort.util';
import { InMemoryDbService } from '../storage/in-memory-db.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly db: InMemoryDbService) {}

  findAll(
    query: GetCategoriesQueryDto,
  ): Category[] | PaginatedResponse<Category> {
    const sorted = sortItems(this.db.categories, query.sortBy, query.order);
    return paginate(sorted, query.page, query.limit);
  }

  findById(id: string): Category {
    const category = this.db.categories.find((item) => item.id === id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  create(dto: CreateCategoryDto): Category {
    const category: Category = {
      id: randomUUID(),
      name: dto.name,
      description: dto.description,
    };

    this.db.categories.push(category);
    return category;
  }

  update(id: string, dto: UpdateCategoryDto): Category {
    const category = this.db.categories.find((item) => item.id === id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    category.name = dto.name;
    category.description = dto.description;

    return category;
  }

  delete(id: string): void {
    const index = this.db.categories.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new NotFoundException('Category not found');
    }

    this.db.categories.splice(index, 1);

    this.db.articles.forEach((article) => {
      if (article.categoryId === id) {
        article.categoryId = null;
        article.updatedAt = Date.now();
      }
    });
  }
}
