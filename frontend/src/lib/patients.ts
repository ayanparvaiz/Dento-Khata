import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface MedicalHistory {
  allergies?: string;
  medications?: string;
  conditions?: string;
  habits?: string;
  pastDentalHistory?: string;
  isPregnant?: boolean;
  premedRequired?: boolean;
  notes?: string;
}

export interface Patient {
  id: string;
  code: string;
  fullName: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  occupation?: string;
  maritalStatus?: string;
  referralSource?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  guardianName?: string;
  behaviourGrade?: string; // A+ | A | A- | F
  createdAt: string;
  medicalHistory?: MedicalHistory | null;
  _count?: Record<string, number>;
}

export interface PatientList {
  items: Patient[];
  total: number;
  page: number;
  pageSize: number;
}

export function usePatients(search: string) {
  return useQuery<PatientList>({
    queryKey: ['patients', search],
    queryFn: async () => (await api.get('/patients', { params: { search } })).data,
  });
}

export function usePatient(id?: string) {
  return useQuery<Patient>({
    queryKey: ['patient', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/patients/${id}`)).data,
  });
}
