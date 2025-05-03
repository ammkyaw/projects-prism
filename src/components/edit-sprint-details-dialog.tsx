
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Trash2 } from 'lucide-react';
import type { Sprint, SprintDetailItem } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface EditSprintDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sprint: Sprint;
  projectName: string;
  onSave: (updatedDetails: SprintDetailItem[]) => void;
}

// Internal state structure for editing rows
interface DetailRow extends SprintDetailItem {
  _internalId: string; // For React key management
}

const createEmptyDetailRow = (): DetailRow => ({
    _internalId: `temp_${Date.now()}_${Math.random()}`,
    id: '', // Will be assigned on save if needed, or use _internalId
    ticketNumber: '',
    developer: '',
    storyPoints: 0,
    devTime: '',
});

export default function EditSprintDetailsDialog({
  isOpen,
  onClose,
  sprint,
  projectName,
  onSave,
}: EditSprintDetailsDialogProps) {
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const { toast } = useToast();

  // Initialize rows when the dialog opens or sprint changes
  useEffect(() => {
    if (isOpen && sprint?.details) {
      setDetailRows(sprint.details.map((item, index) => ({
          ...item,
          _internalId: item.id || `initial_${index}_${Date.now()}`, // Ensure an internal ID
      })));
    } else if (isOpen) {
       setDetailRows([createEmptyDetailRow()]); // Start with one empty row if no details exist
    }
    // Reset form when dialog closes or sprint changes while open
    return () => {
        if (!isOpen) {
            setDetailRows([]);
        }
    };
  }, [isOpen, sprint]);

  const handleAddDetailRow = () => {
    setDetailRows([...detailRows, createEmptyDetailRow()]);
  };

  const handleRemoveDetailRow = (internalId: string) => {
    setDetailRows(prevRows => {
        const newRows = prevRows.filter(row => row._internalId !== internalId);
        return newRows.length > 0 ? newRows : [createEmptyDetailRow()]; // Keep at least one row
    });
  };

  const handleDetailInputChange = (
    internalId: string,
    field: keyof Omit<SprintDetailItem, 'id'>,
    value: string | number
  ) => {
    setDetailRows(rows =>
      rows.map(row =>
        row._internalId === internalId ? { ...row, [field]: value } : row
      )
    );
  };

  const handleSaveDetails = () => {
    let hasErrors = false;
    const finalDetails: SprintDetailItem[] = [];

    detailRows.forEach((row, index) => {
        // Skip completely empty rows silently
        if (!row.ticketNumber && !row.developer && !row.storyPoints && !row.devTime) {
            return;
        }

        const ticketNumber = row.ticketNumber.trim();
        const developer = row.developer.trim();
        const storyPoints = Number(row.storyPoints); // Ensure it's a number
        const devTime = row.devTime.trim();

        let rowErrors: string[] = [];
        if (!ticketNumber) rowErrors.push("Ticket # required");
        if (!developer) rowErrors.push("Developer required");
        if (isNaN(storyPoints) || storyPoints < 0) rowErrors.push("Invalid Story Points");
        // Basic devTime validation (e.g., must not be empty, could add regex later)
        if (!devTime) rowErrors.push("Dev Time required");

        if (rowErrors.length > 0) {
            toast({
                variant: "destructive",
                title: `Error in Detail Row ${index + 1}`,
                description: rowErrors.join(', ')
            });
            hasErrors = true;
            return; // Stop processing this row
        }

        finalDetails.push({
            id: row.id || row._internalId, // Preserve existing ID or use internal one
            ticketNumber,
            developer,
            storyPoints,
            devTime,
        });
    });

    if (hasErrors) {
        return;
    }

    onSave(finalDetails);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Details for Sprint {sprint?.sprintNumber} (Project: {projectName})</DialogTitle>
          <DialogDescription>
            Add or modify Jira ticket information for this sprint.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 pr-2 space-y-4">
           {/* Table Header */}
           <div className="hidden md:grid grid-cols-[1fr_1fr_100px_100px_40px] gap-x-3 items-center pb-2 border-b">
              <Label className="text-xs font-medium text-muted-foreground">Ticket #*</Label>
              <Label className="text-xs font-medium text-muted-foreground">Developer*</Label>
              <Label className="text-xs font-medium text-muted-foreground text-right">Story Pts*</Label>
              <Label className="text-xs font-medium text-muted-foreground text-right">Dev Time*</Label>
              <div /> {/* Placeholder for delete */}
           </div>

           {/* Detail Rows */}
           <div className="space-y-4 md:space-y-2">
              {detailRows.map((row) => (
                 <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[1fr_1fr_100px_100px_40px] gap-x-3 gap-y-2 items-start">
                    {/* Ticket Number */}
                    <div className="md:col-span-1 col-span-2">
                       <Label htmlFor={`ticket-${row._internalId}`} className="md:hidden text-xs font-medium">Ticket #*</Label>
                       <Input
                          id={`ticket-${row._internalId}`}
                          value={row.ticketNumber}
                          onChange={e => handleDetailInputChange(row._internalId, 'ticketNumber', e.target.value)}
                          placeholder="JIRA-123"
                          className="h-9"
                       />
                    </div>
                    {/* Developer */}
                    <div className="md:col-span-1 col-span-2">
                       <Label htmlFor={`developer-${row._internalId}`} className="md:hidden text-xs font-medium">Developer*</Label>
                       <Input
                          id={`developer-${row._internalId}`}
                          value={row.developer}
                          onChange={e => handleDetailInputChange(row._internalId, 'developer', e.target.value)}
                          placeholder="Jane Doe"
                          className="h-9"
                       />
                    </div>
                    {/* Story Points */}
                    <div className="md:col-span-1 col-span-1">
                       <Label htmlFor={`sp-${row._internalId}`} className="md:hidden text-xs font-medium">Story Pts*</Label>
                       <Input
                          id={`sp-${row._internalId}`}
                          type="number"
                          value={row.storyPoints}
                          onChange={e => handleDetailInputChange(row._internalId, 'storyPoints', Number(e.target.value))}
                          placeholder="Points"
                          className="h-9 text-right"
                          min="0"
                       />
                    </div>
                    {/* Dev Time */}
                     <div className="md:col-span-1 col-span-1">
                       <Label htmlFor={`time-${row._internalId}`} className="md:hidden text-xs font-medium">Dev Time*</Label>
                       <Input
                          id={`time-${row._internalId}`}
                          value={row.devTime}
                          onChange={e => handleDetailInputChange(row._internalId, 'devTime', e.target.value)}
                          placeholder="e.g., 2d"
                          className="h-9 text-right"
                       />
                    </div>
                     {/* Delete Button */}
                    <div className="flex items-center justify-end md:col-span-1 col-span-2 md:self-center md:mt-0 mt-1">
                       <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDetailRow(row._internalId)}
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          aria-label="Remove detail row"
                       >
                          <Trash2 className="h-4 w-4" />
                       </Button>
                    </div>
                 </div>
              ))}
           </div>
           <Button type="button" onClick={handleAddDetailRow} variant="outline" size="sm" className="mt-4">
             <PlusCircle className="mr-2 h-4 w-4" />
             Add Detail Row
           </Button>
           <p className="text-xs text-muted-foreground pt-2">* Required field.</p>
        </div>

        <DialogFooter className="mt-auto pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSaveDetails}>Save Details</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
