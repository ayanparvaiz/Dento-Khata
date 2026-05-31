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
