import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignupDto } from './dto/signup.dto';

const AUTH_RATE_LIMIT = {
  limit: 5,
  ttlMs: 60_000,
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @RateLimit(AUTH_RATE_LIMIT)
  @Post('signup')
  @ApiOperation({ summary: 'Signup' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 429, description: 'Too many requests from this IP' })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @RateLimit(AUTH_RATE_LIMIT)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login' })
  @ApiResponse({ status: 200, description: 'Token pair' })
  @ApiResponse({ status: 403, description: 'Incorrect login or password' })
  @ApiResponse({ status: 429, description: 'Too many requests from this IP' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh tokens' })
  @ApiResponse({ status: 200, description: 'New token pair' })
  @ApiResponse({ status: 401, description: 'No refresh token' })
  @ApiResponse({ status: 403, description: 'Invalid refresh token' })
  refresh(@Body() dto?: { refreshToken?: string }) {
    return this.authService.refresh(dto as RefreshDto | undefined);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout (invalidate refresh token)' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  @ApiResponse({ status: 400, description: 'No refresh token' })
  async logout(@Body() dto: { refreshToken?: string }) {
    if (!dto?.refreshToken) {
      return { message: 'No refresh token provided' };
    }
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out' };
  }
}
