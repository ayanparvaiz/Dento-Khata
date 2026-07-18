// Dento Khata brand mark — the same tooth as the favicon (public/icon.svg).
// Uses currentColor so it inherits the surrounding text colour (e.g. white on a teal tile).
export function ToothIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 192 192" className={className} fill="currentColor" aria-hidden="true">
      <path d="M96 42 C74 42 58 42 52 63 C48 79 52 96 58 118 C62 134 66 150 74 150 C82 150 82 132 88 122 C91 117 101 117 104 122 C110 132 110 150 118 150 C126 150 130 134 134 118 C140 96 144 79 140 63 C134 42 118 42 96 42 Z" />
    </svg>
  );
}
