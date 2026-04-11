import { PrismaClient, ArticleStatus, UserRole } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.comment.deleteMany();
  await prisma.article.deleteMany();
  await prisma.category.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      login: 'admin_user',
      password: 'admin_pass',
      role: UserRole.ADMIN,
    },
  });

  const editor = await prisma.user.create({
    data: {
      login: 'editor_user',
      password: 'editor_pass',
      role: UserRole.EDITOR,
    },
  });

  const categories = await prisma.$transaction([
    prisma.category.create({
      data: { name: 'Backend', description: 'Backend development articles' },
    }),
    prisma.category.create({
      data: { name: 'Frontend', description: 'Frontend development articles' },
    }),
    prisma.category.create({
      data: { name: 'DevOps', description: 'Infrastructure and deployment' },
    }),
  ]);

  const tagNames = ['nodejs', 'nestjs', 'typescript', 'docker', 'postgres'];
  await prisma.tag.createMany({
    data: tagNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  await prisma.article.create({
    data: {
      title: 'NestJS Basics',
      content: 'Intro to NestJS architecture.',
      status: ArticleStatus.PUBLISHED,
      authorId: admin.id,
      categoryId: categories[0].id,
      tags: {
        connectOrCreate: [
          { where: { name: 'nestjs' }, create: { name: 'nestjs' } },
          { where: { name: 'typescript' }, create: { name: 'typescript' } },
        ],
      },
    },
  });

  await prisma.article.create({
    data: {
      title: 'Docker for Node.js',
      content: 'Containerizing Node.js apps.',
      status: ArticleStatus.DRAFT,
      authorId: editor.id,
      categoryId: categories[2].id,
      tags: {
        connectOrCreate: [
          { where: { name: 'docker' }, create: { name: 'docker' } },
          { where: { name: 'nodejs' }, create: { name: 'nodejs' } },
        ],
      },
    },
  });

  await prisma.article.create({
    data: {
      title: 'PostgreSQL Tips',
      content: 'Useful PostgreSQL practices.',
      status: ArticleStatus.PUBLISHED,
      authorId: admin.id,
      categoryId: categories[2].id,
      tags: {
        connectOrCreate: [
          { where: { name: 'postgres' }, create: { name: 'postgres' } },
        ],
      },
    },
  });

  await prisma.article.create({
    data: {
      title: 'TypeScript Patterns',
      content: 'Patterns in TypeScript apps.',
      status: ArticleStatus.ARCHIVED,
      authorId: editor.id,
      categoryId: categories[0].id,
      tags: {
        connectOrCreate: [
          { where: { name: 'typescript' }, create: { name: 'typescript' } },
        ],
      },
    },
  });

  const articleWithComments = await prisma.article.create({
    data: {
      title: 'API Design',
      content: 'Designing robust REST APIs.',
      status: ArticleStatus.PUBLISHED,
      authorId: admin.id,
      categoryId: categories[0].id,
      tags: {
        connectOrCreate: [
          { where: { name: 'nodejs' }, create: { name: 'nodejs' } },
          { where: { name: 'nestjs' }, create: { name: 'nestjs' } },
        ],
      },
    },
  });

  await prisma.comment.createMany({
    data: [
      {
        content: 'Great article!',
        articleId: articleWithComments.id,
        authorId: admin.id,
      },
      {
        content: 'Very helpful, thanks.',
        articleId: articleWithComments.id,
        authorId: editor.id,
      },
      {
        content: 'Please add more examples.',
        articleId: articleWithComments.id,
        authorId: null,
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
