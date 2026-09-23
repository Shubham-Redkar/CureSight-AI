const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const assts = await prisma.assessment.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
  console.log(JSON.stringify(assts, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
