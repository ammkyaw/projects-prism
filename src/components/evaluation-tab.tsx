
"use client";

import type { SprintData, Task, Member } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, ClipboardCheck } from 'lucide-react';

interface EvaluationTabProps {
  projectId: string;
  projectName: string;
  sprintData: SprintData | null;
  backlog?: Task[];
  members?: Member[];
}

export default function EvaluationTab({ projectId, projectName, sprintData, backlog, members }: EvaluationTabProps) {

  return (
    <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /> Evaluation</CardTitle>
        <CardDescription>Evaluate project performance and outcomes for '{projectName}'.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        (Evaluation features will be implemented here. e.g., Project health check, Goal achievement analysis)
      </CardContent>
    </Card>
  );
}
