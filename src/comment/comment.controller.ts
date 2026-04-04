import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { GetCommentsQueryDto } from './dto/get-comments-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentService } from './comment.service';

@ApiTags('Comments')
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get()
  @ApiOperation({ summary: 'Get comments by articleId' })
  @ApiResponse({ status: 200, description: 'Comments list' })
  @ApiResponse({ status: 400, description: 'articleId is required' })
  findByArticle(@Query() query: GetCommentsQueryDto) {
    return this.commentService.findByArticle(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get comment by id' })
  @ApiResponse({ status: 200, description: 'Comment found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  findById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.commentService.findById(id);
  }

  @Post()
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create comment' })
  @ApiResponse({ status: 201, description: 'Comment created' })
  @ApiResponse({ status: 400, description: 'Invalid body' })
  @ApiResponse({
    status: 422,
    description: 'Referenced article does not exist',
  })
  create(@Body() dto: CreateCommentDto, @CurrentUser() user?: AuthUser) {
    return this.commentService.create(dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete comment' })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user?: AuthUser,
  ): void {
    this.commentService.delete(id, user);
  }
}
