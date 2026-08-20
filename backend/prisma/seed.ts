import { PrismaClient } from '@prisma/client';
import { seedDrugs } from '../src/data/drug-catalog';

// MULTI-TENANT: the only GLOBAL/shared data is the drug catalog (Drug has no tenantId).
// Per-tenant data (owner user, procedures, patients) is created at clinic signup, not here.
// The drug list lives in src/data/drug-catalog.ts so online + offline stay in sync.
const prisma = new PrismaClient();

async function main() {
  const total = await seedDrugs(prisma);
  console.log(`Seed complete: global drug catalog = ${total} drugs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
