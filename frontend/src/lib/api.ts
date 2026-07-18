import axios from 'axios';

// The backend runs on the server PC at port 3000. Clients (this PC, 2nd PC, phone)
// load the web app from that same server, so we derive the API base from the current
// host. In Vite dev (port 5173) this resolves to the dev machine's backend on 3000.
function resolveBaseURL(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) return envUrl;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3000/api`;
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
