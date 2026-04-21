import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('connects on module init', async () => {
    const connectSpy = vi
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledOnce();
  });

  it('registers shutdown hook and closes app on beforeExit', async () => {
    const app = { close: vi.fn().mockResolvedValue(undefined) };
    const onSpy = vi.spyOn(process, 'on').mockImplementation(((
      event,
      handler,
    ) => {
      if (event === 'beforeExit') {
        void (handler as () => Promise<void>)();
      }

      return process;
    }) as never);

    await service.enableShutdownHooks(app as never);

    expect(onSpy).toHaveBeenCalled();
    expect(app.close).toHaveBeenCalledOnce();
  });
});
