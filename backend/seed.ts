import { PrismaClient, UserRole } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const adminUsername = process.env.DEMO_ADMIN_USERNAME;
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
  const doctorUsername = process.env.DEMO_DOCTOR_USERNAME;
  const doctorPassword = process.env.DEMO_DOCTOR_PASSWORD;

  if (!adminUsername || !adminPassword || !doctorUsername || !doctorPassword) {
    console.error('Missing DEMO_ user credentials in environment variables.');
    process.exit(1);
  }

  // Upsert ADMIN
  const adminHash = await argon2.hash(adminPassword);
  await prisma.user.upsert({
    where: { username: adminUsername },
    update: { passwordHash: adminHash, role: UserRole.ADMIN },
    create: {
      username: adminUsername,
      passwordHash: adminHash,
      role: UserRole.ADMIN,
    },
  });

  // Upsert DOCTOR
  const doctorHash = await argon2.hash(doctorPassword);
  await prisma.user.upsert({
    where: { username: doctorUsername },
    update: { passwordHash: doctorHash, role: UserRole.DOCTOR },
    create: {
      username: doctorUsername,
      passwordHash: doctorHash,
      role: UserRole.DOCTOR,
    },
  });

  console.log('Seed completed: ADMIN and DOCTOR accounts provisioned.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
