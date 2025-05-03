
"use client";

import type { SprintData } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, ListPlus } from 'lucide-react';

interface AnalyticsReportsTabProps {
  sprintData: SprintData | null; // Pass data needed for reports
  projectName: string;
}

export default function AnalyticsReportsTab({ sprintData, projectName }: AnalyticsReportsTabProps) {

  return (
    <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2"><ListPlus className="h-5 w-5 text-primary" /> Reports</CardTitle>
        <CardDescription>Generate custom or predefined reports for project '{projectName}'.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        (Report generation features will be implemented here. e.g., Export data, Sprint summary report)
      </CardContent>
    </Card>
  );
}
```
  </change>
  <change>
    <