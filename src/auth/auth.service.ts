import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { compare } from 'bcrypt';
import { Secret, SignOptions, sign, verify } from 'jsonwebtoken';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignupDto } from './dto/signup.dto';

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  signup(dto: SignupDto) {
    const role = this.resolveDefaultSignupRole();
    return this.userService.create({ ...dto, role });
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: {
        login: dto.login,
      },
    });

    if (!user) {
      throw new ForbiddenException('Incorrect login or password');
    }

    const isPasswordValid = await compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new ForbiddenException('Incorrect login or password');
    }

    return this.issueTokens(user);
  }

  async refresh(dto?: RefreshDto): Promise<AuthTokens> {
    if (!dto?.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const payload = this.verifyRefreshToken(dto.refreshToken);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) {
      throw new ForbiddenException('Invalid or expired refresh token');
    }

    return this.issueTokens(user);
  }

  verifyAccessToken(token: string): AuthUser {
    try {
      const payload = verify(token, this.getAccessSecret()) as AuthUser;
      return {
        userId: payload.userId,
        login: payload.login,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException('Access token is missing or invalid');
    }
  }

  private verifyRefreshToken(token: string): AuthUser {
    try {
      const payload = verify(token, this.getRefreshSecret()) as AuthUser;
      return {
        userId: payload.userId,
        login: payload.login,
        role: payload.role,
      };
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }
  }

  private issueTokens(user: {
    id: string;
    login: string;
    role: PrismaUserRole;
  }): AuthTokens {
    const payload: AuthUser = {
      userId: user.id,
      login: user.login,
      role: this.fromPrismaRole(user.role),
    };

    const accessTokenExpiresIn = (process.env.JWT_ACCESS_TTL ||
      '15m') as SignOptions['expiresIn'];
    const refreshTokenExpiresIn = (process.env.JWT_REFRESH_TTL ||
      '7d') as SignOptions['expiresIn'];

    const accessToken = sign(payload, this.getAccessSecret(), {
      expiresIn: accessTokenExpiresIn,
    });

    const refreshToken = sign(payload, this.getRefreshSecret(), {
      expiresIn: refreshTokenExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  private resolveDefaultSignupRole(): UserRole {
    return UserRole.VIEWER;
  }

  private getAccessSecret(): Secret {
    return process.env.JWT_SECRET || '';
  }

  private getRefreshSecret(): Secret {
    return process.env.JWT_REFRESH_SECRET || '';
  }

  private fromPrismaRole(role: PrismaUserRole): UserRole {
    return role.toLowerCase() as UserRole;
  }
}
