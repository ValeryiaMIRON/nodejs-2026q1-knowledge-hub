import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

@Injectable()
export class FileLoggerService implements LoggerService {
  private readonly activeLevels: Set<LogLevel>;
  private readonly maxFileSizeBytes: number;

  constructor(levels: LogLevel[]) {
    this.activeLevels = new Set(levels);
    this.maxFileSizeBytes = this.resolveMaxFileSizeBytes();
    this.ensureLogDirectory();
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    if (!this.activeLevels.has(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const payload: Record<string, unknown> = {
      timestamp,
      level,
      context: context || 'Application',
      message: this.normalizeMessage(message),
    };

    if (trace) {
      payload.trace = trace;
    }

    const line = `${JSON.stringify(payload)}\n`;

    this.rotateIfNeeded(line.length);
    fs.appendFileSync(LOG_FILE, line, { encoding: 'utf-8' });

    if (process.env.NODE_ENV === 'production') {
      process.stdout.write(line);
      return;
    }

    const contextLabel = payload.context as string;
    const formatted = `[${timestamp}] [${level.toUpperCase()}] [${contextLabel}] ${payload.message}`;
    if (level === 'error') {
      process.stderr.write(`${formatted}${trace ? `\n${trace}` : ''}\n`);
    } else {
      process.stdout.write(`${formatted}\n`);
    }
  }

  private normalizeMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    return JSON.stringify(message);
  }

  private resolveMaxFileSizeBytes(): number {
    const maxKb = Number(process.env.LOG_MAX_FILE_SIZE || '1024');
    if (Number.isNaN(maxKb) || maxKb <= 0) {
      return 1024 * 1024;
    }

    return maxKb * 1024;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    if (!fs.existsSync(LOG_FILE)) {
      fs.writeFileSync(LOG_FILE, '', { encoding: 'utf-8' });
    }
  }

  private rotateIfNeeded(nextBytes: number): void {
    if (!fs.existsSync(LOG_FILE)) {
      return;
    }

    const { size } = fs.statSync(LOG_FILE);
    if (size + nextBytes <= this.maxFileSizeBytes) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedName = path.join(LOG_DIR, `app-${timestamp}.log`);
    fs.renameSync(LOG_FILE, rotatedName);
    fs.writeFileSync(LOG_FILE, '', { encoding: 'utf-8' });
  }
}
