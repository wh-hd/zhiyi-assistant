import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main(): Promise<void> {
  const duplicateSort = await prisma.$queryRaw<Array<{ familyId: string; sortOrder: number; count: bigint }>>`
    SELECT familyId, sortOrder, COUNT(*) count FROM family_members GROUP BY familyId, sortOrder HAVING COUNT(*) > 1`;
  const duplicateAdherence = await prisma.$queryRaw<Array<{ planId: string; scheduledAt: Date; count: bigint }>>`
    SELECT planId, scheduledAt, COUNT(*) count FROM medication_adherence GROUP BY planId, scheduledAt HAVING COUNT(*) > 1`;
  if (duplicateSort.length || duplicateAdherence.length) {
    throw new Error(`Preflight blocked: familySort=${duplicateSort.length}, adherence=${duplicateAdherence.length}`);
  }
  console.log('Preflight passed: no duplicate keys; no data was modified.');
}
void main().finally(() => prisma.$disconnect());
