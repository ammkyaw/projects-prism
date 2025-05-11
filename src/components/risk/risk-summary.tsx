// src/components/risk/risk-summary.tsx
'use client';

import type { RiskItem } from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { ShieldAlert, ListChecks, TrendingUp, AlertOctagon } from 'lucide-react';

interface RiskSummaryProps {
  risks: RiskItem[];
}

export default function RiskSummary({ risks }: RiskSummaryProps) {
  const totalRisks = risks.length;
  const openRisks = risks.filter(
    (risk) => risk.status === 'Open' || risk.status === 'In Progress'
  ).length;
  const totalRiskScore = risks.reduce((sum, risk) => sum + risk.riskScore, 0);
  const averageRiskScore =
    totalRisks > 0 ? (totalRiskScore / totalRisks).toFixed(2) : '0.00';

  const highOrVeryHighRisks = risks.filter(
    (risk) => risk.riskScore >= 15 // Assuming Very High (15-25) and High (10-12)
  ).length;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Risks</CardTitle>
          <ListChecks className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalRisks}</div>
          <p className="text-xs text-muted-foreground">
            All registered risks
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Open Risks</CardTitle>
          <AlertOctagon className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{openRisks}</div>
          <p className="text-xs text-muted-foreground">
            Risks currently open or in progress
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Average Risk Score
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{averageRiskScore}</div>
          <p className="text-xs text-muted-foreground">
            Average severity of all risks
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            High/Very High Risks
          </CardTitle>
          <ShieldAlert className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{highOrVeryHighRisks}</div>
          <p className="text-xs text-muted-foreground">
            Risks with score &gt;= 15
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
