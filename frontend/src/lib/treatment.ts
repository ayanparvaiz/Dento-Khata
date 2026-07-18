import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export interface Procedure {
  id: string;
  code: string;
  name: string;
  category?: string;
  defaultFee: number;
}
export interface TreatmentItem {
  id: string;
  procedureId: string;
  procedure: Procedure;
  toothNumber?: string | null;
  priority: number;
  status: string;
  fee: number;
  completedAt?: string | null;
  billed?: boolean;
}
export interface TreatmentPlan {
  id: string;
  title?: string;
  status: string;
  createdAt: string;
  items: TreatmentItem[];
}
export interface ClinicalNote {
  id: string;
  content: string;
  createdAt: string;
}
export interface TreatmentRecord {
  id: string;
  content: string;
  amount: number; // charge the doctor set for this visit
  visitDate: string;
  planId?: string | null;
  plan?: { id: string; title?: string } | null;
}

export function useTreatmentRecords(patientId?: string) {
  return useQuery<TreatmentRecord[]>({
    queryKey: ['treatment-records', patientId],
    enabled: !!patientId,
    queryFn: async () => (await api.get(`/patients/${patientId}/treatment-records`)).data,
  });
}

export function useTreatmentRecordMutations(patientId: string) {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['treatment-records', patientId] });
  return {
    add: useMutation({
      mutationFn: async (body: { content: string; planId?: string; amount?: number; visitDate?: string }) =>
        (await api.post(`/patients/${patientId}/treatment-records`, body)).data,
      onSuccess: inval,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...body }: { id: string; content?: string; planId?: string; amount?: number; visitDate?: string }) =>
        (await api.patch(`/treatment-records/${id}`, body)).data,
      onSuccess: inval,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => (await api.delete(`/treatment-records/${id}`)).data,
      onSuccess: inval,
    }),
  };
}

export function useProcedures(search = '') {
  return useQuery<Procedure[]>({
    queryKey: ['procedures', search],
    queryFn: async () => (await api.get('/procedures', { params: { search } })).data,
  });
}

export function useTreatment(patientId?: string) {
  return useQuery<TreatmentPlan[]>({
    queryKey: ['treatment', patientId],
    enabled: !!patientId,
    queryFn: async () => (await api.get(`/patients/${patientId}/treatment`)).data,
  });
}

export function useTreatmentMutations(patientId: string) {
  const qc = useQueryClient();
  // Treatment changes affect the account total/balance + appointment due → refresh those too.
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['treatment', patientId] });
    qc.invalidateQueries({ queryKey: ['ledger', patientId] });
    qc.invalidateQueries({ queryKey: ['appointments'] });
    qc.invalidateQueries({ queryKey: ['appointments-range'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['outstanding'] });
  };
  return {
    createPlan: useMutation({
      mutationFn: async (title: string) => (await api.post(`/patients/${patientId}/treatment`, { title })).data,
      onSuccess: inval,
    }),
    deletePlan: useMutation({
      mutationFn: async (planId: string) => (await api.delete(`/treatment/${planId}`)).data,
      onSuccess: inval,
    }),
    addItem: useMutation({
      mutationFn: async ({ planId, ...body }: any) => (await api.post(`/treatment/${planId}/items`, body)).data,
      onSuccess: inval,
    }),
    updateItem: useMutation({
      mutationFn: async ({ itemId, ...body }: any) => (await api.patch(`/treatment/items/${itemId}`, body)).data,
      onSuccess: inval,
    }),
    deleteItem: useMutation({
      mutationFn: async (itemId: string) => (await api.delete(`/treatment/items/${itemId}`)).data,
      onSuccess: inval,
    }),
  };
}

export function useNotes(patientId?: string) {
  return useQuery<ClinicalNote[]>({
    queryKey: ['notes', patientId],
    enabled: !!patientId,
    queryFn: async () => (await api.get(`/patients/${patientId}/notes`)).data,
  });
}

export function useNotesMutations(patientId: string) {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['notes', patientId] });
  return {
    add: useMutation({
      mutationFn: async (content: string) => (await api.post(`/patients/${patientId}/notes`, { content })).data,
      onSuccess: inval,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => (await api.delete(`/notes/${id}`)).data,
      onSuccess: inval,
    }),
  };
}
