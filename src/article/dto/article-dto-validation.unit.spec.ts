import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ArticleStatus } from '../../common/enums/article-status.enum';
import { CreateArticleDto } from './create-article.dto';

describe('Article DTO validation', () => {
  it('fails CreateArticleDto when required fields are missing', async () => {
    const dto = new CreateArticleDto();

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['title', 'content']),
    );
  });

  it('fails CreateArticleDto for an invalid status enum', async () => {
    const dto = Object.assign(new CreateArticleDto(), {
      title: 'NestJS Guide',
      content: 'Detailed content here...',
      status: 'invalid-status',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.map((error) => error.property)).toContain('status');
  });

  it('passes CreateArticleDto with a valid payload', async () => {
    const dto = Object.assign(new CreateArticleDto(), {
      title: 'NestJS Guide',
      content: 'Detailed content here...',
      status: ArticleStatus.DRAFT,
      tags: ['nodejs', 'nestjs'],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
