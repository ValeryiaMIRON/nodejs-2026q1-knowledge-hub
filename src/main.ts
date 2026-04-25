import { INestApplication, LogLevel, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { FileLoggerService } from './common/logging/file-logger.service';
import { PrismaService } from './prisma/prisma.service';

const SUPPORTED_LOG_LEVELS: LogLevel[] = [
  'log',
  'debug',
  'warn',
  'error',
  'verbose',
];

function resolveLogLevels(): LogLevel[] {
  const envLevel = (process.env.LOG_LEVEL || 'log').toLowerCase() as LogLevel;
  if (!SUPPORTED_LOG_LEVELS.includes(envLevel)) {
    return ['log'];
  }

  const startIndex = SUPPORTED_LOG_LEVELS.indexOf(envLevel);
  return SUPPORTED_LOG_LEVELS.slice(startIndex);
}

async function gracefulShutdown(app: INestApplication): Promise<void> {
  try {
    await app.close();
  } catch {
    // Ignore close errors during forced shutdown flow.
  }

  try {
    const prisma = app.get(PrismaService, { strict: false });
    if (prisma) {
      await prisma.$disconnect();
    }
  } catch {
    // Ignore prisma retrieval/disconnect errors during shutdown.
  }
}

function registerProcessErrorHandlers(
  app: INestApplication,
  logger: FileLoggerService,
): void {
  const handleFatalError = async (
    type: 'uncaughtException' | 'unhandledRejection',
    error: unknown,
  ) => {
    if (error instanceof Error) {
      logger.error(`[${type}] ${error.message}`, error.stack, 'Process');
    } else {
      logger.error(`[${type}] ${JSON.stringify(error)}`, undefined, 'Process');
    }

    await gracefulShutdown(app);
    process.exit(1);
  };

  process.on('uncaughtException', (error) => {
    void handleFatalError('uncaughtException', error);
  });

  process.on('unhandledRejection', (reason) => {
    void handleFatalError('unhandledRejection', reason);
  });
}

async function bootstrap() {
  const levels = resolveLogLevels();
  const logger = new FileLoggerService(levels);

  const app = await NestFactory.create(AppModule, {
    logger,
  });

  registerProcessErrorHandlers(app, logger);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Knowledge Hub API')
    .setDescription('Knowledge Hub service documentation')
    .setVersion('1.0.0')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('doc', app, swaggerDocument);

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
}
bootstrap();
