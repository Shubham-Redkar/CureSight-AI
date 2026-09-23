import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const assessments = await prisma.assessment.findMany({
    select: {
      id: true,
      status: true,
    }
  });
  console.log("Found", assessments.length, "assessments.");
  const statuses = assessments.map(a => a.status);
  const uniqueStatuses = [...new Set(statuses)];
  console.log("Unique statuses:", uniqueStatuses);
  console.log("All assessments:", assessments);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
