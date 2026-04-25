import { LogLevel, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: resolveLogLevels(),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

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
