import { readFileSync } from 'fs';
import { join } from 'path';

// The GLOBAL drug catalog (Drug has no tenantId). Used by BOTH the online seed and the
// offline first-run so prescriptions have the full medicine list on every install.

const CURATED = [
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

const BD = [
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

export function buildDrugList(): { name: string; generic?: string; category?: string; form?: string; strength?: string }[] {
  let bundled: any[] = [];
  try {
    // Bundled full MedEx Bangladesh dental drug DB (also shipped in the offline app).
    bundled = JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'data', 'dental-drugs.json'), 'utf8'));
  } catch { /* fall back to curated list only */ }
  const map = new Map<string, any>();
  for (const d of [...CURATED, ...BD, ...bundled]) {
    const key = `${d.name}|${d.strength}|${d.generic}`.toLowerCase();
    if (!map.has(key)) map.set(key, { name: d.name, generic: d.generic, category: d.category, form: d.form, strength: d.strength });
  }
  return [...map.values()];
}

// Insert any drugs not already present. Idempotent. `skipIfAny` short-circuits when the
// catalog already has rows (used on offline startup to avoid work every launch).
export async function seedDrugs(prisma: any, opts: { skipIfAny?: boolean } = {}): Promise<number> {
  const count = await prisma.drug.count();
  if (opts.skipIfAny && count > 0) return count;
  const list = buildDrugList();
  const existing = await prisma.drug.findMany({ select: { name: true, strength: true, generic: true } });
  const keys = new Set(existing.map((e: any) => `${e.name}|${e.strength}|${e.generic}`.toLowerCase()));
  const toInsert = list.filter((d) => !keys.has(`${d.name}|${d.strength}|${d.generic}`.toLowerCase()));
  for (let i = 0; i < toInsert.length; i += 500) {
    await prisma.drug.createMany({ data: toInsert.slice(i, i + 500) });
  }
  return prisma.drug.count();
}
