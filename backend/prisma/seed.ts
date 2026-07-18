import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

// MULTI-TENANT: the only GLOBAL/shared data is the drug catalog (Drug has no tenantId).
// Per-tenant data (owner user, procedures, patients) is created at clinic signup, not here.
const prisma = new PrismaClient();

async function main() {
  // --- Common dental drugs (curated) ---
  const drugs = [
    { name: 'Amoxicillin', generic: 'Amoxicillin', category: 'Antibiotic', form: 'Capsule', strength: '500mg' },
    { name: 'Amoxiclav', generic: 'Amoxicillin + Clavulanic acid', category: 'Antibiotic', form: 'Tablet', strength: '625mg' },
    { name: 'Metronidazole', generic: 'Metronidazole', category: 'Antibiotic', form: 'Tablet', strength: '400mg' },
    { name: 'Azithromycin', generic: 'Azithromycin', category: 'Antibiotic', form: 'Tablet', strength: '500mg' },
    { name: 'Ciprofloxacin', generic: 'Ciprofloxacin', category: 'Antibiotic', form: 'Tablet', strength: '500mg' },
    { name: 'Ibuprofen', generic: 'Ibuprofen', category: 'Analgesic / NSAID', form: 'Tablet', strength: '400mg' },
    { name: 'Paracetamol', generic: 'Paracetamol', category: 'Analgesic', form: 'Tablet', strength: '500mg' },
    { name: 'Diclofenac', generic: 'Diclofenac sodium', category: 'Analgesic / NSAID', form: 'Tablet', strength: '50mg' },
    { name: 'Ketorolac', generic: 'Ketorolac', category: 'Analgesic / NSAID', form: 'Tablet', strength: '10mg' },
    { name: 'Chlorhexidine mouthwash', generic: 'Chlorhexidine gluconate', category: 'Antiseptic', form: 'Mouthwash', strength: '0.2%' },
    { name: 'Betadine gargle', generic: 'Povidone iodine', category: 'Antiseptic', form: 'Gargle', strength: '1%' },
    { name: 'Lignocaine gel', generic: 'Lidocaine', category: 'Local anesthetic', form: 'Gel', strength: '2%' },
    { name: 'Pantoprazole', generic: 'Pantoprazole', category: 'PPI (gastric protection)', form: 'Tablet', strength: '20mg' },
    { name: 'Prednisolone', generic: 'Prednisolone', category: 'Corticosteroid', form: 'Tablet', strength: '5mg' },
    { name: 'Tranexamic acid', generic: 'Tranexamic acid', category: 'Antifibrinolytic (bleeding)', form: 'Tablet', strength: '500mg' },
  ];
  // --- Bangladesh dental brand-name medicines ---
  const bdDrugs = [
    { name: 'Moxacil', generic: 'Amoxicillin', category: 'Antibiotic', form: 'Capsule', strength: '500mg' },
    { name: 'Fimoxyl', generic: 'Amoxicillin', category: 'Antibiotic', form: 'Capsule', strength: '500mg' },
    { name: 'Amoxin', generic: 'Amoxicillin', category: 'Antibiotic', form: 'Capsule', strength: '500mg' },
    { name: 'Moxaclav', generic: 'Amoxicillin + Clavulanic acid', category: 'Antibiotic', form: 'Tablet', strength: '625mg' },
    { name: 'Curam', generic: 'Amoxicillin + Clavulanic acid', category: 'Antibiotic', form: 'Tablet', strength: '625mg' },
    { name: 'Filmet', generic: 'Metronidazole', category: 'Antibiotic', form: 'Tablet', strength: '400mg' },
    { name: 'Flagyl', generic: 'Metronidazole', category: 'Antibiotic', form: 'Tablet', strength: '400mg' },
    { name: 'Metro', generic: 'Metronidazole', category: 'Antibiotic', form: 'Tablet', strength: '400mg' },
    { name: 'Zimax', generic: 'Azithromycin', category: 'Antibiotic', form: 'Tablet', strength: '500mg' },
    { name: 'Azin', generic: 'Azithromycin', category: 'Antibiotic', form: 'Tablet', strength: '500mg' },
    { name: 'Ciprocin', generic: 'Ciprofloxacin', category: 'Antibiotic', form: 'Tablet', strength: '500mg' },
    { name: 'Sefril', generic: 'Cephradine', category: 'Antibiotic', form: 'Capsule', strength: '500mg' },
    { name: 'Doxicap', generic: 'Doxycycline', category: 'Antibiotic', form: 'Capsule', strength: '100mg' },
    { name: 'Napa', generic: 'Paracetamol', category: 'Analgesic', form: 'Tablet', strength: '500mg' },
    { name: 'Ace', generic: 'Paracetamol', category: 'Analgesic', form: 'Tablet', strength: '500mg' },
    { name: 'Napa Extra', generic: 'Paracetamol + Caffeine', category: 'Analgesic', form: 'Tablet', strength: '500mg+65mg' },
    { name: 'Profen', generic: 'Ibuprofen', category: 'Analgesic / NSAID', form: 'Tablet', strength: '400mg' },
    { name: 'Flamex', generic: 'Ibuprofen', category: 'Analgesic / NSAID', form: 'Tablet', strength: '400mg' },
    { name: 'Clofenac', generic: 'Diclofenac sodium', category: 'Analgesic / NSAID', form: 'Tablet', strength: '50mg' },
    { name: 'Aceclo', generic: 'Aceclofenac', category: 'Analgesic / NSAID', form: 'Tablet', strength: '100mg' },
    { name: 'Tory', generic: 'Etoricoxib', category: 'Analgesic / NSAID', form: 'Tablet', strength: '90mg' },
    { name: 'Rolac', generic: 'Ketorolac', category: 'Analgesic / NSAID', form: 'Tablet', strength: '10mg' },
    { name: 'Orobex', generic: 'Chlorhexidine gluconate', category: 'Antiseptic', form: 'Mouthwash', strength: '0.2%' },
    { name: 'Hexisol', generic: 'Chlorhexidine gluconate', category: 'Antiseptic', form: 'Mouthwash', strength: '0.2%' },
    { name: 'Viodin', generic: 'Povidone iodine', category: 'Antiseptic', form: 'Gargle', strength: '1%' },
    { name: 'Jasocaine', generic: 'Lidocaine', category: 'Local anesthetic', form: 'Gel', strength: '2%' },
    { name: 'Sergel', generic: 'Esomeprazole', category: 'PPI (gastric protection)', form: 'Capsule', strength: '20mg' },
    { name: 'Maxpro', generic: 'Esomeprazole', category: 'PPI (gastric protection)', form: 'Capsule', strength: '20mg' },
    { name: 'Pantonix', generic: 'Pantoprazole', category: 'PPI (gastric protection)', form: 'Tablet', strength: '20mg' },
    { name: 'Seclo', generic: 'Omeprazole', category: 'PPI (gastric protection)', form: 'Capsule', strength: '20mg' },
    { name: 'Traxyl', generic: 'Tranexamic acid', category: 'Antifibrinolytic (bleeding)', form: 'Tablet', strength: '500mg' },
    { name: 'Cortan', generic: 'Prednisolone', category: 'Corticosteroid', form: 'Tablet', strength: '5mg' },
    { name: 'Fexo', generic: 'Fexofenadine', category: 'Antihistamine', form: 'Tablet', strength: '120mg' },
    { name: 'Alatrol', generic: 'Cetirizine', category: 'Antihistamine', form: 'Tablet', strength: '10mg' },
  ];
  // Full dental drug DB (MedEx Bangladesh, dental generics, all brands) — bundled offline.
  let bundled: any[] = [];
  try {
    bundled = JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'data', 'dental-drugs.json'), 'utf8'));
  } catch {
    console.warn('dental-drugs.json not found — using curated list only');
  }
  const combined = [...drugs, ...bdDrugs, ...bundled];
  const map = new Map<string, any>();
  for (const d of combined) {
    const key = `${d.name}|${d.strength}|${d.generic}`.toLowerCase();
    if (!map.has(key)) map.set(key, { name: d.name, generic: d.generic, category: d.category, form: d.form, strength: d.strength });
  }
  // Idempotent: only insert drugs not already present (safe to re-run).
  const existing = await prisma.drug.findMany({ select: { name: true, strength: true, generic: true } });
  const existingKeys = new Set(existing.map((e) => `${e.name}|${e.strength}|${e.generic}`.toLowerCase()));
  const toInsert = [...map.values()].filter(
    (d) => !existingKeys.has(`${d.name}|${d.strength}|${d.generic}`.toLowerCase()),
  );
  for (let i = 0; i < toInsert.length; i += 500) {
    await prisma.drug.createMany({ data: toInsert.slice(i, i + 500) });
  }
  const totalDrugs = await prisma.drug.count();
  console.log(`Seed complete: global drug catalog = ${totalDrugs} drugs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
