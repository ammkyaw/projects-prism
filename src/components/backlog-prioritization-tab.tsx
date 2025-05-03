
"use client";

import type { Task } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, Filter } from 'lucide-react';

interface BacklogPrioritizationTabProps {
  projectId: string;
  projectName: string;
  backlog: Task[]; // Pass backlog data for prioritization
}

export default function BacklogPrioritizationTab({ projectId, projectName, backlog }: BacklogPrioritizationTabProps) {

  return (
    <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2"><Filter className="h-5 w-5 text-primary" /> Backlog Prioritization</CardTitle>
        <CardDescription>Prioritize backlog items for project '{projectName}' based on value, effort, or other criteria.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        (Prioritization tools like drag-and-drop or ranking will be implemented here)
      </CardContent>
    </Card>
  );
}
