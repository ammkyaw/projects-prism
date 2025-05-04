"use client";

import type { ChangeEvent } from 'react';
import React, { useState, useEffect } from 'react'; // Import React
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Users } from 'lucide-react';
import type { Member } from '@/types/sprint-data';
import { predefinedRoles } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AddMembersDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveMembers: (members: Member[]) => void;
  existingMembers: Member[]; // Pass existing members if editing, usually empty for new project
  projectId: string | null; // To associate members with the project
}

// Internal state structure for editing rows
interface MemberRow extends Partial<Member> { // Allow partial for easier empty row creation
  _internalId: string; // For React key management
  name?: string;
  role?: string;
}

const createEmptyMemberRow = (): MemberRow => ({
  _internalId: `dialog_member_${Date.now()}_${Math.random()}`,
  name: '',
  role: '',
});

function AddMembersDialog({ isOpen, onOpenChange, onSaveMembers, existingMembers, projectId }: AddMembersDialogProps) {
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const { toast } = useToast();

  // Initialize rows when dialog opens or existing members change
  useEffect(() => {
    if (isOpen) {
        // If editing existing members, map them; otherwise, start with one empty row.
        const initialRows = existingMembers.length > 0
            ? existingMembers.map((member, index) => ({
                  ...member,
                  _internalId: member.id || `initial_dialog_${index}_${Date.now()}`,
              }))
            : [createEmptyMemberRow()];
        setMemberRows(initialRows);
    } else {
        // Reset when dialog closes
        // setMemberRows([]); // Keep state to avoid data loss if re-opened quickly after toast dismissal
    }
  }, [isOpen, existingMembers]);


  const handleAddRow = () => {
    setMemberRows(prev => [...prev, createEmptyMemberRow()]);
  };

  const handleRemoveRow = (internalId: string) => {
    setMemberRows(prevRows => {
        const newRows = prevRows.filter(row => row._internalId !== internalId);
        // Keep at least one empty row if all are removed
        return newRows.length > 0 ? newRows : [createEmptyMemberRow()];
    });
  };

  const handleInputChange = (internalId: string, field: 'name' | 'role', value: string) => {
    setMemberRows(rows =>
      rows.map(row => (row._internalId === internalId ? { ...row, [field]: value } : row))
    );
  };

   const handleRoleChange = (internalId: string, value: string) => {
     handleInputChange(internalId, 'role', value);
  };

  const handleSave = () => {
    if (!projectId) {
        toast({ variant: "destructive", title: "Error", description: "Cannot save members without a project ID." });
        return;
    }

    let hasErrors = false;
    const finalMembers: Member[] = [];
    const memberNames = new Set<string>(); // To check for duplicate names

    memberRows.forEach((row, index) => {
      // Skip completely empty rows silently
      if (!row.name?.trim() && !row.role?.trim()) {
        return;
      }

      const name = row.name?.trim();
      const role = row.role?.trim();

      let rowErrors: string[] = [];
      if (!name) rowErrors.push("Name required");
      if (name && memberNames.has(name.toLowerCase())) rowErrors.push(`Duplicate name "${name}"`);
      if (!role) rowErrors.push("Role required");
      if (!predefinedRoles.includes(role || '') && role) {
        // Allow custom roles for now
      }


      if (rowErrors.length > 0) {
        toast({
          variant: "destructive",
          title: `Error in Member Row ${index + 1}`,
          description: rowErrors.join(', ')
        });
        hasErrors = true;
        return; // Stop processing this row
      }

      if (name) memberNames.add(name.toLowerCase()); // Add valid name to set

      finalMembers.push({
        id: row.id || row._internalId, // Preserve existing ID or use internal one
        name: name || '', // Ensure name is string
        role: role || '', // Ensure role is string
      });
    });

    if (hasErrors) {
      return;
    }

    // Sort members alphabetically by name before saving
    finalMembers.sort((a, b) => a.name.localeCompare(b.name));

    onSaveMembers(finalMembers);
    // Dialog closing is handled by the parent via onOpenChange(false) in the save handler
  };

  const handleSkip = () => {
     onOpenChange(false); // Just close the dialog
  }

  return (
     <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Add Team Members (Optional)</DialogTitle>
                <DialogDescription>
                    Optionally add members to this project now. You can also add or edit them later in the 'Members' tab.
                </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] overflow-y-auto py-4 px-1 space-y-4">
               {/* Table Header for larger screens */}
               <div className="hidden md:grid grid-cols-[1fr_1fr_40px] gap-x-3 items-center pb-2 border-b sticky top-0 bg-background z-10">
                   <Label className="text-xs font-medium text-muted-foreground">Name*</Label>
                   <Label className="text-xs font-medium text-muted-foreground">Role*</Label>
                   <div /> {/* Placeholder for delete */}
               </div>

               {/* Member Rows */}
               <div className="space-y-4 md:space-y-2">
                   {memberRows.map((row) => (
                       <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[1fr_1fr_40px] gap-x-3 gap-y-2 items-start">
                           {/* Name */}
                           <div className="md:col-span-1 col-span-2">
                               <Label htmlFor={`dialog-name-${row._internalId}`} className="md:hidden text-xs font-medium">Name*</Label>
                               <Input
                                   id={`dialog-name-${row._internalId}`}
                                   value={row.name ?? ''} // Handle potential undefined value
                                   onChange={e => handleInputChange(row._internalId, 'name', e.target.value)}
                                   placeholder="Member Name"
                                   className="h-9"
                               />
                           </div>
                           {/* Role */}
                           <div className="md:col-span-1 col-span-2">
                                <Label htmlFor={`dialog-role-${row._internalId}`} className="md:hidden text-xs font-medium">Role*</Label>
                                <Select value={row.role ?? ''} onValueChange={(value) => handleRoleChange(row._internalId, value)}> {/* Handle potential undefined value */}
                                    <SelectTrigger id={`dialog-role-${row._internalId}`} className="h-9">
                                        <SelectValue placeholder="Select Role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {predefinedRoles.map(option => (
                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                           </div>
                           {/* Delete Button */}
                           <div className="flex items-center justify-end md:col-span-1 col-span-2 md:self-center md:mt-0 mt-1">
                               <Button
                                   type="button"
                                   variant="ghost"
                                   size="icon"
                                   onClick={() => handleRemoveRow(row._internalId)}
                                   className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                   aria-label="Remove member row"
                               >
                                   <Trash2 className="h-4 w-4" />
                               </Button>
                           </div>
                       </div>
                   ))}
               </div>
                <Button type="button" onClick={handleAddRow} variant="outline" size="sm" className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Another Member
                </Button>
                <p className="text-xs text-muted-foreground pt-2">* Required field if adding a member.</p>
            </div>

            <DialogFooter className="mt-4">
                 <Button type="button" variant="outline" onClick={handleSkip}>Skip for Now</Button>
                 <Button type="button" onClick={handleSave}>Save Members</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}

// Wrap component with React.memo
export default React.memo(AddMembersDialog);
