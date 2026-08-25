import { api } from './api';

// In the desktop app the whole UI lives in ONE webview window — there are no tabs, no
// address bar and no back button. A plain target="_blank" link therefore replaces the app
// itself with (say) WhatsApp and the doctor has no way back except killing the app.
//
// The desktop shell always points its window at the loopback address, while phones and the
// second PC reach the same server over the LAN. So loopback = "running on the server PC",
// which is exactly where handing the link to the machine's default browser is the right move.
// Everywhere else the normal new-tab behaviour is already correct and is left alone.
const LOOPBACK = ['127.0.0.1', 'localhost', '::1', '[::1]'];

export function isDesktopShell(): boolean {
  return LOOPBACK.includes(window.location.hostname);
}

export function openExternal(url: string): void {
  if (!isDesktopShell()) {
    window.open(url, '_blank', 'noreferrer');
    return;
  }
  // Fire-and-forget: the backend runs on this PC and opens the OS browser for us.
  api.post('/offline/open-external', { url }).catch(() => {
    window.open(url, '_blank', 'noreferrer'); // last resort — better than doing nothing
  });
}

// One document-level listener instead of touching every link in the app. Only intercepts
// what would actually strand the user: a new-tab link to another origin.
export function installExternalLinkHandler(): void {
  if (!isDesktopShell()) return;

  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;
      if (anchor.target !== '_blank') return; // in-app navigation stays untouched

      const href = anchor.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) return; // relative links, mailto:, tel: — not ours
      if (new URL(href, window.location.href).origin === window.location.origin) return; // our own files

      e.preventDefault();
      openExternal(href);
    },
    true, // capture, so React's own handlers still run first on the element
  );
}
