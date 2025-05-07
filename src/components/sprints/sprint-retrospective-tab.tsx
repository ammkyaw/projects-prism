'use client';

import type { Sprint } from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Info, GitCommitVertical } from 'lucide-react';

interface SprintRetrospectiveTabProps {
  projectId: string;
  projectName: string;
  sprints: Sprint[]; // Pass sprints for selection or display
}

export default function SprintRetrospectiveTab({
  projectId,
  projectName,
  sprints,
}: SprintRetrospectiveTabProps) {
  return (
    <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <GitCommitVertical className="h-5 w-5 text-primary" /> Sprint
          Retrospective
        </CardTitle>
        <CardDescription>
          Review past sprints, document learnings, and plan improvements for
          project '{projectName}'.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        (Retrospective features will be implemented here)
      </CardContent>
    </Card>
  );
}
