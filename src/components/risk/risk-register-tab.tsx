// src/components/risk/risk-register-tab.tsx
'use client';

import React, { useState, useMemo } from 'react';
import type { RiskItem, Member } from '@/types/sprint-data'; // Removed SprintData, Task as they are not directly used
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Info, FileText, PlusCircle, Edit, Trash2 } from 'lucide-react';
import RegisterRiskModal from '@/components/dialogs/register-risk-modal';
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface RiskRegisterTabProps {
  projectId: string;
  projectName: string;
  risks: RiskItem[];
  members: Member[];
  onSaveRisk: (newRisk: Omit<RiskItem, 'id' | 'riskScore'>) => void;
  onUpdateRisk: (updatedRisk: RiskItem) => void;
  onDeleteRisk: (riskId: string) => void;
}

export default function RiskRegisterTab({
  projectId,
  projectName,
  risks = [],
  members,
  onSaveRisk,
  onUpdateRisk,
  onDeleteRisk,
}: RiskRegisterTabProps) {
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<RiskItem | null>(null);
  const { toast } = useToast();

  const handleOpenRegisterModal = (riskToEdit?: RiskItem) => {
    setEditingRisk(riskToEdit || null);
    setIsRegisterModalOpen(true);
  };

  const handleSaveCallback = (
    riskDetails: Omit<RiskItem, 'id' | 'riskScore'>
  ) => {
    if (editingRisk) {
      onUpdateRisk({
        ...riskDetails,
        id: editingRisk.id,
        riskScore: editingRisk.riskScore, // Preserve or recalculate as needed
      });
    } else {
      onSaveRisk(riskDetails);
    }
    setIsRegisterModalOpen(false);
    setEditingRisk(null);
  };

  const existingRiskTitles = useMemo(() => {
    return risks
      .filter((r) => !editingRisk || r.id !== editingRisk.id)
      .map((r) => r.title.toLowerCase());
  }, [risks, editingRisk]);

  const getRiskScoreColor = (score: number): string => {
    if (score >= 15) return 'bg-red-500 text-white'; // Very High
    if (score >= 10) return 'bg-orange-500 text-white'; // High
    if (score >= 5) return 'bg-yellow-500 text-black'; // Medium
    return 'bg-green-500 text-white'; // Low / Very Low
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center justify-start gap-2">
                <FileText className="h-5 w-5 text-primary" /> Risk Register
              </CardTitle>
              <CardDescription>
                Log, track, and manage all identified risks for project '
                {projectName}'.
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenRegisterModal()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Register New Risk
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {risks.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-md border-2 border-dashed p-6">
              <Info className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                No risks registered yet for this project.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Added min-w for horizontal scroll */}
              <div className="min-w-[1200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Risk ID</TableHead>
                      <TableHead className="w-[250px]">Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Identified Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Likelihood</TableHead>
                      <TableHead className="text-center">Impact</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead className="w-[100px] text-center">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {risks.map((risk) => (
                      <TableRow key={risk.id}>
                        <TableCell className="font-mono text-xs">
                          {risk.id}
                        </TableCell>
                        <TableCell className="font-medium">
                          {risk.title}
                        </TableCell>
                        <TableCell>{risk.category}</TableCell>
                        <TableCell>{risk.owner}</TableCell>
                        <TableCell>
                          {risk.identifiedDate &&
                          isValid(parseISO(risk.identifiedDate))
                            ? format(
                                parseISO(risk.identifiedDate),
                                'MMM d, yyyy'
                              )
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              risk.status === 'Closed' ||
                              risk.status === 'Mitigated'
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
                        <TableCell className="text-center">
                          {risk.likelihood}
                        </TableCell>
                        <TableCell className="text-center">
                          {risk.impact}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getRiskScoreColor(risk.riskScore)}>
                            {risk.riskScore}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenRegisterModal(risk)}
                            className="h-8 w-8"
                            title="Edit Risk"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteRisk(risk.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Risk"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RegisterRiskModal
        isOpen={isRegisterModalOpen}
        onOpenChange={setIsRegisterModalOpen}
        onSaveRisk={handleSaveCallback}
        projectMembers={members}
        existingRiskTitles={existingRiskTitles}
        initialData={editingRisk}
      />
    </>
  );
}
