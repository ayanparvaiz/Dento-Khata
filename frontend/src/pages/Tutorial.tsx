import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PlayCircle, Clock } from 'lucide-react';
import { TUTORIALS, ytEmbed, ytThumb, type Tutorial } from '@/lib/tutorials';
import { cn } from '@/lib/utils';

// Tutorial hub. Plays the selected video (overview by default); per-section videos
// appear as they get recorded — until then they show a "coming soon" chip.
export function Tutorial() {
  const available = TUTORIALS.filter((t) => t.videoId);
  const [active, setActive] = useState<Tutorial>(available[0] ?? TUTORIALS[0]);

  return (
    <div className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <PlayCircle className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">টিউটোরিয়াল</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        ভিডিও দেখে শিখে নিন কীভাবে Dento Khata ব্যবহার করবেন। নিচে প্রতিটি অংশের আলাদা ভিডিও যোগ হচ্ছে।
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Player */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-black/5">
            {active.videoId ? (
              <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
                <iframe
                  key={active.videoId}
                  src={ytEmbed(active.videoId)}
                  title={active.title}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="grid aspect-video place-items-center text-slate-400">
                <div className="text-center">
                  <Clock className="mx-auto mb-2 h-8 w-8" />
                  <p className="text-sm">এই অংশের ভিডিও শীঘ্রই আসছে</p>
                </div>
              </div>
            )}
          </div>
          <h2 className="mt-4 text-lg font-semibold">{active.title}</h2>
          <p className="text-sm text-muted-foreground">{active.desc}</p>
        </div>

        {/* Chapter list */}
        <div className="space-y-2">
          <p className="px-1 text-sm font-semibold text-muted-foreground">সব অধ্যায়</p>
          {TUTORIALS.map((t) => {
            const ready = !!t.videoId;
            const isActive = t.key === active.key;
            return (
              <button
                key={t.key}
                onClick={() => ready && setActive(t)}
                disabled={!ready}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors',
                  isActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                  !ready && 'cursor-not-allowed opacity-60',
                )}
              >
                <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                  {ready ? (
                    <>
                      <img src={ytThumb(t.videoId!)} alt="" className="h-full w-full object-cover" loading="lazy" />
                      <PlayCircle className="absolute inset-0 m-auto h-6 w-6 text-white drop-shadow" />
                    </>
                  ) : (
                    <div className="grid h-full w-full place-items-center text-slate-400"><Clock className="h-5 w-5" /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{ready ? t.desc : 'শীঘ্রই আসছে'}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
