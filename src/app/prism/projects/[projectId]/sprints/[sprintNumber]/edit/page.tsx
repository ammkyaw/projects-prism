'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlusCircle, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import type {
  Sprint,
  SprintDetailItem,
  Project,
  Member,
} from '@/types/sprint-data';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useProjects, useUpdateProject } from '@/hooks/use-projects';

interface DetailRow extends SprintDetailItem {
  _internalId: string;
}

const createEmptyDetailRow = (): DetailRow => ({
  _internalId: `temp_${Date.now()}_${Math.random()}`,
  id: '',
  ticketNumber: '',
  developer: '',
  storyPoints: 0,
  devTime: '',
});

export default function EditSprintDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const projectId = params.projectId as string;
  const sprintNumberParam = params.sprintNumber as string;
  const sprintNumber = parseInt(sprintNumberParam, 10);

  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();
  const updateProjectMutation = useUpdateProject();

  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === projectId) ?? null;
  }, [projects, projectId]);

  const selectedSprint = useMemo(() => {
    if (!selectedProject) return null;
    return (
      selectedProject.sprintData.sprints.find(
        (s) => s.sprintNumber === sprintNumber
      ) ?? null
    );
  }, [selectedProject, sprintNumber]);

  useEffect(() => {
    if (!isLoadingProjects && !selectedProject) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Project not found.',
      });
      router.push('/prism');
    }
  }, [isLoadingProjects, selectedProject, router, toast]);

  useEffect(() => {
    if (selectedSprint) {
      if (selectedSprint.status === 'Completed') {
        toast({
          title: 'Sprint Completed',
          description: `Sprint ${sprintNumber} is completed and read-only.`,
        });
        router.push('/prism');
        return;
      }

      const validatedDetails = (selectedSprint.details || []).map((item, index) => ({
        ...item,
        _internalId: item.id || `initial_${index}_${Date.now()}`,
      }));

      setDetailRows(
        validatedDetails.length > 0
          ? validatedDetails
          : [createEmptyDetailRow()]
      );
    }
  }, [selectedSprint, sprintNumber, router, toast]);

  useEffect(() => {
    if (!selectedSprint) return;

    const originalDetailsString = JSON.stringify(
      (selectedSprint.details || [])
        .map(({ id, ticketNumber, developer, storyPoints, devTime }) => ({
          id: id || '',
          ticketNumber: ticketNumber.trim(),
          developer: developer.trim(),
          storyPoints: Number(storyPoints ?? 0),
          devTime: devTime.trim(),
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );

    const currentRowsString = JSON.stringify(
      detailRows
        .filter((row) => row.ticketNumber.trim() || row.developer.trim() || row.storyPoints > 0 || row.devTime.trim())
        .map(({ id, ticketNumber, developer, storyPoints, devTime }) => ({
          id: id || '',
          ticketNumber: ticketNumber.trim(),
          developer: developer.trim(),
          storyPoints: Number(storyPoints ?? 0),
          devTime: devTime.trim(),
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );

    setHasUnsavedChanges(originalDetailsString !== currentRowsString);
  }, [detailRows, selectedSprint]);

  const handleAddDetailRow = () => {
    setDetailRows([...detailRows, createEmptyDetailRow()]);
  };

  const handleRemoveDetailRow = (internalId: string) => {
    setDetailRows((prevRows) => {
      const newRows = prevRows.filter((row) => row._internalId !== internalId);
      return newRows.length > 0 ? newRows : [createEmptyDetailRow()];
    });
  };

  const handleDetailInputChange = (
    internalId: string,
    field: keyof Omit<SprintDetailItem, 'id'>,
    value: string | number
  ) => {
    setDetailRows((rows) =>
      rows.map((row) =>
        row._internalId === internalId ? { ...row, [field]: value } : row
      )
    );
  };

  const handleSaveDetails = () => {
    if (!selectedProject || !selectedSprint) return;

    const finalDetails: SprintDetailItem[] = [];
    const ticketNumbers = new Set<string>();
    let hasErrors = false;

    detailRows.forEach((row, index) => {
      const isEmpty = !row.ticketNumber.trim() && !row.developer.trim() && !(row.storyPoints > 0) && !row.devTime.trim();
      if (isEmpty) return;

      const ticketNumber = row.ticketNumber.trim();
      if (!ticketNumber) {
        toast({ variant: 'destructive', title: 'Error', description: `Row ${index + 1}: Ticket # is required.` });
        hasErrors = true;
        return;
      }
      if (ticketNumbers.has(ticketNumber.toLowerCase())) {
        toast({ variant: 'destructive', title: 'Error', description: `Row ${index + 1}: Duplicate Ticket #.` });
        hasErrors = true;
        return;
      }
      ticketNumbers.add(ticketNumber.toLowerCase());

      finalDetails.push({
        id: row.id || `detail_${sprintNumber}_${Date.now()}_${index}`,
        ticketNumber,
        developer: row.developer.trim(),
        storyPoints: Number(row.storyPoints),
        devTime: row.devTime.trim(),
      });
    });

    if (hasErrors) return;

    const updatedSprint: Sprint = { ...selectedSprint, details: finalDetails };
    const updatedSprints = selectedProject.sprintData.sprints.map((s) =>
      s.sprintNumber === sprintNumber ? updatedSprint : s
    );

    updateProjectMutation.mutate(
      {
        ...selectedProject,
        sprintData: { ...selectedProject.sprintData, sprints: updatedSprints },
      },
      {
        onSuccess: () => {
          toast({ title: 'Success', description: 'Sprint details saved.' });
          setHasUnsavedChanges(false);
        },
      }
    );
  };

  if (isLoadingProjects) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading sprint details...</p>
      </div>
    );
  }

  if (!selectedProject || !selectedSprint) return null;

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/prism">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {updateProjectMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Button onClick={handleSaveDetails} disabled={!hasUnsavedChanges || updateProjectMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sprint {sprintNumber} Details</CardTitle>
          <CardDescription>
            Project: {selectedProject.name} | Status: {selectedSprint.status}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Developer</TableHead>
                <TableHead className="text-right">Story Points</TableHead>
                <TableHead className="text-right">Dev Time</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailRows.map((row) => (
                <TableRow key={row._internalId}>
                  <TableCell>
                    <Input
                      value={row.ticketNumber}
                      onChange={(e) => handleDetailInputChange(row._internalId, 'ticketNumber', e.target.value)}
                      placeholder="JIRA-123"
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.developer || 'unassigned'}
                      onValueChange={(val) => handleDetailInputChange(row._internalId, 'developer', val === 'unassigned' ? '' : val)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select Developer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">-- Unassigned --</SelectItem>
                        {selectedProject.members.map((m) => (
                          <SelectItem key={m.id} value={m.name}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={row.storyPoints}
                      onChange={(e) => handleDetailInputChange(row._internalId, 'storyPoints', parseInt(e.target.value, 10) || 0)}
                      className="h-9 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.devTime}
                      onChange={(e) => handleDetailInputChange(row._internalId, 'devTime', e.target.value)}
                      placeholder="e.g. 2d"
                      className="h-9 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveDetailRow(row._internalId)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button variant="outline" size="sm" onClick={handleAddDetailRow} className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Row
          </Button>
        </CardContent>
        <CardFooter className="justify-between border-t bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">Changes are saved to the project backlog and history.</p>
          <Button onClick={handleSaveDetails} disabled={!hasUnsavedChanges || updateProjectMutation.isPending}>
            {updateProjectMutation.isPending ? 'Saving...' : 'Save Details'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
