import { Card, CardContent } from '@/components/ui/card';
import { PlayCircle } from 'lucide-react';
import { OVERVIEW_VIDEO_ID, ytEmbed } from '@/lib/tutorials';

// Tutorial hub. A single walkthrough video for now; per-section videos come later.
export function Tutorial() {
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <PlayCircle className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold sm:text-2xl">টিউটোরিয়াল</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground sm:mb-6">
        ভিডিওটি দেখে শিখে নিন কীভাবে Dento Khata ব্যবহার করবেন — শুরু থেকে শেষ।
      </p>

      <Card className="mx-auto max-w-3xl overflow-hidden">
        <div className="relative w-full bg-black" style={{ aspectRatio: '16 / 9' }}>
          <iframe
            src={ytEmbed(OVERVIEW_VIDEO_ID)}
            title="Dento Khata — সম্পূর্ণ পরিচিতি"
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <CardContent className="pt-4">
          <h2 className="text-base font-semibold sm:text-lg">সম্পূর্ণ পরিচিতি</h2>
          <p className="text-sm text-muted-foreground">পুরো সিস্টেম কীভাবে ব্যবহার করবেন — শুরু থেকে শেষ।</p>
        </CardContent>
      </Card>
    </div>
  );
}
