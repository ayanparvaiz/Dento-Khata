import {
  CONDITION_COLOR, HOLLOW_CONDITIONS, WHOLE_CONDITIONS, WHOLE_MARK,
  displayTooth, surfaceForZone, type Notation, type Zone, type ToothRecord,
} from '@/lib/charting';

// Clickable crown surfaces: 4 trapezoids around a center square (occlusal view), in a 40x40 crown box.
const ZONES: { zone: Zone; points: string }[] = [
  { zone: 'top', points: '0,0 40,0 28,12 12,12' },
  { zone: 'bottom', points: '0,40 40,40 28,28 12,28' },
  { zone: 'left', points: '0,0 12,12 12,28 0,40' },
  { zone: 'right', points: '40,0 28,12 28,28 40,40' },
  { zone: 'center', points: '12,12 28,12 28,28 12,28' },
];

// Tooth morphology from the FDI number → root count + crown width, so incisors look
// slim & molars wide with multiple roots, like a paper odontogram.
function morphology(fdi: string) {
  const q = Number(fdi[0]);
  const n = Number(fdi[1]);
  const upper = q === 1 || q === 2 || q === 5 || q === 6;
  const childMolar = q >= 5 && n >= 4; // primary molars 54,55,64,65,74,75,84,85
  const molar = (q <= 4 && n >= 6) || childMolar;
  const premolar = q <= 4 && (n === 4 || n === 5);
  const canine = n === 3;
  const roots = molar ? (upper ? 3 : 2) : 1;
  const widthFactor = molar ? 1 : premolar ? 0.82 : canine ? 0.72 : 0.62; // incisor slimmest
  return { upper, roots, widthFactor };
}

// Tapered root "leaves" between the crown edge and the apex.
function rootPaths(count: number, edgeY: number, apexY: number): string[] {
  const midY = edgeY + (apexY - edgeY) * 0.55;
  const leaf = (xl: number, xr: number) => {
    const xm = (xl + xr) / 2;
    return `M ${xl} ${edgeY} Q ${xl} ${midY} ${xm} ${apexY} Q ${xr} ${midY} ${xr} ${edgeY} Z`;
  };
  if (count === 1) return [leaf(13, 27)];
  if (count === 2) return [leaf(7, 19), leaf(21, 33)];
  return [leaf(5, 15), leaf(16, 24), leaf(25, 35)];
}

export function AnatomicalTooth({
  fdi, notation, records, selected, onZone,
}: {
  fdi: string;
  notation: Notation;
  records: ToothRecord[];
  selected: boolean;
  onZone: (zone: Zone) => void;
}) {
  // surface -> latest condition color
  const surfaceColor: Record<string, string> = {};
  let whole: ToothRecord | undefined;
  for (const r of records) {
    if (!r.surface || WHOLE_CONDITIONS.has(r.condition)) {
      whole = whole ?? r;
    } else if (!surfaceColor[r.surface]) {
      surfaceColor[r.surface] = CONDITION_COLOR[r.condition];
    }
  }
  const hollow = whole && HOLLOW_CONDITIONS.has(whole.condition);
  const wholeTint = whole && !hollow ? CONDITION_COLOR[whole.condition] : null;

  const { upper, roots, widthFactor } = morphology(fdi);
  // Layout in a 40x80 box. Upper: roots on top, crown at bottom. Lower: crown on top, roots below.
  const crownY = upper ? 38 : 2;            // crown box origin (40 tall)
  const rootEdgeY = upper ? 38 : 42;        // where roots meet the crown
  const rootApexY = upper ? 3 : 77;         // root tip
  const rootFill = wholeTint ? wholeTint + '22' : '#fff7f0';

  return (
    <div className="flex flex-col items-center gap-0.5" data-tooth={fdi}>
      <svg
        viewBox="0 0 40 80"
        className={selected ? 'rounded ring-2 ring-primary' : ''}
        style={{ width: 30, height: 60, opacity: hollow ? 0.5 : 1 }}
      >
        {/* slim anteriors / wide molars: scale horizontally about the centre */}
        <g transform={`translate(20,0) scale(${widthFactor},1) translate(-20,0)`}>
          {/* roots (decorative, not clickable) */}
          {rootPaths(roots, rootEdgeY, rootApexY).map((d, i) => (
            <path key={i} d={d} fill={rootFill} stroke="#cbd5e1" strokeWidth="1" />
          ))}

          {/* crown with clickable surfaces */}
          <g transform={`translate(0,${crownY})`}>
            {ZONES.map(({ zone, points }) => {
              const surf = surfaceForZone(fdi, zone);
              const fill = surfaceColor[surf]
                ? surfaceColor[surf] + '88'
                : wholeTint ? wholeTint + '33' : '#ffffff';
              return (
                <polygon
                  key={zone}
                  points={points}
                  fill={fill}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); onZone(zone); }}
                />
              );
            })}
            {hollow && (
              <g stroke="#64748b" strokeWidth="2.5">
                <line x1="6" y1="6" x2="34" y2="34" />
                <line x1="34" y1="6" x2="6" y2="34" />
              </g>
            )}
            {wholeTint && WHOLE_MARK[whole!.condition] && (
              <text x="20" y="25" textAnchor="middle" fontSize="13" fontWeight="700" fill={wholeTint}>
                {WHOLE_MARK[whole!.condition]}
              </text>
            )}
            {whole?.status === 'PLANNED' && (
              <rect x="1" y="1" width="38" height="38" fill="none" stroke={wholeTint ?? '#64748b'} strokeWidth="1.5" strokeDasharray="3 2" />
            )}
          </g>
        </g>
      </svg>
      <span className="text-[10px] font-semibold text-muted-foreground">{displayTooth(fdi, notation)}</span>
    </div>
  );
}
