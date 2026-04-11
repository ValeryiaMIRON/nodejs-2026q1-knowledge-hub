import { Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '../common/interfaces/category.interface';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { paginate } from '../common/utils/pagination.util';
import { sortItems } from '../common/utils/sort.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { GetCategoriesQueryDto } from './dto/get-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: GetCategoriesQueryDto,
  ): Promise<Category[] | PaginatedResponse<Category>> {
    const categories = await this.prisma.category.findMany();
    const sorted = sortItems(categories, query.sortBy, query.order);
    return paginate(sorted, query.page, query.limit);
  }

  async findById(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async delete(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.prisma.category.delete({ where: { id } });
  }
}
