import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/* ---------------- Drugs & Prescriptions ---------------- */
export interface Drug {
  id: string; name: string; generic?: string; category?: string; form?: string; strength?: string;
}
export interface RxItem {
  id?: string; drugId?: string; drugName: string; generic?: string; dosage: string;
  frequency?: string; duration?: string; route?: string; timing?: string; instruction?: string;
}
export interface Prescription {
  id: string; diagnosis?: string; advice?: string; createdAt: string; items: RxItem[];
  chiefComplaint?: string; onExam?: string; examGrid?: string; investigation?: string;
  notes?: string; followUp?: string; planId?: string;
  totalBill?: number; discount?: number; paidToday?: number; visitsNeeded?: number;
}

export function useDrugs(search = '') {
  return useQuery<Drug[]>({
    queryKey: ['drugs', search],
    queryFn: async () => (await api.get('/drugs', { params: { search } })).data,
  });
}
export function usePrescriptions(patientId?: string) {
  return useQuery<Prescription[]>({
    queryKey: ['prescriptions', patientId],
    enabled: !!patientId,
    queryFn: async () => (await api.get(`/patients/${patientId}/prescriptions`)).data,
  });
}
export function useRxMutations(patientId: string) {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['prescriptions', patientId] });
  return {
    create: useMutation({
      mutationFn: async (body: any) => (await api.post(`/patients/${patientId}/prescriptions`, body)).data,
      onSuccess: inval,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => (await api.delete(`/prescriptions/${id}`)).data,
      onSuccess: inval,
    }),
  };
}

/* ---------------- Imaging ---------------- */
export interface PatientFile {
  id: string; filePath: string; fileName: string; mimeType: string;
  fileType: string; category?: string; caption?: string; toothNumber?: string; uploadedAt: string;
}
export function useFiles(patientId?: string) {
  return useQuery<PatientFile[]>({
    queryKey: ['files', patientId],
    enabled: !!patientId,
    queryFn: async () => (await api.get(`/patients/${patientId}/files`)).data,
  });
}
export function useFileMutations(patientId: string) {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['files', patientId] });
  return {
    upload: useMutation({
      mutationFn: async (form: FormData) =>
        (await api.post(`/patients/${patientId}/files`, form)).data,
      onSuccess: inval,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => (await api.delete(`/files/${id}`)).data,
      onSuccess: inval,
    }),
  };
}

/* ---------------- Billing (patient account + installments) ---------------- */
export interface Payment { id: string; amount: number; method: string; paidAt: string; note?: string; appointmentId?: string; treatmentRecordId?: string | null; }
// total = treatment plan total (the charge/due); paid = installments; balance = total − paid.
export interface Ledger { total: number; completed: number; paid: number; balance: number; }

export function useLedger(patientId?: string) {
  return useQuery<Ledger>({
    queryKey: ['ledger', patientId],
    enabled: !!patientId,
    queryFn: async () => (await api.get(`/patients/${patientId}/ledger`)).data,
  });
}
export function usePayments(patientId?: string) {
  return useQuery<Payment[]>({
    queryKey: ['payments', patientId],
    enabled: !!patientId,
    queryFn: async () => (await api.get(`/patients/${patientId}/payments`)).data,
  });
}
export function useBillingMutations(patientId: string) {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['ledger', patientId] });
    qc.invalidateQueries({ queryKey: ['payments', patientId] });
    qc.invalidateQueries({ queryKey: ['appointments'] });
    qc.invalidateQueries({ queryKey: ['appointments-range'] });
    // income/analytics depend on payments → keep dashboard chart + reports accurate
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['revenue'] });
    qc.invalidateQueries({ queryKey: ['daily'] });
    qc.invalidateQueries({ queryKey: ['outstanding'] });
  };
  return {
    // Collect one installment toward the patient's balance.
    pay: useMutation({
      mutationFn: async (body: { amount: number; method: string; appointmentId?: string; treatmentRecordId?: string; note?: string }) =>
        (await api.post(`/patients/${patientId}/payments`, body)).data,
      onSuccess: inval,
    }),
  };
}

