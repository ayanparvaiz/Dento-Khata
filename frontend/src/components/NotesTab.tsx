import { useState } from 'react';
import { useNotes, useNotesMutations } from '@/lib/treatment';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

// Quick-insert templates dentists commonly reuse.
const TEMPLATES = [
  'Chief complaint: ',
  'Examination: ',
  'Diagnosis: ',
  'Treatment done today: ',
  'Advised: ',
];

export function NotesTab({ patientId }: { patientId: string }) {
  const { data: notes = [] } = useNotes(patientId);
  const m = useNotesMutations(patientId);
  const [content, setContent] = useState('');

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap gap-1">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={() => setContent((c) => (c ? c + '\n' : '') + t)}
                className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
              >
                {t.trim()}
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Clinical note for this visit…"
            className="w-full rounded-[var(--radius)] border border-border bg-card p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <Button
            disabled={!content.trim() || m.add.isPending}
            onClick={() => m.add.mutate(content, { onSuccess: () => setContent('') })}
          >
            Save note
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <h3 className="font-semibold">History ({notes.length})</h3>
          {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-md border border-border p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{fmtDate(n.createdAt)}</span>
                <button onClick={() => m.remove.mutate(n.id)} className="hover:text-danger">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm">{n.content}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
