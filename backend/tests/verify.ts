import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany();
  console.log(JSON.stringify(users.map(u => ({
    username: u.username,
    role: u.role,
    passwordStoredAsHash: u.passwordHash.startsWith('$argon2')
  })), null, 2));
}

main().finally(() => prisma.$disconnect());
