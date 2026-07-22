// Meta Pixel helpers. The browser pixel is initialised in index.html.
// Every conversion is ALSO sent server-side (Conversions API) with the same eventId,
// so Meta deduplicates and we still get the event when the browser is blocked.
import { api } from './api';

declare global {
  interface Window { fbq?: (...args: any[]) => void }
}

const cookie = (name: string): string | undefined => {
  const m = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[2]) : undefined;
};

/** _fbp (browser id) and _fbc (ad click id) — the keys Meta uses to attribute a
 *  later, offline purchase back to the ad click. Captured at signup, stored on the tenant. */
export function fbCookies() {
  return { fbp: cookie('_fbp'), fbc: cookie('_fbc') };
}

export function newEventId(prefix = 'e') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Standard event (PageView, ViewContent, CompleteRegistration, Purchase…) */
export function fbTrack(event: string, data?: Record<string, unknown>, eventId?: string) {
  try {
    window.fbq?.('track', event, data || {}, eventId ? { eventID: eventId } : undefined);
  } catch { /* never break the app for tracking */ }
}

/** Custom event (e.g. Login) */
export function fbTrackCustom(event: string, data?: Record<string, unknown>, eventId?: string) {
  try {
    window.fbq?.('trackCustom', event, data || {}, eventId ? { eventID: eventId } : undefined);
  } catch { /* ignore */ }
}

/** Fire a standard event to BOTH the browser pixel and the server (Conversions API) with
 *  the same eventId, so it still reaches Meta if the browser pixel is blocked. Use for
 *  high-value events like WhatsApp Contact. Fire-and-forget; never blocks navigation. */
export function fbTrackReliable(event: string, data?: Record<string, unknown>) {
  const eventId = newEventId(event.toLowerCase());
  const { fbp, fbc } = fbCookies();
  fbTrack(event, data, eventId); // browser pixel
  try {
    const body = JSON.stringify({ event, eventId, fbp, fbc, sourceUrl: window.location.href });
    // sendBeacon survives the click that opens WhatsApp in a new tab.
    const url = (api.defaults.baseURL || '') + '/analytics/event';
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    else void api.post('/analytics/event', { event, eventId, fbp, fbc, sourceUrl: window.location.href }).catch(() => {});
  } catch { /* ignore */ }
}
