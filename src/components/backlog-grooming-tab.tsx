
"use client";

import type { Task } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, Edit } from 'lucide-react';

interface BacklogGroomingTabProps {
  projectId: string;
  projectName: string;
  backlog: Task[]; // Pass backlog data for grooming
}

export default function BacklogGroomingTab({ projectId, projectName, backlog }: BacklogGroomingTabProps) {

  return (
    <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2"><Edit className="h-5 w-5 text-primary" /> Backlog Grooming</CardTitle>
        <CardDescription>Refine backlog items for project '{projectName}': add details, estimate effort, split stories.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        (Grooming features like detailed editing, estimation tools will be implemented here)
      </CardContent>
    </Card>
  );
}
```
  </change>
  <change>
    <file>src/components