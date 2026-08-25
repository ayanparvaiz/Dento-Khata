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

// Windows won't let a hidden background process (our backend) pull a window in front of the
// app, so the browser opens *behind* it and the click looks like it did nothing. Say what
// happened. Plain DOM on purpose: this runs outside React, from a document-level listener.
function toast(message: string): void {
  const el = document.createElement('div');
  el.textContent = message;
  el.setAttribute('role', 'status');
  el.style.cssText =
    'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;' +
    'background:#0f766e;color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;' +
    'font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:90vw;text-align:center;' +
    'opacity:0;transition:opacity .2s';
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

export function openExternal(url: string): void {
  if (!isDesktopShell()) {
    window.open(url, '_blank', 'noreferrer');
    return;
  }
  // Fire-and-forget: the backend runs on this PC and opens the OS browser for us.
  api
    .post('/offline/open-external', { url })
    .then(() => toast('লিংকটি আপনার ব্রাউজারে খোলা হয়েছে — টাস্কবারে দেখুন।'))
    .catch(() => {
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
