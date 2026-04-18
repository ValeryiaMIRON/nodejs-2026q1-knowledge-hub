import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient, UserRole } from '@prisma/client';

export const SEED_ADMIN_LOGIN = 'TEST_SEED_ADMIN';
export const SEED_ADMIN_PASSWORD = 'TestSeedAdmin123!';

export default async function globalSetup(): Promise<void> {
  const prisma = new PrismaClient();
  const hashedPassword = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);

  try {
    await prisma.user.upsert({
      where: { login: SEED_ADMIN_LOGIN },
      update: { role: UserRole.ADMIN, password: hashedPassword },
      create: {
        login: SEED_ADMIN_LOGIN,
        password: hashedPassword,
        role: UserRole.ADMIN,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
