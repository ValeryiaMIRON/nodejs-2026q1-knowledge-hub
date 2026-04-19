import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole as PrismaUserRole } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { UserRole } from '../common/enums/user-role.enum';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { paginate } from '../common/utils/pagination.util';
import { sortItems } from '../common/utils/sort.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: GetUsersQueryDto,
  ): Promise<UserResponseDto[] | PaginatedResponse<UserResponseDto>> {
    const users = (await this.prisma.user.findMany()).map((user) =>
      this.toResponse(user),
    );
    const sorted = sortItems(users, query.sortBy, query.order);
    return paginate(sorted, query.page, query.limit);
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toResponse(user);
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.create({
        data: {
          login: dto.login,
          password: await this.hashPassword(dto.password),
          role: this.toPrismaRole(dto.role ?? UserRole.VIEWER),
        },
      });

      return this.toResponse(user);
    } catch (error) {
      this.handleUserWriteError(error);
    }
  }

  async updatePassword(
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.role !== undefined) {
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          role: this.toPrismaRole(dto.role),
        },
      });

      return this.toResponse(updated);
    }

    if (
      dto.oldPassword === undefined ||
      dto.newPassword === undefined ||
      dto.oldPassword.length === 0 ||
      dto.newPassword.length === 0
    ) {
      throw new BadRequestException('oldPassword and newPassword are required');
    }

    const isOldPasswordValid = await compare(dto.oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new ForbiddenException('Old password is wrong');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        password: await this.hashPassword(dto.newPassword),
      },
    });

    return this.toResponse(updated);
  }

  async delete(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.$transaction([
      this.prisma.article.updateMany({
        where: { authorId: id },
        data: { authorId: null },
      }),
      this.prisma.comment.deleteMany({
        where: { authorId: id },
      }),
      this.prisma.user.delete({ where: { id } }),
    ]);
  }

  private toResponse(user: {
    id: string;
    login: string;
    role: PrismaUserRole;
    createdAt: Date;
    updatedAt: Date;
  }): UserResponseDto {
    return {
      id: user.id,
      login: user.login,
      role: this.fromPrismaRole(user.role),
      createdAt: user.createdAt.getTime(),
      updatedAt: user.updatedAt.getTime(),
    };
  }

  private toPrismaRole(role: UserRole): PrismaUserRole {
    return PrismaUserRole[role.toUpperCase() as keyof typeof PrismaUserRole];
  }

  private fromPrismaRole(role: PrismaUserRole): UserRole {
    return role.toLowerCase() as UserRole;
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = Number(process.env.CRYPT_SALT || 10);
    return hash(password, saltRounds);
  }

  private handleUserWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException('Login is already taken');
    }

    throw error;
  }
}
