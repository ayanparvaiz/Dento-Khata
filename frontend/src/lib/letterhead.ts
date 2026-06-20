import { api } from './api';

// Same backend origin that serves /uploads (works in dev :3000 and prod same-origin).
const assetOrigin = () => (api.defaults.baseURL || '').replace(/\/api$/, '') || window.location.origin;
const esc = (s = '') => s.replace(/\n/g, '<br/>');

// Shared header/footer template (Settings) used by BOTH prescription and invoice prints.
export function letterheadHead(s: any): string {
  const logo = s?.logoPath ? `<img class="lh-logo" src="${assetOrigin()}${s.logoPath}" />` : '';
  const title = s?.headerTitle || s?.name || 'Dental Clinic';
  return `<div class="lh-hd">
    ${logo}
    <div class="lh-txt">
      <div class="lh-title">${title}</div>
      ${s?.headerSubtitle ? `<div class="lh-sub">${s.headerSubtitle}</div>` : ''}
      ${s?.headerExtra ? `<div class="lh-extra">${s.headerExtra}</div>` : ''}
    </div>
  </div>`;
}

export function letterheadFoot(s: any): string {
  const l = s?.footerLeft || '';
  const r = s?.footerRight || '';
  if (!l && !r) return '';
  return `<div class="lh-ft"><div class="lh-fl">${esc(l)}</div><div class="lh-fr">${esc(r)}</div></div>`;
}

export const LETTERHEAD_CSS = `
.lh-hd{position:relative;text-align:center;border-bottom:2px solid #0f766e;padding-bottom:8px;margin-bottom:6px;min-height:48px}
.lh-logo{position:absolute;right:0;top:0;max-height:64px;max-width:120px;object-fit:contain}
.lh-title{font-size:22px;font-weight:800;color:#0f766e;line-height:1.1}
.lh-sub{font-size:13px;color:#334155} .lh-extra{font-size:12px;color:#64748b}
.lh-ft{display:flex;justify-content:space-between;gap:16px;border-top:2px solid #0f766e;margin-top:20px;padding-top:8px;font-size:12px;color:#334155}
.lh-fr{text-align:right}
`;
