import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole as PrismaUserRole, Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { compare, hash } from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../common/enums/user-role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from './user.service';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

describe('UserService', () => {
  let service: UserService;

  const prismaMock = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    article: {
      updateMany: vi.fn(),
    },
    comment: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const bcryptHash = vi.mocked(hash);
  const bcryptCompare = vi.mocked(compare);

  const buildUser = (overrides?: Partial<Record<string, unknown>>) => ({
    id: 'user-id',
    login: 'john',
    password: 'hashed-password',
    role: PrismaUserRole.VIEWER,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.CRYPT_SALT = '10';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(UserService);
  });

  it('returns user by id', async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());

    await expect(service.findById('user-id')).resolves.toEqual({
      id: 'user-id',
      login: 'john',
      role: UserRole.VIEWER,
      createdAt: new Date('2024-01-01T00:00:00.000Z').getTime(),
      updatedAt: new Date('2024-01-01T00:00:00.000Z').getTime(),
    });
  });

  it('throws NotFoundException when user is not found by id', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing-id')).rejects.toThrowError(
      new NotFoundException('User not found'),
    );
  });

  it('hashes password and assigns viewer role by default on create', async () => {
    bcryptHash.mockResolvedValue('hashed-password' as never);
    prismaMock.user.create.mockResolvedValue(buildUser());

    const result = await service.create({
      login: 'john',
      password: 'plain-password',
    });

    expect(bcryptHash).toHaveBeenCalledWith('plain-password', 10);
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        login: 'john',
        password: 'hashed-password',
        role: PrismaUserRole.VIEWER,
      },
    });
    expect(result.role).toBe(UserRole.VIEWER);
  });

  it('uses provided role on create', async () => {
    bcryptHash.mockResolvedValue('hashed-password' as never);
    prismaMock.user.create.mockResolvedValue(
      buildUser({ role: PrismaUserRole.EDITOR }),
    );

    await service.create({
      login: 'john',
      password: 'plain-password',
      role: UserRole.EDITOR,
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        login: 'john',
        password: 'hashed-password',
        role: PrismaUserRole.EDITOR,
      },
    });
  });

  it('throws BadRequestException for duplicate login on create', async () => {
    bcryptHash.mockResolvedValue('hashed-password' as never);
    prismaMock.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create({
        login: 'john',
        password: 'plain-password',
      }),
    ).rejects.toThrowError(new BadRequestException('Login is already taken'));
  });

  it('throws NotFoundException when updating a missing user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.updatePassword('missing-id', {
        newPassword: 'new',
        oldPassword: 'old',
      }),
    ).rejects.toThrowError(new NotFoundException('User not found'));
  });

  it('updates role when role is provided', async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.user.update.mockResolvedValue(
      buildUser({ role: PrismaUserRole.EDITOR }),
    );

    const result = await service.updatePassword('user-id', {
      role: UserRole.EDITOR,
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { role: PrismaUserRole.EDITOR },
    });
    expect(result.role).toBe(UserRole.EDITOR);
    expect(bcryptCompare).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when password fields are missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());

    await expect(service.updatePassword('user-id', {})).rejects.toThrowError(
      new BadRequestException('oldPassword and newPassword are required'),
    );
  });

  it('throws ForbiddenException when old password is wrong', async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    bcryptCompare.mockResolvedValue(false as never);

    await expect(
      service.updatePassword('user-id', {
        oldPassword: 'wrong-password',
        newPassword: 'new-password',
      }),
    ).rejects.toThrowError(new ForbiddenException('Old password is wrong'));
  });

  it('hashes new password on successful password update', async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    bcryptCompare.mockResolvedValue(true as never);
    bcryptHash.mockResolvedValue('new-hashed-password' as never);
    prismaMock.user.update.mockResolvedValue(buildUser());

    await service.updatePassword('user-id', {
      oldPassword: 'old-password',
      newPassword: 'new-password',
    });

    expect(bcryptHash).toHaveBeenCalledWith('new-password', 10);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { password: 'new-hashed-password' },
    });
  });

  it('throws NotFoundException when deleting a missing user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(service.delete('missing-id')).rejects.toThrowError(
      new NotFoundException('User not found'),
    );
  });

  it('runs transaction when deleting an existing user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    prismaMock.article.updateMany.mockReturnValue('updateMany-op');
    prismaMock.comment.deleteMany.mockReturnValue('deleteMany-op');
    prismaMock.user.delete.mockReturnValue('delete-op');
    prismaMock.$transaction.mockResolvedValue(undefined);

    await service.delete('user-id');

    expect(prismaMock.article.updateMany).toHaveBeenCalledWith({
      where: { authorId: 'user-id' },
      data: { authorId: null },
    });
    expect(prismaMock.comment.deleteMany).toHaveBeenCalledWith({
      where: { authorId: 'user-id' },
    });
    expect(prismaMock.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-id' },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      'updateMany-op',
      'deleteMany-op',
      'delete-op',
    ]);
  });
});
