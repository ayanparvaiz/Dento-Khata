import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  // --- Clinic settings (singleton) ---
  await prisma.clinicSettings.upsert({
    where: { id: 'clinic' },
    update: {},
    create: { id: 'clinic', name: 'My Dental Clinic', toothNotation: 'FDI', currency: 'BDT' },
  });

  // --- Default admin user ---
  const adminUsername = 'admin';
  const adminExists = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        username: adminUsername,
        passwordHash: await bcrypt.hash('admin123', 10), // CHANGE after first login
        fullName: 'Administrator',
        role: 'ADMIN',
      },
    });
    console.log('Created admin user (username: admin, password: admin123) - change this!');
  }

  // --- Procedure catalog (common dental procedures) ---
  const procedures = [
    { code: 'D0120', name: 'Periodic oral examination', category: 'Diagnostic', defaultFee: 500 },
    { code: 'D0140', name: 'Limited oral evaluation', category: 'Diagnostic', defaultFee: 500 },
    { code: 'D0210', name: 'Intraoral X-ray (full series)', category: 'Diagnostic', defaultFee: 800 },
    { code: 'D1110', name: 'Scaling & polishing (cleaning)', category: 'Preventive', defaultFee: 1500 },
    { code: 'D1206', name: 'Topical fluoride application', category: 'Preventive', defaultFee: 600 },
    { code: 'D2140', name: 'Amalgam filling - 1 surface', category: 'Restorative', defaultFee: 1000 },
    { code: 'D2330', name: 'Composite filling - 1 surface (anterior)', category: 'Restorative', defaultFee: 1500 },
    { code: 'D2391', name: 'Composite filling - 1 surface (posterior)', category: 'Restorative', defaultFee: 1800 },
    { code: 'D2740', name: 'Crown - porcelain/ceramic', category: 'Restorative', defaultFee: 12000 },
    { code: 'D2750', name: 'Crown - porcelain fused to metal', category: 'Restorative', defaultFee: 9000 },
    { code: 'D3310', name: 'Root canal - anterior', category: 'Endodontics', defaultFee: 6000 },
    { code: 'D3320', name: 'Root canal - premolar', category: 'Endodontics', defaultFee: 7000 },
    { code: 'D3330', name: 'Root canal - molar', category: 'Endodontics', defaultFee: 9000 },
    { code: 'D4341', name: 'Periodontal scaling & root planing (per quadrant)', category: 'Periodontics', defaultFee: 3000 },
    { code: 'D5110', name: 'Complete denture - upper', category: 'Prosthodontics', defaultFee: 25000 },
    { code: 'D5120', name: 'Complete denture - lower', category: 'Prosthodontics', defaultFee: 25000 },
    { code: 'D6010', name: 'Dental implant - surgical placement', category: 'Implants', defaultFee: 45000 },
    { code: 'D7140', name: 'Tooth extraction (simple)', category: 'Oral Surgery', defaultFee: 1500 },
    { code: 'D7210', name: 'Surgical extraction', category: 'Oral Surgery', defaultFee: 4000 },
    { code: 'D8080', name: 'Orthodontic treatment (braces)', category: 'Orthodontics', defaultFee: 60000 },
    { code: 'D9110', name: 'Emergency pain relief', category: 'Adjunctive', defaultFee: 800 },
  ];
  for (const p of procedures) {
    await prisma.procedure.upsert({ where: { code: p.code }, update: {}, create: p });
  }

  // --- Common dental drug list ---
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
  // --- Bangladesh dental brand-name medicines (what dentists actually prescribe) ---
  const bdDrugs = [
    // Antibiotics
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
    // Analgesics / NSAIDs
    { name: 'Napa', generic: 'Paracetamol', category: 'Analgesic', form: 'Tablet', strength: '500mg' },
    { name: 'Ace', generic: 'Paracetamol', category: 'Analgesic', form: 'Tablet', strength: '500mg' },
    { name: 'Napa Extra', generic: 'Paracetamol + Caffeine', category: 'Analgesic', form: 'Tablet', strength: '500mg+65mg' },
    { name: 'Profen', generic: 'Ibuprofen', category: 'Analgesic / NSAID', form: 'Tablet', strength: '400mg' },
    { name: 'Flamex', generic: 'Ibuprofen', category: 'Analgesic / NSAID', form: 'Tablet', strength: '400mg' },
    { name: 'Clofenac', generic: 'Diclofenac sodium', category: 'Analgesic / NSAID', form: 'Tablet', strength: '50mg' },
    { name: 'Aceclo', generic: 'Aceclofenac', category: 'Analgesic / NSAID', form: 'Tablet', strength: '100mg' },
    { name: 'Tory', generic: 'Etoricoxib', category: 'Analgesic / NSAID', form: 'Tablet', strength: '90mg' },
    { name: 'Rolac', generic: 'Ketorolac', category: 'Analgesic / NSAID', form: 'Tablet', strength: '10mg' },
    // Antiseptics / topical
    { name: 'Orobex', generic: 'Chlorhexidine gluconate', category: 'Antiseptic', form: 'Mouthwash', strength: '0.2%' },
    { name: 'Hexisol', generic: 'Chlorhexidine gluconate', category: 'Antiseptic', form: 'Mouthwash', strength: '0.2%' },
    { name: 'Viodin', generic: 'Povidone iodine', category: 'Antiseptic', form: 'Gargle', strength: '1%' },
    { name: 'Jasocaine', generic: 'Lidocaine', category: 'Local anesthetic', form: 'Gel', strength: '2%' },
    // Gastric protection (with NSAIDs)
    { name: 'Sergel', generic: 'Esomeprazole', category: 'PPI (gastric protection)', form: 'Capsule', strength: '20mg' },
    { name: 'Maxpro', generic: 'Esomeprazole', category: 'PPI (gastric protection)', form: 'Capsule', strength: '20mg' },
    { name: 'Pantonix', generic: 'Pantoprazole', category: 'PPI (gastric protection)', form: 'Tablet', strength: '20mg' },
    { name: 'Seclo', generic: 'Omeprazole', category: 'PPI (gastric protection)', form: 'Capsule', strength: '20mg' },
    // Bleeding / steroid / others
    { name: 'Traxyl', generic: 'Tranexamic acid', category: 'Antifibrinolytic (bleeding)', form: 'Tablet', strength: '500mg' },
    { name: 'Cortan', generic: 'Prednisolone', category: 'Corticosteroid', form: 'Tablet', strength: '5mg' },
    { name: 'Fexo', generic: 'Fexofenadine', category: 'Antihistamine', form: 'Tablet', strength: '120mg' },
    { name: 'Alatrol', generic: 'Cetirizine', category: 'Antihistamine', form: 'Tablet', strength: '10mg' },
  ];
  // Full dental drug DB (MedEx Bangladesh, dental generics only, ALL companies' brands) — bundled offline.
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
  // Idempotent: only insert drugs not already present (safe to re-run, no deletes / FK breakage).
  const existing = await prisma.drug.findMany({ select: { name: true, strength: true, generic: true } });
  const existingKeys = new Set(existing.map((e) => `${e.name}|${e.strength}|${e.generic}`.toLowerCase()));
  const toInsert = [...map.values()].filter(
    (d) => !existingKeys.has(`${d.name}|${d.strength}|${d.generic}`.toLowerCase()),
  );
  for (let i = 0; i < toInsert.length; i += 500) {
    await prisma.drug.createMany({ data: toInsert.slice(i, i + 500) });
  }
  const totalDrugs = await prisma.drug.count();
  console.log(`Seed complete: ${procedures.length} procedures, ${totalDrugs} drugs (dental, MedEx BD, all brands).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
