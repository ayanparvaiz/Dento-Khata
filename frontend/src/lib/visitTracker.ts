// Landing-page engagement tracker: measures how long a visitor stays and how far
// they scroll (i.e. how much of the page they actually read), and reports it to the
// backend so the super-admin can see marketing engagement.
//
// Design:
//  - one visit id (sessionStorage) so repeat reports upsert the same row
//  - counts only ACTIVE time (pauses while the tab is hidden)
//  - tracks the furthest scroll depth reached (0–100%)
//  - flushes periodically + once more on page-hide via sendBeacon (survives unload)
import { api } from './api';

const SID_KEY = 'dk_visit_sid';
const ENDPOINT = '/analytics/visit';

function makeSid() {
  return 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function getSid(): string {
  try {
    let s = sessionStorage.getItem(SID_KEY);
    if (!s) { s = makeSid(); sessionStorage.setItem(SID_KEY, s); }
    return s;
  } catch {
    return makeSid();
  }
}

interface TrackerState {
  sid: string;
  activeMs: number;      // accumulated active time
  lastTick: number;      // last time we added to activeMs (while visible)
  maxScroll: number;     // 0–100
  signedUp: boolean;
  visible: boolean;
}

let state: TrackerState | null = null;
let flushTimer: number | null = null;

function scrollDepthPct(): number {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || 0;
  const viewport = window.innerHeight || doc.clientHeight || 0;
  const full = Math.max(doc.scrollHeight, document.body.scrollHeight || 0);
  if (full <= viewport) return 100; // whole page fits — fully "read"
  const pct = Math.round(((scrollTop + viewport) / full) * 100);
  return Math.max(0, Math.min(100, pct));
}

function accumulate() {
  if (!state) return;
  const now = Date.now();
  if (state.visible) state.activeMs += now - state.lastTick;
  state.lastTick = now;
}

function payload() {
  if (!state) return null;
  accumulate();
  const p = new URLSearchParams(window.location.search);
  return {
    sid: state.sid,
    path: window.location.pathname,
    referrer: document.referrer || undefined,
    utmSource: p.get('utm_source') || undefined,
    utmCampaign: p.get('utm_campaign') || undefined,
    device: /(Mobi|Android|iPhone|iPad)/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    durationMs: state.activeMs,
    maxScroll: state.maxScroll,
    signedUp: state.signedUp || undefined,
  };
}

// Beacon-friendly flush: survives page unload where axios/fetch would be cancelled.
function flush(useBeacon = false) {
  const body = payload();
  if (!body) return;
  try {
    if (useBeacon && navigator.sendBeacon) {
      const url = (api.defaults.baseURL || '') + ENDPOINT;
      navigator.sendBeacon(url, new Blob([JSON.stringify(body)], { type: 'application/json' }));
    } else {
      void api.post(ENDPOINT, body).catch(() => {});
    }
  } catch {
    /* tracking must never break the page */
  }
}

// Call once when the landing page mounts. Returns a cleanup fn.
export function startVisitTracking(): () => void {
  if (state) return () => {}; // already running (StrictMode double-mount guard)
  state = {
    sid: getSid(),
    activeMs: 0,
    lastTick: Date.now(),
    maxScroll: scrollDepthPct(),
    signedUp: false,
    visible: document.visibilityState === 'visible',
  };

  const onScroll = () => { if (state) state.maxScroll = Math.max(state.maxScroll, scrollDepthPct()); };
  const onVisibility = () => {
    if (!state) return;
    accumulate();
    state.visible = document.visibilityState === 'visible';
    if (!state.visible) flush(true); // tab hidden — persist now
  };
  const onHide = () => flush(true);

  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onHide);
  // First write soon (so even a quick bounce is recorded), then every 15s.
  const first = window.setTimeout(() => flush(false), 4000);
  flushTimer = window.setInterval(() => flush(false), 15000);

  return () => {
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onHide);
    window.clearTimeout(first);
    if (flushTimer) window.clearInterval(flushTimer);
    flush(true);
    state = null;
    flushTimer = null;
  };
}

// Mark this visit as converted (called right after a successful signup).
export function markVisitSignup() {
  if (state) { state.signedUp = true; flush(false); }
}
