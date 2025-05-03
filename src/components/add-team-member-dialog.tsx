
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users } from 'lucide-react';
import type { Member } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AddTeamMemberDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveMembers: (selectedMemberIds: string[]) => void; // Callback with array of selected member IDs
  allMembers: Member[]; // List of all available members in the project
  currentTeamMembers: string[]; // IDs of members already in the team being edited
}

export default function AddTeamMemberDialog({ isOpen, onOpenChange, onSaveMembers, allMembers, currentTeamMembers }: AddTeamMemberDialogProps) {
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Filter members that are NOT already in the current team
  const availableMembers = allMembers.filter(member => !currentTeamMembers.includes(member.id));

  // Reset selection when dialog opens/closes or available members change
  useEffect(() => {
    if (isOpen) {
      setSelectedMembers(new Set()); // Start with empty selection each time dialog opens
    }
  }, [isOpen]);

  const handleMemberToggle = (memberId: string, isChecked: boolean) => {
    setSelectedMembers(prev => {
      const newSelection = new Set(prev);
      if (isChecked) {
        newSelection.add(memberId);
      } else {
        newSelection.delete(memberId);
      }
      return newSelection;
    });
  };

  const handleSave = () => {
    if (selectedMembers.size === 0) {
      toast({
        variant: "default",
        title: "No members selected",
        description: "Select at least one member to add.",
      });
      return;
    }
    onSaveMembers(Array.from(selectedMembers));
    onOpenChange(false); // Close the dialog after saving
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Add Members to Team</DialogTitle>
          <DialogDescription>
            Select members from the project list to add to this team. Already added members are not shown here.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {availableMembers.length === 0 ? (
             <p className="text-sm text-muted-foreground text-center italic py-4">All project members are already in this team, or no members exist in the project.</p>
          ) : (
            <ScrollArea className="h-64 w-full rounded-md border p-4">
              <div className="space-y-2">
                {availableMembers.map(member => (
                  <div key={member.id} className="flex items-center justify-between">
                    <Label htmlFor={`add-member-${member.id}`} className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                      <Checkbox
                        id={`add-member-${member.id}`}
                        checked={selectedMembers.has(member.id)}
                        onCheckedChange={(checked) => handleMemberToggle(member.id, !!checked)}
                        aria-label={`Select ${member.name}`}
                      />
                      {member.name} <span className="text-xs text-muted-foreground">({member.role})</span>
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={availableMembers.length === 0}>
            Add Selected Members ({selectedMembers.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
