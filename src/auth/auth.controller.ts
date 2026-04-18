import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignupDto } from './dto/signup.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Signup' })
  @ApiResponse({ status: 201, description: 'User created' })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login' })
  @ApiResponse({ status: 200, description: 'Token pair' })
  @ApiResponse({ status: 403, description: 'Incorrect login or password' })
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
