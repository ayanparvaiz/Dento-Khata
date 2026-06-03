import {
  CONDITION_COLOR, HOLLOW_CONDITIONS, WHOLE_CONDITIONS, WHOLE_MARK,
  displayTooth, surfaceForZone, type Notation, type Zone, type ToothRecord,
} from '@/lib/charting';

/* Anatomical (buccal-view) odontogram tooth — looks like a paper dental chart:
   one continuous crown+root outline, shaped per tooth type, roots pointing away
   from the midline (up for the upper arch, down for the lower). Surface marking
   logic is unchanged: 5 transparent hit-zones over the crown map to M/D/B/L/O. */

type Type = 'incisor' | 'canine' | 'premolar' | 'molar';

function morphology(fdi: string) {
  const q = Number(fdi[0]);
  const n = Number(fdi[1]);
  const upper = q === 1 || q === 2 || q === 5 || q === 6;
  const childMolar = q >= 5 && n >= 4;
  const type: Type =
    (q <= 4 && n >= 6) || childMolar ? 'molar'
      : q <= 4 && (n === 4 || n === 5) ? 'premolar'
        : n === 3 ? 'canine'
          : 'incisor';
  // crown x-range (centred in a 40-wide box): anteriors slim, molars wide
  const [x0, x1] = type === 'molar' ? [5, 35] : type === 'premolar' ? [9, 31] : type === 'canine' ? [12, 28] : [13, 27];
  const rootCount = type === 'molar' ? (upper ? 3 : 2) : 1;
  return { upper, type, x0, x1, rootCount };
}

function crownPath(type: Type, x0: number, x1: number, incY: number, gumY: number) {
  const w = x1 - x0, cx = (x0 + x1) / 2;
  const s = Math.sign(incY - gumY) || 1;     // cusp tips point away from the gum
  const up = incY - s * 3;                    // side point just before the incisal corner
  let edge: string;
  if (type === 'incisor') {
    edge = `Q ${x0} ${incY} ${x0 + 3} ${incY} L ${x1 - 3} ${incY} Q ${x1} ${incY} ${x1} ${up}`;
  } else if (type === 'canine') {
    edge = `L ${cx} ${incY + s * 4} L ${x1} ${up}`;
  } else if (type === 'premolar') {
    edge = `Q ${x0} ${incY} ${x0 + w * 0.22} ${incY + s * 2} Q ${cx} ${incY - s * 3} ${x1 - w * 0.22} ${incY + s * 2} Q ${x1} ${incY} ${x1} ${up}`;
  } else {
    edge = `Q ${x0} ${incY} ${x0 + w * 0.16} ${incY + s * 3} Q ${x0 + w * 0.34} ${incY - s * 2} ${cx} ${incY + s * 3} Q ${x1 - w * 0.34} ${incY - s * 2} ${x1 - w * 0.16} ${incY + s * 3} Q ${x1} ${incY} ${x1} ${up}`;
  }
  return `M ${x0} ${gumY} L ${x0} ${up} ${edge} L ${x1} ${gumY} Z`;
}

function rootPaths(count: number, x0: number, x1: number, gumY: number, apexY: number) {
  const w = x1 - x0, cx = (x0 + x1) / 2, midY = gumY + (apexY - gumY) * 0.55;
  const leaf = (xl: number, xr: number, ax: number) =>
    `M ${xl} ${gumY} Q ${xl} ${midY} ${ax} ${apexY} Q ${xr} ${midY} ${xr} ${gumY} Z`;
  if (count === 1) return [leaf(x0 + w * 0.28, x1 - w * 0.28, cx)];
  if (count === 2) return [leaf(x0, x0 + w * 0.46, x0 + w * 0.18), leaf(x1 - w * 0.46, x1, x1 - w * 0.18)];
  return [leaf(x0, x0 + w * 0.3, x0 + w * 0.1), leaf(cx - w * 0.13, cx + w * 0.13, cx), leaf(x1 - w * 0.3, x1, x1 - w * 0.1)];
}

