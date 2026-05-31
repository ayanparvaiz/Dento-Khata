import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export interface ToothRecord {
  id: string;
  toothNumber: string;
  surface?: string | null;
  condition: string;
  status: string;
  note?: string | null;
  recordedAt: string;
}
export interface PerioRecord {
  id: string;
  toothNumber: string;
  pocketDepth?: string | null;
  mobility?: number | null;
}
export interface Chart {
  teeth: ToothRecord[];
  perio: PerioRecord[];
}

export const CONDITIONS = [
  'CARIES', 'FILLED', 'CROWN', 'BRIDGE', 'RCT', 'IMPLANT',
  'MISSING', 'EXTRACTED', 'FRACTURED', 'SEALANT', 'VENEER', 'IMPACTED', 'HEALTHY',
];
export const SURFACES = ['M', 'D', 'O', 'I', 'B', 'L'];
export const STATUSES = ['EXISTING', 'PLANNED', 'COMPLETED'];

// Conditions that apply to the WHOLE tooth (not a single surface).
export const WHOLE_CONDITIONS = new Set([
  'CROWN', 'BRIDGE', 'RCT', 'IMPLANT', 'MISSING', 'EXTRACTED', 'IMPACTED', 'HEALTHY',
]);
// Single-letter markers drawn on the tooth for whole-tooth conditions.
export const WHOLE_MARK: Record<string, string> = {
  CROWN: 'C', BRIDGE: 'Br', RCT: 'R', IMPLANT: 'Im', IMPACTED: 'Ip',
};
export const HOLLOW_CONDITIONS = new Set(['MISSING', 'EXTRACTED']);

export type Zone = 'center' | 'top' | 'bottom' | 'left' | 'right';

// Map a clicked visual zone to a dental surface, accounting for quadrant (mesial = toward midline).
export function surfaceForZone(fdi: string, zone: Zone): string {
  const q = fdi[0];
  const toothDigit = fdi[1];
  const isAnterior = ['1', '2', '3'].includes(toothDigit);
  if (zone === 'center') return isAnterior ? 'I' : 'O';
  if (zone === 'top') return 'B';
  if (zone === 'bottom') return 'L';
  // On screen we draw 18→11 then 21→28, so for quadrants 1,4 (and primary 5,8) mesial is on the RIGHT.
  const mesialRight = ['1', '4', '5', '8'].includes(q);
  if (zone === 'left') return mesialRight ? 'D' : 'M';
  return mesialRight ? 'M' : 'D'; // right
}

// Parse a JSON-ish array stored in PerioRecord fields; returns length-6 array.
export function parse6(s?: string | null, fill: number | boolean = 0): (number | boolean)[] {
  try {
    const a = JSON.parse(s || '');
    if (Array.isArray(a)) return Array.from({ length: 6 }, (_, i) => a[i] ?? fill);
  } catch {
    /* ignore */
  }
  return Array.from({ length: 6 }, () => fill);
}

// Condition -> color (used to paint teeth, exactly like clinical charting software).
export const CONDITION_COLOR: Record<string, string> = {
  CARIES: '#dc2626',
  FILLED: '#2563eb',
  CROWN: '#d97706',
  BRIDGE: '#7c3aed',
  RCT: '#9333ea',
  IMPLANT: '#0d9488',
  MISSING: '#94a3b8',
  EXTRACTED: '#64748b',
  FRACTURED: '#ea580c',
  SEALANT: '#16a34a',
  VENEER: '#db2777',
  IMPACTED: '#92400e',
  HEALTHY: '#ffffff',
};

// --- Tooth layouts (FDI numbering is the stored canonical form) ---
export const ADULT_UPPER = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
export const ADULT_LOWER = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];
export const CHILD_UPPER = ['55','54','53','52','51','61','62','63','64','65'];
export const CHILD_LOWER = ['85','84','83','82','81','71','72','73','74','75'];

// FDI -> Universal (permanent 1-32)
const UNIVERSAL: Record<string, string> = {};
['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28']
  .forEach((f, i) => (UNIVERSAL[f] = String(i + 1)));
['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38']
  .forEach((f, i) => (UNIVERSAL[f] = String(i + 17)));
// primary A-T
const PRIMARY_UNI: Record<string, string> = {};
['55','54','53','52','51','61','62','63','64','65']
  .forEach((f, i) => (PRIMARY_UNI[f] = 'ABCDEFGHIJ'[i]));
['85','84','83','82','81','71','72','73','74','75']
  .forEach((f, i) => (PRIMARY_UNI[f] = 'TSRQPONMLK'[i]));

export type Notation = 'FDI' | 'UNIVERSAL' | 'PALMER';

export function displayTooth(fdi: string, notation: Notation): string {
  if (notation === 'FDI') return fdi;
  if (notation === 'UNIVERSAL') return UNIVERSAL[fdi] ?? PRIMARY_UNI[fdi] ?? fdi;
  // PALMER: per-quadrant 1-8 (or A-E primary) with a quadrant marker
  const q = fdi[0];
  const n = fdi[1];
  const mark: Record<string, string> = { '1': '┘', '2': '└', '3': '┐', '4': '┌', '5': '┘', '6': '└', '7': '┐', '8': '┌' };
  return `${n}${mark[q] ?? ''}`;
}

export function useChart(patientId?: string) {
  return useQuery<Chart>({
    queryKey: ['chart', patientId],
    enabled: !!patientId,
    queryFn: async () => (await api.get(`/patients/${patientId}/chart`)).data,
  });
}

export function useChartMutations(patientId: string) {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['chart', patientId] });
  return {
    add: useMutation({
      mutationFn: async (body: Partial<ToothRecord>) =>
        (await api.post(`/patients/${patientId}/chart`, body)).data,
      onSuccess: inval,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...body }: { id: string } & Partial<ToothRecord>) =>
        (await api.patch(`/chart/${id}`, body)).data,
      onSuccess: inval,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => (await api.delete(`/chart/${id}`)).data,
      onSuccess: inval,
    }),
    perio: useMutation({
      mutationFn: async (body: Partial<PerioRecord>) =>
        (await api.put(`/patients/${patientId}/perio`, body)).data,
      onSuccess: inval,
    }),
  };
}
