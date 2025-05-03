
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Users } from 'lucide-react';
import type { Member } from '@/types/sprint-data';
import { predefinedRoles } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MembersTabProps {
  projectId: string;
  projectName: string;
  initialMembers: Member[];
  onSaveMembers: (members: Member[]) => void;
}

// Internal state structure for editing rows
interface MemberRow extends Member {
  _internalId: string; // For React key management
}

const createEmptyMemberRow = (): MemberRow => ({
  _internalId: `member_${Date.now()}_${Math.random()}`,
  id: '', // Will be assigned based on internal ID or existing ID
  name: '',
  role: '',
});

export default function MembersTab({ projectId, projectName, initialMembers, onSaveMembers }: MembersTabProps) {
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  // Initialize or update rows based on initialMembers prop
  useEffect(() => {
    setMemberRows(
      initialMembers.map((member, index) => ({
        ...member,
        _internalId: member.id || `initial_${index}_${Date.now()}`,
      }))
    );
     // Add one empty row if no members exist initially
     if (initialMembers.length === 0) {
        setMemberRows([createEmptyMemberRow()]);
     }
     setHasUnsavedChanges(false); // Reset unsaved changes on initial load or project change
  }, [initialMembers, projectId]); // Rerun when initialMembers or projectId changes

  // Track unsaved changes
   useEffect(() => {
       // Simple comparison based on stringified representation
       const originalMembersString = JSON.stringify(initialMembers.map(({ id, ...rest }) => ({ name: rest.name, role: rest.role })).sort((a,b) => a.name.localeCompare(b.name))); // Sort for consistent comparison
       const currentMembersString = JSON.stringify(memberRows.map(({ _internalId, id, ...rest }) => ({ name: rest.name, role: rest.role }))
           .filter(row => row.name || row.role) // Filter out completely empty rows
           .sort((a,b) => a.name.localeCompare(b.name))); // Sort for consistent comparison

       setHasUnsavedChanges(originalMembersString !== currentMembersString);
   }, [memberRows, initialMembers]);


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

  const handleInputChange = (internalId: string, field: keyof Omit<Member, 'id'>, value: string) => {
    setMemberRows(rows =>
      rows.map(row => (row._internalId === internalId ? { ...row, [field]: value } : row))
    );
  };

  const handleRoleChange = (internalId: string, value: string) => {
     handleInputChange(internalId, 'role', value);
  };

  const handleSave = () => {
    let hasErrors = false;
    const finalMembers: Member[] = [];
    const memberNames = new Set<string>(); // To check for duplicate names

    memberRows.forEach((row, index) => {
      // Skip completely empty rows silently
      if (!row.name && !row.role) {
        return;
      }

      const name = row.name.trim();
      const role = row.role.trim();

      let rowErrors: string[] = [];
      if (!name) rowErrors.push("Name required");
      if (memberNames.has(name.toLowerCase())) rowErrors.push(`Duplicate name "${name}"`);
      if (!role) rowErrors.push("Role required");
      if (!predefinedRoles.includes(role) && role) { // Check if the role is valid (and not empty)
         // Allow custom roles, but maybe warn? For now, accept any non-empty string.
         // rowErrors.push("Invalid Role selected");
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

       memberNames.add(name.toLowerCase()); // Add valid name to set

      finalMembers.push({
        id: row.id || row._internalId, // Preserve existing ID or use internal one
        name,
        role,
      });
    });

    if (hasErrors) {
      return;
    }

    // Sort members alphabetically by name before saving
    finalMembers.sort((a, b) => a.name.localeCompare(b.name));

    onSaveMembers(finalMembers);
    setHasUnsavedChanges(false); // Reset unsaved changes flag after successful save
     // Update rows state to reflect potentially resorted order and ensure IDs are consistent
     setMemberRows(finalMembers.map((member, index) => ({
        ...member,
        _internalId: member.id || `saved_${index}_${Date.now()}` // Use saved ID or generate new internal ID
     })));
     if (finalMembers.length === 0) {
        setMemberRows([createEmptyMemberRow()]); // Ensure one empty row if saved members are empty
     }

  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Project Members: {projectName}</CardTitle>
            <CardDescription>Add or edit team members and their roles for this project.</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
            Save Members
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Table Header for larger screens */}
        <div className="hidden md:grid grid-cols-[1fr_1fr_40px] gap-x-3 items-center pb-2 border-b">
          <Label className="text-xs font-medium text-muted-foreground">Name*</Label>
          <Label className="text-xs font-medium text-muted-foreground">Role*</Label>
          <div /> {/* Placeholder for delete */}
        </div>

        {/* Member Rows */}
        <div className="space-y-4 md:space-y-2">
          {memberRows.map((row) => (
            <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[1fr_1fr_40px] gap-x-3 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0">
              {/* Name */}
              <div className="md:col-span-1 col-span-2">
                <Label htmlFor={`name-${row._internalId}`} className="md:hidden text-xs font-medium">Name*</Label>
                <Input
                  id={`name-${row._internalId}`}
                  value={row.name}
                  onChange={e => handleInputChange(row._internalId, 'name', e.target.value)}
                  placeholder="Member Name"
                  className="h-9"
                />
              </div>
              {/* Role */}
              <div className="md:col-span-1 col-span-2">
                 <Label htmlFor={`role-${row._internalId}`} className="md:hidden text-xs font-medium">Role*</Label>
                  <Select value={row.role} onValueChange={(value) => handleRoleChange(row._internalId, value)}>
                      <SelectTrigger id={`role-${row._internalId}`} className="h-9">
                          <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                          {predefinedRoles.map(option => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                          {/* Optional: Allow custom roles?
                          {row.role && !predefinedRoles.includes(row.role) && (
                            <SelectItem value={row.role} disabled>Custom: {row.role}</SelectItem>
                          )} */}
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
          Add Member
        </Button>
      </CardContent>
      <CardFooter className="flex justify-between items-center border-t pt-4">
        <p className="text-xs text-muted-foreground">* Required field.</p>
        <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
          Save Members
        </Button>
      </CardFooter>
    </Card>
  );
}
