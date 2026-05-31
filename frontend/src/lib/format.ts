export function ageFromDob(dob?: string | null): string {
  if (!dob) return '—';
  const b = new Date(dob);
  if (isNaN(b.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return `${age} yr`;
}

export function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Splits a comma/semicolon list into trimmed non-empty parts (for allergies etc.).
export function splitList(s?: string | null): string[] {
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
