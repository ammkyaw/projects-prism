
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Users, CalendarDays } from 'lucide-react'; // Added CalendarDays
import type { Member, HolidayCalendar } from '@/types/sprint-data'; // Import HolidayCalendar
import { predefinedRoles } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface MembersTabProps {
  projectId: string;
  projectName: string;
  initialMembers: Member[];
  onSaveMembers: (members: Member[]) => void;
  holidayCalendars: HolidayCalendar[]; // Add holiday calendars prop
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
  holidayCalendarId: null, // Initialize with no calendar assigned
});

export default function MembersTab({ projectId, projectName, initialMembers, onSaveMembers, holidayCalendars }: MembersTabProps) {
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  // Initialize or update rows based on initialMembers prop
  useEffect(() => {
    setMemberRows(
      initialMembers.map((member, index) => ({
        ...member,
        holidayCalendarId: member.holidayCalendarId ?? null, // Ensure it's null if undefined
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
       // Simple comparison based on stringified representation, sorting for consistency
       const sortMembers = (m: Member[]) => m.slice().sort((a, b) => a.name.localeCompare(b.name));
       const cleanMembers = (m: Member[]): Omit<Member, 'id'>[] =>
           sortMembers(m).map(({ id, ...rest }) => ({
              name: rest.name.trim(),
              role: rest.role.trim(),
              holidayCalendarId: rest.holidayCalendarId || null
           }));

       const originalMembersString = JSON.stringify(cleanMembers(initialMembers));
       const currentMembersString = JSON.stringify(
           cleanMembers(
               memberRows.filter(row => row.name?.trim() || row.role?.trim()) // Filter out completely empty rows before comparing
           )
       );

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

  const handleInputChange = (internalId: string, field: keyof Omit<Member, 'id'>, value: string | null | undefined) => {
    setMemberRows(rows =>
      rows.map(row => (row._internalId === internalId ? { ...row, [field]: value } : row))
    );
  };

  const handleRoleChange = (internalId: string, value: string) => {
     handleInputChange(internalId, 'role', value);
  };

  const handleCalendarChange = (internalId: string, value: string) => {
      handleInputChange(internalId, 'holidayCalendarId', value === 'none' ? null : value);
  };

  const handleSave = () => {
    let hasErrors = false;
    const finalMembers: Member[] = [];
    const memberNames = new Set<string>(); // To check for duplicate names

    memberRows.forEach((row, index) => {
      // Skip completely empty rows silently
      if (!row.name?.trim() && !row.role?.trim()) {
        return;
      }

      const name = row.name.trim();
      const role = row.role.trim();
      const holidayCalendarId = row.holidayCalendarId || null; // Ensure null if empty

      let rowErrors: string[] = [];
      if (!name) rowErrors.push("Name required");
      if (memberNames.has(name.toLowerCase())) rowErrors.push(`Duplicate name "${name}"`);
      if (!role) rowErrors.push("Role required");
      if (!predefinedRoles.includes(role) && role) {
         // Allow custom roles
      }
       if (holidayCalendarId && !holidayCalendars.some(cal => cal.id === holidayCalendarId)) {
          rowErrors.push("Assigned holiday calendar no longer exists.");
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
        holidayCalendarId, // Save assigned calendar ID
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
            <CardDescription>Add or edit team members, their roles, and assign holiday calendars.</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
            Save Members
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Updated Table Header */}
        <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_40px] gap-x-3 items-center pb-2 border-b">
          <Label className="text-xs font-medium text-muted-foreground">Name*</Label>
          <Label className="text-xs font-medium text-muted-foreground">Role*</Label>
          <Label className="text-xs font-medium text-muted-foreground"><CalendarDays className="inline h-3 w-3 mr-1" />Holiday Calendar</Label>
          <div /> {/* Placeholder for delete */}
        </div>

        {/* Member Rows */}
        <div className="space-y-4 md:space-y-2">
          {memberRows.map((row) => (
            <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_40px] gap-x-3 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0">
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
              <div className="md:col-span-1 col-span-1">
                 <Label htmlFor={`role-${row._internalId}`} className="md:hidden text-xs font-medium">Role*</Label>
                  <Select value={row.role} onValueChange={(value) => handleRoleChange(row._internalId, value)}>
                      <SelectTrigger id={`role-${row._internalId}`} className="h-9">
                          <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                          {predefinedRoles.map(option => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
               {/* Holiday Calendar */}
              <div className="md:col-span-1 col-span-1">
                 <Label htmlFor={`calendar-${row._internalId}`} className="md:hidden text-xs font-medium"><CalendarDays className="inline h-3 w-3 mr-1" />Holiday Calendar</Label>
                  <Select
                    value={row.holidayCalendarId ?? 'none'}
                    onValueChange={(value) => handleCalendarChange(row._internalId, value)}
                    disabled={holidayCalendars.length === 0}
                    >
                      <SelectTrigger id={`calendar-${row._internalId}`} className="h-9">
                          <SelectValue placeholder="Select Calendar" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="none" className="text-muted-foreground">-- None --</SelectItem>
                          {holidayCalendars.map(cal => (
                              <SelectItem key={cal.id} value={cal.id}>{cal.name}</SelectItem>
                          ))}
                           {holidayCalendars.length === 0 && <SelectItem value="no-calendars" disabled>No calendars created</SelectItem>}
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
