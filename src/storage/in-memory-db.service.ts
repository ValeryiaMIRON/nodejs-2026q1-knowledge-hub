import { Injectable } from '@nestjs/common';
import { User } from '../common/interfaces/user.interface';
import { Article } from '../common/interfaces/article.interface';
import { Category } from '../common/interfaces/category.interface';
import { Comment } from '../common/interfaces/comment.interface';

@Injectable()
export class InMemoryDbService {
  users: User[] = [];
  articles: Article[] = [];
  categories: Category[] = [];
  comments: Comment[] = [];
}
