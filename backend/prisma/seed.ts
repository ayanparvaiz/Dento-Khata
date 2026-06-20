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

  // `DEMO_RESET=1` wipes patient data and reloads the full demo (local only — see every state).
  if (process.env.DEMO_RESET) {
    await prisma.patient.deleteMany({}); // cascades appts, plans, items, records, rx, charting, notes, payments
    console.log('DEMO_RESET: cleared patient data — reseeding fresh demo.');
  }
  await seedDemo();
}

// ---------------------------------------------------------------------------
// Demo data — realistic patients, treatments, payments, appointments, charting,
// prescriptions & notes so the app isn't empty for a demo.
// Idempotent: only runs on a fresh DB (no patients yet), so redeploys never dupe.
// ---------------------------------------------------------------------------
async function seedDemo() {
  const existing = await prisma.patient.count();
  if (existing > 0) {
    console.log(`Demo seed skipped — ${existing} patient(s) already present.`);
    return;
  }

  const dentist = await prisma.user.upsert({
    where: { username: 'dr.rahman' },
    update: {},
    create: { username: 'dr.rahman', passwordHash: await bcrypt.hash('dentist123', 10), fullName: 'Dr. S. Rahman', role: 'ADMIN' },
  });

  const P = Object.fromEntries((await prisma.procedure.findMany()).map((p) => [p.code, p] as const));
  const now = new Date();
  const day = (n: number) => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };
  const at = (d: Date, h: number, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
  let seq = 0;
  const code = () => `P-${String(++seq).padStart(5, '0')}`;

  const item = (c: string, o: { tooth?: string; status?: string; doneDaysAgo?: number; priority?: number } = {}) => ({
    procedureId: P[c].id,
    fee: P[c].defaultFee,
    toothNumber: o.tooth ?? null,
    priority: o.priority ?? 0,
    status: o.status ?? 'PLANNED',
    completedAt: o.status === 'COMPLETED' ? day(-(o.doneDaysAgo ?? 7)) : null,
    billed: o.status === 'COMPLETED',
  });
  const rx = async (name: string, dosage: string, frequency: string, duration: string, instruction?: string) => {
    const d = await prisma.drug.findFirst({ where: { name } });
    return { drugId: d?.id ?? null, drugName: d?.name ?? name, generic: d?.generic ?? null, dosage, frequency, duration, route: 'Oral', instruction };
  };

  async function patient(data: any, opts: {
    medical?: any; teeth?: any[]; plans?: any[]; notes?: string[];
    prescriptions?: { diagnosis: string; advice?: string; items: any[] }[];
    appts?: { start: Date; dur?: number; status: string; reason?: string; chair?: string }[];
    payments?: { amount: number; method: string; daysAgo: number; note?: string; recordIdx?: number }[];
    records?: { content: string; daysAgo: number; planIdx?: number }[];
  }) {
    const p = await prisma.patient.create({
      data: {
        code: code(),
        ...data,
        medicalHistory: opts.medical ? { create: opts.medical } : undefined,
        toothRecords: opts.teeth ? { create: opts.teeth } : undefined,
        clinicalNotes: opts.notes ? { create: opts.notes.map((content) => ({ content, authorId: dentist.id })) } : undefined,
        treatmentPlans: opts.plans
          ? { create: opts.plans.map((pl) => ({ title: pl.title, status: pl.status, items: { create: pl.items } })) }
          : undefined,
      },
    });
    let completedAppt: string | undefined;
    for (const a of opts.appts ?? []) {
      const ap = await prisma.appointment.create({
        data: {
          patientId: p.id, dentistId: dentist.id, chair: a.chair ?? 'Chair 1',
          startTime: a.start, endTime: new Date(a.start.getTime() + (a.dur ?? 60) * 60000),
          status: a.status, reason: a.reason,
        },
      });
      if (a.status === 'COMPLETED') completedAppt = ap.id;
    }
    // records first, so payments can attach to a visit
    const recIds: string[] = [];
    if (opts.records?.length) {
      const pls = await prisma.treatmentPlan.findMany({ where: { patientId: p.id }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      for (const r of opts.records) {
        const rec = await prisma.treatmentRecord.create({
          data: { patientId: p.id, content: r.content, planId: pls[r.planIdx ?? 0]?.id ?? null, visitDate: day(-r.daysAgo), authorId: dentist.id },
        });
        recIds.push(rec.id);
      }
    }
    for (const pay of opts.payments ?? []) {
      await prisma.payment.create({
        data: {
          patientId: p.id, amount: pay.amount, method: pay.method, note: pay.note,
          paidAt: at(day(-pay.daysAgo), 11 + (seq % 6), (seq * 7) % 60),
          appointmentId: completedAppt,
          treatmentRecordId: pay.recordIdx != null ? recIds[pay.recordIdx] ?? null : null,
          receivedBy: dentist.fullName,
        },
      });
    }
    for (const r of opts.prescriptions ?? []) {
      await prisma.prescription.create({
        data: { patientId: p.id, dentistId: dentist.id, diagnosis: r.diagnosis, advice: r.advice, items: { create: r.items } },
      });
    }
    return p;
  }

  // 1) Karim Ahmed — RCT + crown in progress, penicillin allergy (alert), part-paid
  await patient(
    { fullName: 'Karim Ahmed', gender: 'MALE', dateOfBirth: new Date('1989-04-12'), phone: '01711111111', address: 'Dhanmondi, Dhaka', bloodGroup: 'B+', occupation: 'Banker', maritalStatus: 'MARRIED' },
    {
      medical: { allergies: 'Penicillin, Latex', conditions: 'Hypertension', medications: 'Amlodipine 5mg', habits: 'Occasional smoking', premedRequired: true },
      teeth: [
        { toothNumber: '46', condition: 'RCT', status: 'COMPLETED', note: 'RCT done, crown pending' },
        { toothNumber: '36', surface: 'O', condition: 'CARIES', status: 'EXISTING' },
        { toothNumber: '16', condition: 'FILLED', status: 'EXISTING' },
      ],
      plans: [{ title: 'RCT & crown — lower right molar', status: 'IN_PROGRESS', items: [
        item('D0120', { status: 'COMPLETED', doneDaysAgo: 34 }),
        item('D3330', { tooth: '46', status: 'COMPLETED', doneDaysAgo: 20 }),
        item('D2750', { tooth: '46', status: 'PLANNED' }),
      ] }],
      payments: [
        { amount: 2000, method: 'CASH', daysAgo: 34, note: 'Consultation + part RCT', recordIdx: 0 },
        { amount: 3000, method: 'BKASH', daysAgo: 20, recordIdx: 2 },
        { amount: 2000, method: 'CASH', daysAgo: 6, recordIdx: 3 },
      ],
      prescriptions: [{ diagnosis: 'Irreversible pulpitis 46 — post RCT', advice: 'Avoid chewing on the treated side until crown is placed.', items: [
        await rx('Moxacil', '1+0+1', 'Twice daily', '7 days', 'After meal'),
        await rx('Tory', '0+0+1', 'Once daily', '5 days', 'After meal — for pain'),
        await rx('Orobex', '10 ml', 'Rinse twice daily', '7 days', 'Do not swallow'),
      ] }],
      appts: [
        { start: at(day(-20), 11, 0), dur: 60, status: 'COMPLETED', reason: 'Root canal — molar' },
        { start: at(day(4), 17, 0), dur: 60, status: 'CONFIRMED', reason: 'Crown fitting' },
      ],
      records: [
        { content: 'Examination + IOPA x-ray of 46; diagnosed irreversible pulpitis.', daysAgo: 34 },
        { content: 'RCT 46 — access opened, canals cleaned & shaped, calcium hydroxide dressing.', daysAgo: 27 },
        { content: 'RCT 46 — obturation done (gutta-percha). Tooth asymptomatic.', daysAgo: 20 },
        { content: 'Crown 46 — tooth prepared, shade selected, impression taken.', daysAgo: 6 },
      ],
      notes: ['Patient tolerated RCT well. Crown impression to be taken next visit.'],
    },
  );

  // 2) Fatema Begum — braces, monthly installments (big revenue), regular adjustments
  await patient(
    { fullName: 'Fatema Begum', gender: 'FEMALE', dateOfBirth: new Date('2002-09-23'), phone: '01822222222', address: 'Uttara, Dhaka', bloodGroup: 'O+', occupation: 'Student', maritalStatus: 'SINGLE' },
    {
      medical: { conditions: '', habits: '' },
      teeth: [{ toothNumber: '21', condition: 'CARIES', status: 'EXISTING', surface: 'M' }],
      plans: [{ title: 'Orthodontic treatment (fixed braces)', status: 'IN_PROGRESS', items: [
        item('D0120', { status: 'COMPLETED', doneDaysAgo: 33 }),
        item('D0210', { status: 'COMPLETED', doneDaysAgo: 33 }),
        item('D8080', { status: 'PLANNED', priority: 1 }),
      ] }],
      payments: [
        { amount: 8000, method: 'BKASH', daysAgo: 33, note: 'Braces down payment', recordIdx: 0 },
        { amount: 5000, method: 'CASH', daysAgo: 26, recordIdx: 0 },
        { amount: 5000, method: 'NAGAD', daysAgo: 12, recordIdx: 1 },
        { amount: 5000, method: 'CASH', daysAgo: 2, recordIdx: 1 },
      ],
      appts: [
        { start: at(day(-5), 13, 0), dur: 60, status: 'COMPLETED', reason: 'Monthly adjustment' },
        { start: at(day(0), 16, 0), dur: 60, status: 'CONFIRMED', reason: 'Wire adjustment', chair: 'Chair 2' },
      ],
      records: [
        { content: 'Braces bonded (upper & lower), initial NiTi archwire placed.', daysAgo: 33 },
        { content: 'Monthly adjustment — archwire changed, oral hygiene reinforced.', daysAgo: 5 },
      ],
      notes: ['Good oral hygiene. Continue monthly adjustments.'],
    },
  );

  // 3) Rahim Uddin — extraction + upper denture, fully paid
  await patient(
    { fullName: 'Rahim Uddin', gender: 'MALE', dateOfBirth: new Date('1958-01-05'), phone: '01933333333', address: 'Mirpur, Dhaka', bloodGroup: 'A+', occupation: 'Retired', maritalStatus: 'MARRIED' },
    {
      medical: { conditions: 'Diabetes (Type 2)', medications: 'Metformin 500mg', habits: 'Betel nut' },
      teeth: [
        { toothNumber: '26', condition: 'EXTRACTED', status: 'COMPLETED' },
        { toothNumber: '11', condition: 'MISSING', status: 'EXISTING' },
      ],
      plans: [{ title: 'Extraction & complete upper denture', status: 'COMPLETED', items: [
        item('D7140', { tooth: '26', status: 'COMPLETED', doneDaysAgo: 28 }),
        item('D5110', { status: 'COMPLETED', doneDaysAgo: 8 }),
      ] }],
      records: [
        { content: 'Extraction of 26 done under LA. Healing advised.', daysAgo: 28 },
        { content: 'Denture impressions taken (upper).', daysAgo: 18 },
        { content: 'Complete upper denture delivered, fit checked.', daysAgo: 8 },
      ],
      payments: [
        { amount: 1500, method: 'CASH', daysAgo: 28, note: 'Extraction', recordIdx: 0 },
        { amount: 15000, method: 'NAGAD', daysAgo: 18, note: 'Denture — advance', recordIdx: 1 },
        { amount: 10000, method: 'CASH', daysAgo: 8, note: 'Denture — balance', recordIdx: 2 },
      ],
      appts: [{ start: at(day(-8), 12, 0), dur: 60, status: 'COMPLETED', reason: 'Denture delivery' }],
      notes: ['Denture fit checked, patient comfortable. Recall in 6 months.'],
    },
  );

  // 4) Ayesha Siddika — pregnant (alert), scaling done + filling planned
  await patient(
    { fullName: 'Ayesha Siddika', gender: 'FEMALE', dateOfBirth: new Date('1995-07-19'), phone: '01644444444', address: 'Banani, Dhaka', bloodGroup: 'AB+', occupation: 'Teacher', maritalStatus: 'MARRIED' },
    {
      medical: { isPregnant: true, conditions: '', notes: 'Second trimester — defer elective radiographs.' },
      teeth: [{ toothNumber: '37', surface: 'O', condition: 'CARIES', status: 'EXISTING' }],
      plans: [{ title: 'Cleaning & restoration', status: 'IN_PROGRESS', items: [
        item('D1110', { status: 'COMPLETED', doneDaysAgo: 3 }),
        item('D2391', { tooth: '37', status: 'PLANNED' }),
      ] }],
      records: [{ content: 'Full-mouth scaling & polishing done. Oral hygiene instructions given.', daysAgo: 3 }],
      payments: [{ amount: 1500, method: 'CASH', daysAgo: 3, note: 'Scaling & polishing', recordIdx: 0 }],
      appts: [
        { start: at(day(-3), 10, 30), dur: 60, status: 'COMPLETED', reason: 'Scaling' },
        { start: at(day(7), 11, 0), dur: 60, status: 'BOOKED', reason: 'Composite filling 37' },
      ],
      notes: ['Pregnant — avoided x-ray. Scaling done. Filling next visit.'],
    },
  );

  // 5) Tanvir Hasan — implant consult (proposed, unpaid), appointment TODAY
  await patient(
    { fullName: 'Tanvir Hasan', gender: 'MALE', dateOfBirth: new Date('1986-11-30'), phone: '01555555555', address: 'Gulshan, Dhaka', bloodGroup: 'O-', occupation: 'Engineer', maritalStatus: 'MARRIED', referralSource: 'Google' },
    {
      medical: { conditions: '', habits: '' },
      teeth: [{ toothNumber: '36', condition: 'MISSING', status: 'EXISTING', note: 'Lost 1 year ago' }],
      plans: [{ title: 'Single tooth implant — 36', status: 'PROPOSED', items: [
        item('D0210', { status: 'PLANNED' }),
        item('D6010', { tooth: '36', status: 'PLANNED', priority: 1 }),
      ] }],
      appts: [{ start: at(day(0), 15, 0), dur: 60, status: 'ARRIVED', reason: 'Implant consultation' }],
      notes: ['New patient. Discussed implant vs bridge. CBCT advised.'],
    },
  );

  // 6) Nusrat Jahan — ceramic crown, part-paid by card
  await patient(
    { fullName: 'Nusrat Jahan', gender: 'FEMALE', dateOfBirth: new Date('1992-03-08'), phone: '01366666666', address: 'Bashundhara, Dhaka', bloodGroup: 'B-', occupation: 'Doctor', maritalStatus: 'SINGLE' },
    {
      medical: { allergies: '', conditions: '' },
      teeth: [{ toothNumber: '24', condition: 'CROWN', status: 'PLANNED' }],
      plans: [{ title: 'Ceramic crown — upper left premolar', status: 'IN_PROGRESS', items: [
        item('D0120', { status: 'COMPLETED', doneDaysAgo: 10 }),
        item('D2740', { tooth: '24', status: 'PLANNED' }),
      ] }],
      records: [
        { content: 'Examination of 24; crown indicated. Shade selected.', daysAgo: 10 },
        { content: 'Tooth 24 prepared for ceramic crown, impression taken.', daysAgo: 4 },
      ],
      payments: [
        { amount: 500, method: 'CARD', daysAgo: 10, note: 'Examination', recordIdx: 0 },
        { amount: 4000, method: 'CARD', daysAgo: 4, note: 'Crown — advance', recordIdx: 1 },
      ],
      appts: [
        { start: at(day(-10), 14, 0), dur: 60, status: 'COMPLETED', reason: 'Examination' },
        { start: at(day(2), 13, 30), dur: 60, status: 'BOOKED', reason: 'Crown prep & impression' },
      ],
    },
  );

  // Extra appointments spread across the month covering every status, so the schedule
  // (and the upcoming calendar view) shows all states: completed/arrived, no-show/cancelled, upcoming.
  const pts = await prisma.patient.findMany({ select: { id: true } });
  const cal: { d: number; h: number; st: string; reason: string }[] = [
    { d: -12, h: 10, st: 'COMPLETED', reason: 'Scaling' },
    { d: -9, h: 11, st: 'NO_SHOW', reason: 'Filling' },
    { d: -7, h: 12, st: 'COMPLETED', reason: 'Review' },
    { d: -5, h: 15, st: 'CANCELLED', reason: 'Extraction' },
    { d: -3, h: 16, st: 'COMPLETED', reason: 'Crown prep' },
    { d: -1, h: 10, st: 'ARRIVED', reason: 'Checkup' },
    { d: 1, h: 11, st: 'BOOKED', reason: 'Follow-up' },
    { d: 3, h: 14, st: 'CONFIRMED', reason: 'RCT' },
    { d: 6, h: 16, st: 'BOOKED', reason: 'Cleaning' },
    { d: 10, h: 12, st: 'CONFIRMED', reason: 'Crown fitting' },
  ];
  for (let i = 0; i < cal.length && pts.length; i++) {
    const c = cal[i];
    const start = at(day(c.d), c.h);
    await prisma.appointment.create({
      data: {
        patientId: pts[i % pts.length].id, dentistId: dentist.id, chair: i % 2 ? 'Chair 2' : 'Chair 1',
        startTime: start, endTime: new Date(start.getTime() + 60 * 60000), status: c.st, reason: c.reason,
      },
    });
  }

  const [pc, ac, payc] = await Promise.all([prisma.patient.count(), prisma.appointment.count(), prisma.payment.count()]);
  console.log(`Demo seeded: ${pc} patients, ${ac} appointments, ${payc} payments, + treatments/charting/prescriptions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
