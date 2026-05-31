import {
  CONDITION_COLOR, HOLLOW_CONDITIONS, WHOLE_CONDITIONS, WHOLE_MARK,
  displayTooth, surfaceForZone, type Notation, type Zone, type ToothRecord,
} from '@/lib/charting';

// Zone polygons inside a 40x40 box: 4 trapezoids around a center square.
const ZONES: { zone: Zone; points: string }[] = [
  { zone: 'top', points: '0,0 40,0 28,12 12,12' },
  { zone: 'bottom', points: '0,40 40,40 28,28 12,28' },
  { zone: 'left', points: '0,0 12,12 12,28 0,40' },
  { zone: 'right', points: '40,0 28,12 28,28 40,40' },
  { zone: 'center', points: '12,12 28,12 28,28 12,28' },
];

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

  return (
    <div className="flex flex-col items-center gap-0.5" data-tooth={fdi}>
      <svg
        viewBox="0 0 40 40"
        className={selected ? 'rounded ring-2 ring-primary' : ''}
        style={{ width: 34, height: 34, opacity: hollow ? 0.45 : 1 }}
      >
        {ZONES.map(({ zone, points }) => {
          const surf = surfaceForZone(fdi, zone);
          const fill = surfaceColor[surf] ? surfaceColor[surf] + '88' : wholeTint ? wholeTint + '33' : '#ffffff';
          return (
            <polygon
              key={zone}
              points={points}
              fill={fill}
              stroke="#cbd5e1"
              strokeWidth="1"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onZone(zone);
              }}
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
      </svg>
      <span className="text-[10px] font-semibold text-muted-foreground">{displayTooth(fdi, notation)}</span>
    </div>
  );
}