// 5 surface hit-zones inside the crown bounding box.
function zonePolys(x: number, y: number, w: number, h: number): Record<Zone, string> {
  const ix = w * 0.3, iy = h * 0.3;
  return {
    top: `${x},${y} ${x + w},${y} ${x + w - ix},${y + iy} ${x + ix},${y + iy}`,
    bottom: `${x},${y + h} ${x + w},${y + h} ${x + w - ix},${y + h - iy} ${x + ix},${y + h - iy}`,
    left: `${x},${y} ${x + ix},${y + iy} ${x + ix},${y + h - iy} ${x},${y + h}`,
    right: `${x + w},${y} ${x + w - ix},${y + iy} ${x + w - ix},${y + h - iy} ${x + w},${y + h}`,
    center: `${x + ix},${y + iy} ${x + w - ix},${y + iy} ${x + w - ix},${y + h - iy} ${x + ix},${y + h - iy}`,
  } as Record<Zone, string>;
}

const STROKE = '#475569';

export function AnatomicalTooth({
  fdi, notation, records, selected, onZone,
}: {
  fdi: string;
  notation: Notation;
  records: ToothRecord[];
  selected: boolean;
  onZone: (zone: Zone) => void;
}) {
  const surfaceColor: Record<string, string> = {};
  let whole: ToothRecord | undefined;
  for (const r of records) {
    if (!r.surface || WHOLE_CONDITIONS.has(r.condition)) whole = whole ?? r;
    else if (!surfaceColor[r.surface]) surfaceColor[r.surface] = CONDITION_COLOR[r.condition];
  }
  const hollow = whole && HOLLOW_CONDITIONS.has(whole.condition);
  const wholeTint = whole && !hollow ? CONDITION_COLOR[whole.condition] : null;

  const { upper, type, x0, x1, rootCount } = morphology(fdi);
  // geometry (viewBox 40x96): upper arch roots up / crown low; lower arch crown high / roots down
  const incY = upper ? 78 : 18;
  const gumY = upper ? 48 : 48;
  const apexY = upper ? 4 : 92;
  const crownY = Math.min(incY, gumY);
  const crownH = Math.abs(incY - gumY);
  const zones = zonePolys(x0, crownY, x1 - x0, crownH);
  const cx = (x0 + x1) / 2, mid = crownY + crownH / 2;

  return (
    <div className="flex flex-col items-center gap-0.5" data-tooth={fdi}>
      <svg
        viewBox="0 0 40 96"
        className={selected ? 'rounded ring-2 ring-primary' : ''}
        style={{ width: 30, height: 72, opacity: hollow ? 0.5 : 1 }}
      >
        {/* roots */}
        {rootPaths(rootCount, x0, x1, gumY, apexY).map((d, i) => (
          <path key={i} d={d} fill={wholeTint ? wholeTint + '22' : '#fffdf7'} stroke={STROKE} strokeWidth="1.2" strokeLinejoin="round" />
        ))}
        {/* crown outline (filled with whole-tooth tint if any) */}
        <path d={crownPath(type, x0, x1, incY, gumY)} fill={wholeTint ? wholeTint + '40' : '#ffffff'} stroke={STROKE} strokeWidth="1.3" strokeLinejoin="round" />

        {/* surface hit-zones — faint grid always visible so the user sees where to click;
            fills in with colour once a surface has a finding */}
        {(Object.keys(zones) as Zone[]).map((zone) => {
          const surf = surfaceForZone(fdi, zone);
          const c = surfaceColor[surf];
          return (
            <polygon
              key={zone}
              points={zones[zone]}
              fill={c ? c + 'cc' : 'transparent'}
              stroke={c || '#cbd5e1'}
              strokeWidth="0.6"
              className={c ? '' : 'transition-colors hover:fill-primary/20'}
              style={{ cursor: 'pointer', pointerEvents: 'all' }}
              onClick={(e) => { e.stopPropagation(); onZone(zone); }}
            />
          );
        })}

        {hollow && (
          <g stroke={STROKE} strokeWidth="2">
            <line x1={x0} y1={crownY} x2={x1} y2={crownY + crownH} />
            <line x1={x1} y1={crownY} x2={x0} y2={crownY + crownH} />
          </g>
        )}
        {wholeTint && WHOLE_MARK[whole!.condition] && (
          <text x={cx} y={mid + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={wholeTint}>
            {WHOLE_MARK[whole!.condition]}
          </text>
        )}
        {whole?.status === 'PLANNED' && (
          <rect x={x0 - 1} y={crownY - 1} width={x1 - x0 + 2} height={crownH + 2} fill="none" stroke={wholeTint ?? STROKE} strokeWidth="1.2" strokeDasharray="3 2" />
        )}
      </svg>
      <span className="text-[10px] font-semibold text-muted-foreground">{displayTooth(fdi, notation)}</span>
    </div>
  );
}
