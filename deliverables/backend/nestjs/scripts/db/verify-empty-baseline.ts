import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()`;
  const names = new Set(tables.map((row) => row.table_name));
  const required = ['users', 'refresh_tokens', 'families', 'family_members', 'health_records', 'assessments', 'consultations', 'medication_plans', 'medication_adherence', 'health_metrics', 'metric_thresholds', 'notifications', 'knowledge', 'health_reports', 'family_role_audits'];
  const missing = required.filter((name) => !names.has(name));
  if (missing.length) throw new Error(`Missing migrated tables: ${missing.join(', ')}`);
  console.log(`Verified ${required.length} application tables on isolated database.`);
}
void main().finally(() => prisma.$disconnect());
