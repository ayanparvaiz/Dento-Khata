import { useEffect, useRef, useState } from 'react';
import { useFiles, useFileMutations, type PatientFile } from '@/lib/clinical';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronLeft, ChevronRight, Contrast, ExternalLink, FileText, Maximize2,
  RotateCw, Trash2, Upload, X, ZoomIn, ZoomOut,
} from 'lucide-react';

const CATEGORIES = ['INTRAORAL', 'OPG', 'PERIAPICAL', 'BITEWING', 'PHOTO', 'LAB_REPORT', 'CONSENT', 'OTHER'];
const fileUrl = (p: string) => `${location.protocol}//${location.hostname}:3000${p}`;
const isImg = (f: PatientFile) => f.fileType === 'IMAGE';

export function ImagingTab({ patientId }: { patientId: string }) {
  const { data: files = [] } = useFiles(patientId);
  const m = useFileMutations(patientId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('INTRAORAL');
  const [compare, setCompare] = useState<string[]>([]);
  const [viewIdx, setViewIdx] = useState<number | null>(null); // index into images for the viewer

  const images = files.filter(isImg);

  const onFile = (file?: File) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    m.upload.mutate(fd);
  };
  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)));
  const compared = compare.map((id) => files.find((f) => f.id === id)).filter(Boolean) as PatientFile[];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div>
            <Label>Category</Label>
            <Select className="w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button onClick={() => inputRef.current?.click()} disabled={m.upload.isPending}>
            <Upload className="h-4 w-4" /> {m.upload.isPending ? 'Uploading…' : 'Upload X-ray / photo / document'}
          </Button>
          <span className="text-xs text-muted-foreground">jpg / png / pdf · max 25MB · click an image to view large · tick 2 to compare</span>
        </CardContent>
      </Card>

      {compared.length === 2 && compared.every(isImg) && (
        <Card>
          <CardHeader><CardTitle>Before / After</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {compared.map((f) => (
              <img key={f.id} src={fileUrl(f.filePath)} alt={f.fileName} className="w-full cursor-zoom-in rounded-md border border-border"
                onClick={() => setViewIdx(images.findIndex((x) => x.id === f.id))} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Gallery ({files.length})</CardTitle></CardHeader>
        <CardContent>
          {files.length === 0 && <p className="text-sm text-muted-foreground">No images or documents yet.</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {files.map((f) => (
              <div key={f.id} className={`relative rounded-md border-2 p-1 ${compare.includes(f.id) ? 'border-primary' : 'border-border'}`}>
                {/* compare checkbox (does not open viewer) */}
                <label className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded bg-white/90 px-1 text-[10px] shadow" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={compare.includes(f.id)} onChange={() => toggleCompare(f.id)} /> cmp
                </label>
                {isImg(f) ? (
                  <button className="group relative block w-full" onClick={() => setViewIdx(images.findIndex((x) => x.id === f.id))} title="Click to view large">
                    <img src={fileUrl(f.filePath)} alt={f.fileName} className="h-28 w-full rounded object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center rounded bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                      <Maximize2 className="h-6 w-6" />
                    </span>
                  </button>
                ) : (
                  <a href={fileUrl(f.filePath)} target="_blank" rel="noreferrer" className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded bg-muted text-muted-foreground">
                    <FileText className="h-8 w-8" /><span className="text-xs">Open PDF</span>
                  </a>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] font-medium">{f.category}</span>
                  <button onClick={() => { if (confirm('Delete this file?')) m.remove.mutate(f.id); }} className="text-muted-foreground hover:text-danger">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-[9px] text-muted-foreground">{fmtDate(f.uploadedAt)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {viewIdx !== null && images[viewIdx] && (
        <ImageViewer
          files={images}
          index={viewIdx}
          onIndex={setViewIdx}
          onClose={() => setViewIdx(null)}
        />
      )}
    </div>
  );
}

// Fullscreen x-ray/photo viewer: zoom, pan, rotate, invert, prev/next.
function ImageViewer({
  files, index, onIndex, onClose,
}: {
  files: PatientFile[]; index: number; onIndex: (i: number) => void; onClose: () => void;
}) {
  const f = files[index];
  const [scale, setScale] = useState(1);
  const [rot, setRot] = useState(0);
  const [invert, setInvert] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const reset = () => { setScale(1); setRot(0); setInvert(false); setPos({ x: 0, y: 0 }); };
  useEffect(reset, [index]);

  // keyboard: esc close, arrows prev/next, +/- zoom
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && index < files.length - 1) onIndex(index + 1);
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      else if (e.key === '+' || e.key === '=') setScale((s) => Math.min(8, s + 0.25));
      else if (e.key === '-') setScale((s) => Math.max(0.25, s - 0.25));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, files.length, onClose, onIndex]);

  const btn = 'flex h-9 w-9 items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/30';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      {/* toolbar */}
      <div className="flex items-center justify-between gap-2 p-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm">
          <span className="font-medium">{f.fileName}</span>
          <span className="ml-2 text-white/60">{f.category} · {fmtDate(f.uploadedAt)} · {Math.round(scale * 100)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <button className={btn} title="Zoom out" onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}><ZoomOut className="h-4 w-4" /></button>
          <button className={btn} title="Zoom in" onClick={() => setScale((s) => Math.min(8, s + 0.25))}><ZoomIn className="h-4 w-4" /></button>
          <button className={btn} title="Rotate" onClick={() => setRot((r) => (r + 90) % 360)}><RotateCw className="h-4 w-4" /></button>
          <button className={btn} title="Invert (x-ray)" onClick={() => setInvert((v) => !v)}><Contrast className="h-4 w-4" /></button>
          <button className={btn} title="Reset" onClick={reset}><Maximize2 className="h-4 w-4" /></button>
          <a className={btn} title="Open full size" href={fileUrl(f.filePath)} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
          <button className={btn} title="Close (Esc)" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* image stage */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => setScale((s) => Math.min(8, Math.max(0.25, s - e.deltaY * 0.0015)))}
        onPointerDown={(e) => { drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; }}
        onPointerMove={(e) => { if (drag.current) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => { drag.current = null; }}
        style={{ cursor: scale > 1 ? 'grab' : 'default' }}
      >
        {index > 0 && (
          <button className={`absolute left-3 ${btn}`} onClick={() => onIndex(index - 1)} title="Previous"><ChevronLeft className="h-5 w-5" /></button>
        )}
        <img
          src={fileUrl(f.filePath)}
          alt={f.fileName}
          draggable={false}
          className="max-h-full max-w-full select-none"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale}) rotate(${rot}deg)`,
            filter: invert ? 'invert(1)' : 'none',
            transition: drag.current ? 'none' : 'transform 0.05s',
          }}
        />
        {index < files.length - 1 && (
          <button className={`absolute right-3 ${btn}`} onClick={() => onIndex(index + 1)} title="Next"><ChevronRight className="h-5 w-5" /></button>
        )}
      </div>
      <div className="pb-2 text-center text-xs text-white/50">Scroll to zoom · drag to pan · ← → to switch · Esc to close</div>
    </div>
  );
}
