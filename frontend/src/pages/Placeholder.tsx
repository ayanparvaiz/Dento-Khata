import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Temporary page for modules that are scheduled in the roadmap but not built yet.
export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming in {phase}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This module is planned in the roadmap and will be implemented in {phase}.
        </CardContent>
      </Card>
    </div>
  );
}
