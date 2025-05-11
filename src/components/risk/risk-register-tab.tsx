// src/components/risk/risk-register-tab.tsx
'use client';

import type { SprintData, Task } from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Info, FileText } from 'lucide-react';

interface RiskRegisterTabProps {
  projectId: string;
  projectName: string;
  sprintData: SprintData | null;
  backlog?: Task[];
}

export default function RiskRegisterTab({
  projectId,
  projectName,
  sprintData,
  backlog,
}: RiskRegisterTabProps) {
  return (
    <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Risk Register
        </CardTitle>
        <CardDescription>
          Log and track all identified risks for project '{projectName}'.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        (Risk register details will be displayed here.)
      </CardContent>
    </Card>
  );
}
