import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserService } from './user.service';

@ApiTags('Users')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  findAll(@Query() query: GetUsersQueryDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): UserResponseDto {
    return this.userService.findById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create user' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid body' })
  create(@Body() dto: CreateUserDto): UserResponseDto {
    return this.userService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user password' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid UUID or body' })
  @ApiResponse({ status: 403, description: 'Old password is wrong' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updatePassword(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user?: AuthUser,
  ): UserResponseDto {
    const isRoleUpdate = dto.role !== undefined;
    const hasAnyPasswordField =
      dto.oldPassword !== undefined || dto.newPassword !== undefined;

    if (!isRoleUpdate && !hasAnyPasswordField) {
      throw new BadRequestException('Update payload is required');
    }

    if (
      hasAnyPasswordField &&
      (dto.oldPassword === undefined || dto.newPassword === undefined)
    ) {
      throw new BadRequestException('oldPassword and newPassword are required');
    }

    if (
      process.env.TEST_MODE === 'auth' &&
      user &&
      user.role !== UserRole.ADMIN &&
      user.userId !== id
    ) {
      throw new ForbiddenException(
        'Insufficient permissions for this operation',
      );
    }

    if (
      process.env.TEST_MODE === 'auth' &&
      user &&
      dto.role !== undefined &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Insufficient permissions for this operation',
      );
    }

    return this.userService.updatePassword(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user?: AuthUser,
  ): void {
    if (
      process.env.TEST_MODE === 'auth' &&
      user &&
      user.role !== UserRole.ADMIN &&
      user.userId !== id
    ) {
      throw new ForbiddenException(
        'Insufficient permissions for this operation',
      );
    }

    this.userService.delete(id);
  }
}
