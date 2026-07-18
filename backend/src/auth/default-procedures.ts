// Starter procedure list every new clinic gets (they edit codes/fees to taste).
// Drug catalog is global/shared, so nothing to clone there.
export const DEFAULT_PROCEDURES: { code: string; name: string; category: string; defaultFee: number }[] = [
  { code: 'CONS', name: 'Consultation', category: 'Diagnostic', defaultFee: 500 },
  { code: 'SCALE', name: 'Scaling & Polishing', category: 'Preventive', defaultFee: 1500 },
  { code: 'FILL-GIC', name: 'Filling (GIC)', category: 'Restorative', defaultFee: 1200 },
  { code: 'FILL-COMP', name: 'Filling (Composite)', category: 'Restorative', defaultFee: 2000 },
  { code: 'RCT-ANT', name: 'Root Canal (Anterior)', category: 'Endodontic', defaultFee: 5000 },
  { code: 'RCT-POST', name: 'Root Canal (Posterior)', category: 'Endodontic', defaultFee: 7000 },
  { code: 'EXT-SIMPLE', name: 'Extraction (Simple)', category: 'Surgical', defaultFee: 1500 },
  { code: 'EXT-SURG', name: 'Extraction (Surgical)', category: 'Surgical', defaultFee: 4000 },
  { code: 'CROWN-PFM', name: 'Crown (PFM)', category: 'Prosthetic', defaultFee: 8000 },
  { code: 'CROWN-ZIR', name: 'Crown (Zirconia)', category: 'Prosthetic', defaultFee: 12000 },
  { code: 'DENT-PART', name: 'Partial Denture', category: 'Prosthetic', defaultFee: 10000 },
  { code: 'DENT-FULL', name: 'Complete Denture', category: 'Prosthetic', defaultFee: 20000 },
  { code: 'XRAY-IOPA', name: 'X-Ray (IOPA)', category: 'Diagnostic', defaultFee: 300 },
  { code: 'BLEACH', name: 'Teeth Whitening', category: 'Cosmetic', defaultFee: 8000 },
];
