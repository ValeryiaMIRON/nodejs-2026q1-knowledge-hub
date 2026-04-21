import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  let service: CategoryService;

  const prismaMock = {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(CategoryService);
  });

  it('findAll returns sorted paginated categories', async () => {
    prismaMock.category.findMany.mockResolvedValue([
      { id: '2', name: 'Z', description: 'Second' },
      { id: '1', name: 'A', description: 'First' },
    ]);

    await expect(
      service.findAll({ sortBy: 'name', order: 'asc', page: 1, limit: 1 }),
    ).resolves.toEqual({
      total: 2,
      page: 1,
      limit: 1,
      data: [{ id: '1', name: 'A', description: 'First' }],
    });
  });

  it('findById returns category', async () => {
    prismaMock.category.findUnique.mockResolvedValue({
      id: '1',
      name: 'A',
      description: 'First',
    });

    await expect(service.findById('1')).resolves.toEqual({
      id: '1',
      name: 'A',
      description: 'First',
    });
  });

  it('findById throws when category is missing', async () => {
    prismaMock.category.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrowError(
      new NotFoundException('Category not found'),
    );
  });

  it('create persists category data', async () => {
    prismaMock.category.create.mockResolvedValue({
      id: '1',
      name: 'A',
      description: 'First',
    });

    await service.create({ name: 'A', description: 'First' });

    expect(prismaMock.category.create).toHaveBeenCalledWith({
      data: { name: 'A', description: 'First' },
    });
  });

  it('update throws when category is missing', async () => {
    prismaMock.category.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing', { name: 'B', description: 'Updated' }),
    ).rejects.toThrowError(new NotFoundException('Category not found'));
  });

  it('update persists updated category data', async () => {
    prismaMock.category.findUnique.mockResolvedValue({
      id: '1',
      name: 'A',
      description: 'First',
    });
    prismaMock.category.update.mockResolvedValue({
      id: '1',
      name: 'B',
      description: 'Updated',
    });

    await service.update('1', { name: 'B', description: 'Updated' });

    expect(prismaMock.category.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { name: 'B', description: 'Updated' },
    });
  });

  it('delete throws when category is missing', async () => {
    prismaMock.category.findUnique.mockResolvedValue(null);

    await expect(service.delete('missing')).rejects.toThrowError(
      new NotFoundException('Category not found'),
    );
  });

  it('delete removes existing category', async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: '1' });
    prismaMock.category.delete.mockResolvedValue(undefined);

    await service.delete('1');

    expect(prismaMock.category.delete).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });
});
