import {
  Body,
  Controller,
  Delete,
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
import { CreateArticleDto } from './dto/create-article.dto';
import { GetArticlesQueryDto } from './dto/get-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleService } from './article.service';

@ApiTags('Articles')
@Controller('article')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  @ApiOperation({ summary: 'Get all articles with optional filters' })
  @ApiResponse({ status: 200, description: 'Articles list' })
  findAll(@Query() query: GetArticlesQueryDto) {
    return this.articleService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get article by id' })
  @ApiResponse({ status: 200, description: 'Article found' })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  findById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.articleService.findById(id);
  }

  @Post()
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create article' })
  @ApiResponse({ status: 201, description: 'Article created' })
  @ApiResponse({ status: 400, description: 'Invalid body' })
  create(@Body() dto: CreateArticleDto, @CurrentUser() user?: AuthUser) {
    return this.articleService.create(dto, user);
  }

  @Put(':id')
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update article' })
  @ApiResponse({ status: 200, description: 'Article updated' })
  @ApiResponse({ status: 400, description: 'Invalid UUID or body' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.articleService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete article' })
  @ApiResponse({ status: 204, description: 'Article deleted' })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): void {
    this.articleService.delete(id);
  }
}
