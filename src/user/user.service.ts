import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from '../common/interfaces/user.interface';
import { InMemoryDbService } from '../storage/in-memory-db.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(private readonly db: InMemoryDbService) {}

  findAll(): UserResponseDto[] {
    return this.db.users.map((user) => this.toResponse(user));
  }

  findById(id: string): UserResponseDto {
    const user = this.db.users.find((item) => item.id === id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toResponse(user);
  }

  create(dto: CreateUserDto): UserResponseDto {
    const timestamp = Date.now();
    const user: User = {
      id: randomUUID(),
      login: dto.login,
      password: dto.password,
      role: dto.role ?? UserRole.VIEWER,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.db.users.push(user);

    return this.toResponse(user);
  }

  updatePassword(id: string, dto: UpdatePasswordDto): UserResponseDto {
    const user = this.db.users.find((item) => item.id === id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.password !== dto.oldPassword) {
      throw new ForbiddenException('Old password is wrong');
    }

    user.password = dto.newPassword;
    user.updatedAt = Date.now();

    return this.toResponse(user);
  }

  delete(id: string): void {
    const userIndex = this.db.users.findIndex((item) => item.id === id);
    if (userIndex === -1) {
      throw new NotFoundException('User not found');
    }

    this.db.users.splice(userIndex, 1);

    this.db.articles.forEach((article) => {
      if (article.authorId === id) {
        article.authorId = null;
        article.updatedAt = Date.now();
      }
    });

    this.db.comments = this.db.comments.filter(
      (comment) => comment.authorId !== id,
    );
  }

  private toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      login: user.login,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
