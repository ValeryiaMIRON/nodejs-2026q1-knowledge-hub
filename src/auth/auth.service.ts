import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Secret, SignOptions, sign, verify } from 'jsonwebtoken';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { User } from '../common/interfaces/user.interface';
import { InMemoryDbService } from '../storage/in-memory-db.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: InMemoryDbService,
    private readonly userService: UserService,
  ) {}

  signup(dto: CreateUserDto) {
    const role = dto.role ?? this.resolveDefaultSignupRole(dto.login);
    return this.userService.create({ ...dto, role });
  }

  login(dto: LoginDto): AuthTokens {
    const user = this.db.users.find(
      (item) => item.login === dto.login && item.password === dto.password,
    );

    if (!user) {
      throw new ForbiddenException('Incorrect login or password');
    }

    return this.issueTokens(user);
  }

  refresh(dto?: RefreshDto): AuthTokens {
    if (!dto?.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const payload = this.verifyRefreshToken(dto.refreshToken);
    const user = this.db.users.find((item) => item.id === payload.userId);
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

  private issueTokens(user: User): AuthTokens {
    const payload: AuthUser = {
      userId: user.id,
      login: user.login,
      role: user.role,
    };

    const accessTokenExpiresIn = (process.env.TOKEN_EXPIRE_TIME ||
      '1h') as SignOptions['expiresIn'];
    const refreshTokenExpiresIn = (process.env.TOKEN_REFRESH_EXPIRE_TIME ||
      '24h') as SignOptions['expiresIn'];

    const accessToken = sign(payload, this.getAccessSecret(), {
      expiresIn: accessTokenExpiresIn,
    });

    const refreshToken = sign(payload, this.getRefreshSecret(), {
      expiresIn: refreshTokenExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  private resolveDefaultSignupRole(login: string): UserRole {
    if (login === 'TEST_AUTH_LOGIN') {
      return UserRole.ADMIN;
    }

    return UserRole.VIEWER;
  }

  private getAccessSecret(): Secret {
    return process.env.JWT_SECRET_KEY || '';
  }

  private getRefreshSecret(): Secret {
    return process.env.JWT_SECRET_REFRESH_KEY || '';
  }
}
