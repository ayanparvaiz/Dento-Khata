import { api } from './api';

const esc = (s = '') => s.replace(/\n/g, '<br/>');
export const themeOf = (s: any) => s?.themeColor || '#0f766e';
const assetOrigin = () => (api.defaults.baseURL || '').replace(/\/api$/, '') || window.location.origin;

// Shared header/footer template (Settings) used by BOTH prescription and invoice prints.
export function letterheadHead(s: any): string {
  const c = themeOf(s);
  const title = s?.headerTitle || s?.name || 'Dental Clinic';
  const logo = s?.logoPath ? `<img class="lh-logo" src="${assetOrigin()}${s.logoPath}" />` : '';
  return `<div class="lh-hd" style="border-color:${c}">
    <div class="lh-main">
      <div class="lh-title" style="color:${c}">${title}</div>
      ${s?.headerSubtitle ? `<div class="lh-sub">${s.headerSubtitle}</div>` : ''}
      ${s?.headerExtra ? `<div class="lh-extra">${s.headerExtra}</div>` : ''}
    </div>
    ${logo}
  </div>`;
}

export function letterheadFoot(s: any): string {
  const l = s?.footerLeft || '';
  const r = s?.footerRight || '';
  if (!l && !r) return '';
  return `<div class="lh-ft" style="border-color:${themeOf(s)}"><div class="lh-fl">${esc(l)}</div><div class="lh-fr">${esc(r)}</div></div>`;
}

// CSS — footer is pinned to the BOTTOM of the printed page.
export const LETTERHEAD_CSS = `
.lh-hd{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:2px solid #0f766e;padding-bottom:8px;margin-bottom:6px}
.lh-main{text-align:left} .lh-logo{flex:none;max-height:60px;max-width:110px;object-fit:contain}
.lh-title{font-size:22px;font-weight:800;line-height:1.1}
.lh-sub{font-size:13px;color:#334155} .lh-extra{font-size:12px;color:#64748b}
.lh-ft{position:fixed;left:14mm;right:14mm;bottom:8mm;display:flex;justify-content:space-between;gap:16px;border-top:2px solid #0f766e;padding-top:8px;font-size:12px;color:#334155;background:#fff}
.lh-fr{text-align:right}
`;
