// src/components/risk/risk-overview-tab.tsx
'use client';

import type { RiskItem } from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Info, ShieldAlert, AlertTriangle, TrendingUp } from 'lucide-react';
import RiskSummary from './risk-summary';
import RiskHeatMap from './risk-heat-map';
import TopRisksTable from './top-risks-table';

interface RiskOverviewTabProps {
  projectId: string;
  projectName: string;
  risks: RiskItem[];
}

export default function RiskOverviewTab({
  projectId,
  projectName,
  risks,
}: RiskOverviewTabProps) {
  if (!risks || risks.length === 0) {
    return (
      <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" /> Risk Overview
          </CardTitle>
          <CardDescription>
            No risks registered yet for project '{projectName}'.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center text-muted-foreground">
          <Info className="mr-2 h-5 w-5" />
          Register risks in the 'Register' sub-tab.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Risk Overview: {projectName}
          </CardTitle>
          <CardDescription>
            A high-level summary of the project's risk landscape.
          </CardDescription>
        </CardHeader>
      </Card>

      <RiskSummary risks={risks} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Risk Heat Map
            </CardTitle>
            <CardDescription>
              Distribution of risks by likelihood and impact.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RiskHeatMap risks={risks} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              Top 3 Critical Risks
            </CardTitle>
            <CardDescription>
              Risks with the highest scores demanding immediate attention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopRisksTable risks={risks} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
