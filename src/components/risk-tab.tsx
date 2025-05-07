'use client';

import type { SprintData, Task } from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Info, AlertTriangle } from 'lucide-react';

interface RiskTabProps {
  projectId: string;
  projectName: string;
  sprintData: SprintData | null;
  backlog?: Task[];
}

export default function RiskTab({
  projectId,
  projectName,
  sprintData,
  backlog,
}: RiskTabProps) {
  return (
    <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" /> Risk Management
        </CardTitle>
        <CardDescription>
          Identify, assess, and manage risks for project '{projectName}'.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        (Risk management features will be implemented here. e.g., Risk register,
        Mitigation plans)
      </CardContent>
    </Card>
  );
}
