// Meta Pixel helpers. The browser pixel is initialised in index.html.
// Every conversion is ALSO sent server-side (Conversions API) with the same eventId,
// so Meta deduplicates and we still get the event when the browser is blocked.

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
