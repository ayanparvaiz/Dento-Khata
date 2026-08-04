import axios from 'axios';
import { IS_OFFLINE } from './mode';

// API base URL. In the unified builds the backend serves the web app AND the API on the
// SAME origin/port, so a relative "/api" is correct (works for the host PC and, offline,
// for phones/tablets on the LAN too — they load from server:PORT and "/api" resolves there).
// Only Vite dev (port 5173) needs to reach a separate backend on :3000.
function resolveBaseURL(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) return envUrl;
  if (IS_OFFLINE) return '/api';
  const { protocol, hostname, port } = window.location;
  if (port === '5173') return `${protocol}//${hostname}:3000/api`; // vite dev → separate backend
  return '/api'; // served by the backend on the same origin
}

export const api = axios.create({
  baseURL: resolveBaseURL(),
});

// Attach JWT (set after login in a later phase).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Subscription paywall: the backend returns 402 when the clinic's subscription is inactive.
// Broadcast it so the app can swap to the renew screen without every caller handling it.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const data = err.response?.data;
    if (err.response?.status === 402 && data?.code === 'SUBSCRIPTION_INACTIVE') {
      window.dispatchEvent(new CustomEvent('subscription-blocked', { detail: data }));
    }
    // Clinic disabled by super-admin → drop the session and show a support popup.
    if (err.response?.status === 403 && data?.code === 'CLINIC_SUSPENDED') {
      localStorage.removeItem('token');
      sessionStorage.setItem('suspended', JSON.stringify(data));
      window.dispatchEvent(new CustomEvent('clinic-suspended', { detail: data }));
    }
    return Promise.reject(err);
  },
);

// Separate axios instance for the platform super-admin console (its own token).
export const superApi = axios.create({ baseURL: resolveBaseURL() });
superApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('superToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