/* ---------------- Appointments ---------------- */
export interface Appointment {
  id: string; patientId: string; chair?: string; startTime: string; endTime: string;
  status: string; reason?: string; due?: number;
  patient?: { fullName: string; code: string; phone?: string };
  dentist?: { fullName: string };
}
export function useAppointments(date: string) {
  return useQuery<Appointment[]>({
    queryKey: ['appointments', date],
    queryFn: async () => (await api.get('/appointments', { params: { date } })).data,
  });
}
export function useAppointmentsRange(from: string, to: string, enabled = true) {
  return useQuery<Appointment[]>({
    queryKey: ['appointments-range', from, to],
    enabled,
    queryFn: async () => (await api.get('/appointments', { params: { from, to } })).data,
  });
}
export interface Slot { start: string; end: string; available: boolean; by?: string; reason?: string }
export function useAvailability(date: string, chair?: string, dentistId?: string, dur = 30, enabled = true) {
  return useQuery<{ slots: Slot[] }>({
    queryKey: ['availability', date, chair, dentistId, dur],
    enabled,
    queryFn: async () => (await api.get('/appointments/availability', { params: { date, chair, dentistId, dur } })).data,
  });
}
export interface DayAvail { date: string; free: number; total: number }
export function useAvailabilityRange(from: string, days: number, chair?: string, dentistId?: string, dur = 30, enabled = true) {
  return useQuery<DayAvail[]>({
    queryKey: ['availability-range', from, days, chair, dentistId, dur],
    enabled,
    queryFn: async () => (await api.get('/appointments/availability-range', { params: { from, days, chair, dentistId, dur } })).data,
  });
}
export function usePatientAppointments(patientId?: string) {
  return useQuery<Appointment[]>({
    queryKey: ['patient-appointments', patientId],
    enabled: !!patientId,
    queryFn: async () => (await api.get(`/appointments/patient/${patientId}`)).data,
  });
}
export function useApptMutations(_key?: string) {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['appointments'] });
    qc.invalidateQueries({ queryKey: ['appointments-range'] });
    qc.invalidateQueries({ queryKey: ['patient-appointments'] });
    qc.invalidateQueries({ queryKey: ['availability'] });
    qc.invalidateQueries({ queryKey: ['availability-range'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] }); // today's schedule + counts
  };
  return {
    create: useMutation({ mutationFn: async (b: any) => (await api.post('/appointments', b)).data, onSuccess: inval }),
    update: useMutation({ mutationFn: async ({ id, ...b }: any) => (await api.patch(`/appointments/${id}`, b)).data, onSuccess: inval }),
    remove: useMutation({ mutationFn: async (id: string) => (await api.delete(`/appointments/${id}`)).data, onSuccess: inval }),
  };
}

/* ---------------- Reports & dashboard ---------------- */
export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api.get('/stats/dashboard')).data });
}
export function useDailyCollection(date: string) {
  return useQuery({ queryKey: ['daily', date], queryFn: async () => (await api.get('/reports/daily-collection', { params: { date } })).data });
}
export function useOutstanding(enabled = true) {
  return useQuery({ enabled, queryKey: ['outstanding'], queryFn: async () => (await api.get('/reports/outstanding')).data });
}
export interface Revenue {
  days: number; from: string; total: number; count: number;
  byMethod: Record<string, number>; series: { date: string; amount: number }[];
}
export function useRevenue(days: number, enabled = true) {
  return useQuery<Revenue>({ enabled, queryKey: ['revenue', days], queryFn: async () => (await api.get('/reports/revenue', { params: { days } })).data });
}

export const taka = (n: number) => `৳${(n || 0).toLocaleString('en-IN')}`;
