import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { compare } from 'bcrypt';
import { sign, verify } from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../common/enums/user-role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  sign: vi.fn(),
  verify: vi.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findUnique: vi.fn(),
    },
    revokedToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  };

  const userServiceMock = {
    create: vi.fn(),
  };

  const bcryptCompare = vi.mocked(compare);
  const jwtSign = vi.mocked(sign);
  const jwtVerify = vi.mocked(verify);

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
    delete process.env.TEST_MODE;
    process.env.JWT_SECRET = 'access-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_TTL = '7d';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: UserService,
          useValue: userServiceMock,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('creates a viewer user on signup', async () => {
    userServiceMock.create.mockResolvedValue({ id: 'user-id' });

    await service.signup({ login: 'john', password: 'secure-password' });

    expect(userServiceMock.create).toHaveBeenCalledWith({
      login: 'john',
      password: 'secure-password',
      role: UserRole.VIEWER,
    });
  });

  it('reuses existing TEST_ user in TEST_MODE', async () => {
    process.env.TEST_MODE = 'auth';
    prismaMock.user.findUnique.mockResolvedValue(buildUser());

    const result = await service.signup({
      login: 'TEST_AUTH_LOGIN',
      password: 'secure-password',
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { login: 'TEST_AUTH_LOGIN' },
    });
    expect(userServiceMock.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'user-id',
      login: 'john',
      role: UserRole.VIEWER,
      createdAt: new Date('2024-01-01T00:00:00.000Z').getTime(),
      updatedAt: new Date('2024-01-01T00:00:00.000Z').getTime(),
    });
  });

  it('throws ForbiddenException when login user is missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ login: 'john', password: 'secure-password' }),
    ).rejects.toThrowError(
      new ForbiddenException('Incorrect login or password'),
    );
  });

  it('throws ForbiddenException when login password is invalid', async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    bcryptCompare.mockResolvedValue(false as never);

    await expect(
      service.login({ login: 'john', password: 'wrong-password' }),
    ).rejects.toThrowError(
      new ForbiddenException('Incorrect login or password'),
    );
  });

  it('returns access and refresh tokens on successful login', async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    bcryptCompare.mockResolvedValue(true as never);
    jwtSign.mockReturnValueOnce('access-token' as never);
    jwtSign.mockReturnValueOnce('refresh-token' as never);

    await expect(
      service.login({ login: 'john', password: 'secure-password' }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('adds refresh token to revoked list on logout', async () => {
    prismaMock.revokedToken.create.mockResolvedValue(undefined);

    await service.logout('refresh-token');

    expect(prismaMock.revokedToken.create).toHaveBeenCalledWith({
      data: { token: 'refresh-token' },
    });
  });

  it('throws UnauthorizedException when refresh token is missing', async () => {
    await expect(service.refresh()).rejects.toThrowError(
      new UnauthorizedException('Refresh token is required'),
    );
  });

  it('throws ForbiddenException when refresh token is revoked', async () => {
    prismaMock.revokedToken.findUnique.mockResolvedValue({ id: 'revoked-id' });

    await expect(
      service.refresh({ refreshToken: 'refresh-token' }),
    ).rejects.toThrowError(
      new ForbiddenException('Invalid or expired refresh token'),
    );
  });

  it('throws ForbiddenException when refresh token is invalid or expired', async () => {
    prismaMock.revokedToken.findUnique.mockResolvedValue(null);
    jwtVerify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    await expect(
      service.refresh({ refreshToken: 'invalid-token' }),
    ).rejects.toThrowError(
      new ForbiddenException('Invalid or expired refresh token'),
    );
  });

  it('throws ForbiddenException when refresh payload user is missing', async () => {
    prismaMock.revokedToken.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);
    jwtVerify.mockReturnValue({
      userId: 'missing-id',
      login: 'john',
      role: UserRole.VIEWER,
    } as never);

    await expect(
      service.refresh({ refreshToken: 'refresh-token' }),
    ).rejects.toThrowError(
      new ForbiddenException('Invalid or expired refresh token'),
    );
  });

  it('rotates tokens on successful refresh', async () => {
    prismaMock.revokedToken.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(buildUser());
    jwtVerify.mockReturnValue({
      userId: 'user-id',
      login: 'john',
      role: UserRole.VIEWER,
    } as never);
    jwtSign.mockReturnValueOnce('new-access-token' as never);
    jwtSign.mockReturnValueOnce('new-refresh-token' as never);

    await expect(
      service.refresh({ refreshToken: 'refresh-token' }),
    ).resolves.toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });

  it('returns decoded payload for a valid access token', () => {
    jwtVerify.mockReturnValue({
      userId: 'user-id',
      login: 'john',
      role: UserRole.ADMIN,
    } as never);

    expect(service.verifyAccessToken('access-token')).toEqual({
      userId: 'user-id',
      login: 'john',
      role: UserRole.ADMIN,
    });
  });

  it('throws UnauthorizedException for invalid access token', () => {
    jwtVerify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    expect(() => service.verifyAccessToken('invalid-token')).toThrowError(
      new UnauthorizedException('Access token is missing or invalid'),
    );
  });
});
