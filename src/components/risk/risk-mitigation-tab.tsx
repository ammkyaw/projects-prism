// src/components/risk/risk-mitigation-tab.tsx
'use client';

import type { SprintData, Task } from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Info, ShieldCheck } from 'lucide-react';

interface RiskMitigationTabProps {
  projectId: string;
  projectName: string;
  sprintData: SprintData | null;
  backlog?: Task[];
}

export default function RiskMitigationTab({
  projectId,
  projectName,
  sprintData,
  backlog,
}: RiskMitigationTabProps) {
  return (
    <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" /> Risk Mitigation
        </CardTitle>
        <CardDescription>
          Plan and track mitigation strategies for risks in project '
          {projectName}'.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        (Risk mitigation plans and progress will be displayed here.)
      </CardContent>
    </Card>
  );
}
