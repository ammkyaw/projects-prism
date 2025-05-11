// src/components/risk/top-risks-table.tsx
'use client';

import type { RiskItem } from '@/types/sprint-data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

interface TopRisksTableProps {
  risks: RiskItem[];
}

export default function TopRisksTable({ risks }: TopRisksTableProps) {
  const topRisks = risks
    .filter(risk => risk.status === 'Open' || risk.status === 'In Progress') // Consider only open/active risks
    .sort((a, b) => b.riskScore - a.riskScore) // Sort by risk score descending
    .slice(0, 3); // Get top 3

  const getRiskScoreColor = (score: number): string => {
    if (score >= 15) return 'bg-red-600 text-white';
    if (score >= 10) return 'bg-orange-500 text-white';
    if (score >= 5) return 'bg-yellow-500 text-black';
    return 'bg-green-500 text-white';
  };

  if (topRisks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        No critical open risks to display.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Risk ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="text-center w-[80px]">Score</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {topRisks.map((risk) => (
            <TableRow key={risk.id}>
              <TableCell className="font-mono text-xs">{risk.id}</TableCell>
              <TableCell className="font-medium">{risk.title}</TableCell>
              <TableCell className="text-center">
                <Badge className={getRiskScoreColor(risk.riskScore)}>
                  {risk.riskScore}
                </Badge>
              </TableCell>
              <TableCell>
                 <Badge
                    variant={
                      risk.status === 'Closed' || risk.status === 'Mitigated'
                        ? 'secondary'
                        : risk.status === 'Open'
                          ? 'outline'
                          : 'default'
                    }
                    className="capitalize"
                  >
                    {risk.status}
                  </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
