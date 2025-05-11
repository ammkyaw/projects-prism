// src/components/risk/risk-overview-tab.tsx
'use client';

import type { SprintData, Task } from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Info, ShieldAlert } from 'lucide-react';

interface RiskOverviewTabProps {
  projectId: string;
  projectName: string;
  sprintData: SprintData | null;
  backlog?: Task[];
}

export default function RiskOverviewTab({
  projectId,
  projectName,
  sprintData,
  backlog,
}: RiskOverviewTabProps) {
  return (
    <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" /> Risk Overview
        </CardTitle>
        <CardDescription>
          High-level overview of risks for project '{projectName}'.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        (Risk overview details will be displayed here.)
      </CardContent>
    </Card>
  );
}
