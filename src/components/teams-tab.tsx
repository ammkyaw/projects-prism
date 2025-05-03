
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, UsersRound, UserCheck, UserX, UserCog, X } from 'lucide-react'; // Added X icon
import type { Team, TeamMember, Member } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from '@/components/ui/badge'; // Import Badge
import AddTeamMemberDialog from '@/components/add-team-member-dialog'; // Import the new dialog

interface TeamsTabProps {
  projectId: string;
  projectName: string;
  initialTeams: Team[];
  allMembers: Member[]; // List of all available members in the project
  onSaveTeams: (teams: Team[]) => void;
}

interface EditableTeam extends Team {
  _internalId: string; // For React key management
  members: EditableTeamMember[]; // Use editable members
}

interface EditableTeamMember extends TeamMember {
    _internalId: string; // Unique ID for this instance in the UI
}

const createEmptyTeam = (allMembers: Member[]): EditableTeam => ({
  _internalId: `team_${Date.now()}_${Math.random()}`,
  id: '', // Will be assigned on save
  name: 'New Team',
  leadMemberId: null,
  members: [], // Start with no members selected
});

// Helper to create an editable team member row (used internally)
const createEditableTeamMember = (memberId: string): EditableTeamMember => ({
    _internalId: `tm_${memberId}_${Date.now()}_${Math.random()}`,
    memberId: memberId,
});


export default function TeamsTab({ projectId, projectName, initialTeams, allMembers, onSaveTeams }: TeamsTabProps) {
  const [teams, setTeams] = useState<EditableTeam[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [editingTeamInternalId, setEditingTeamInternalId] = useState<string | null>(null);

  // Initialize or update teams based on initial prop
  useEffect(() => {
    const mappedTeams = initialTeams.map((team, teamIndex) => ({
        ...team,
        _internalId: team.id || `initial_team_${teamIndex}_${Date.now()}`,
        members: (team.members || []).map((tm, memberIndex) => ({
            ...tm,
             _internalId: `initial_tm_${team.id}_${tm.memberId}_${memberIndex}_${Date.now()}`,
        })),
        leadMemberId: team.leadMemberId ?? null,
    }));
    setTeams(mappedTeams);
     if (mappedTeams.length === 0) {
        setTeams([createEmptyTeam(allMembers)]);
     }
     setHasUnsavedChanges(false);
  }, [initialTeams, projectId, allMembers]); // Rerun if these change

  // Track unsaved changes
  useEffect(() => {
       const cleanTeams = (tms: Team[]): Omit<Team, 'id' | 'members'> & { members: Omit<TeamMember, '_internalId'>[] }[] =>
           tms.map(({ id, members, ...rest }) => ({
               ...rest,
               name: rest.name.trim(),
               leadMemberId: rest.leadMemberId || null,
               members: (members || []).map(({ memberId }) => ({ memberId })).sort((a, b) => a.memberId.localeCompare(b.memberId)), // Sort members by ID
           })).sort((a, b) => a.name.localeCompare(b.name)); // Sort teams by name

       const originalTeamsString = JSON.stringify(cleanTeams(initialTeams));
       const currentTeamsString = JSON.stringify(
           cleanTeams(
               teams.filter(team => team.name.trim() || team.members.length > 0 || team.leadMemberId) // Filter empty before comparing
           )
       );
       setHasUnsavedChanges(originalTeamsString !== currentTeamsString);
  }, [teams, initialTeams]);


  const handleAddTeam = () => {
    setTeams(prev => [...prev, createEmptyTeam(allMembers)]);
  };

  const handleRemoveTeam = (internalId: string) => {
    setTeams(prev => {
        const newTeams = prev.filter(team => team._internalId !== internalId);
        return newTeams.length > 0 ? newTeams : [createEmptyTeam(allMembers)];
    });
  };

  const handleTeamInputChange = (internalId: string, field: 'name', value: string) => {
    setTeams(prev =>
      prev.map(team =>
        team._internalId === internalId ? { ...team, [field]: value } : team
      )
    );
  };

   const handleLeadChange = (internalId: string, value: string) => {
     setTeams(prev =>
       prev.map(team =>
         team._internalId === internalId ? { ...team, leadMemberId: value === 'none' ? null : value } : team
       )
     );
   };

  // --- New Handlers for Dialog-based Member Management ---

  const handleAddMemberClick = (teamInternalId: string) => {
      setEditingTeamInternalId(teamInternalId);
      setIsAddMemberDialogOpen(true);
  };

  const handleSaveNewTeamMembers = (newMemberIds: string[]) => {
      if (!editingTeamInternalId) return;

      setTeams(prev =>
          prev.map(team => {
              if (team._internalId === editingTeamInternalId) {
                  const existingMemberIds = new Set(team.members.map(tm => tm.memberId));
                  const membersToAdd = newMemberIds
                      .filter(id => !existingMemberIds.has(id)) // Avoid duplicates
                      .map(id => createEditableTeamMember(id));
                  return { ...team, members: [...team.members, ...membersToAdd] };
              }
              return team;
          })
      );
      setEditingTeamInternalId(null); // Reset editing team
      setIsAddMemberDialogOpen(false); // Close dialog
  };

  const handleRemoveTeamMember = (teamInternalId: string, memberIdToRemove: string) => {
     setTeams(prev =>
         prev.map(team => {
             if (team._internalId === teamInternalId) {
                 const updatedMembers = team.members.filter(tm => tm.memberId !== memberIdToRemove);
                 // If the removed member was the lead, reset the lead
                 if (team.leadMemberId === memberIdToRemove) {
                      toast({ variant: "warning", title: "Lead Removed", description: `Team lead ${allMembers.find(m => m.id === memberIdToRemove)?.name} was removed. Please select a new lead.` });
                      return { ...team, members: updatedMembers, leadMemberId: null };
                 }
                 return { ...team, members: updatedMembers };
             }
             return team;
         })
     );
  };

  // --- End New Handlers ---


  const handleSave = () => {
    let hasErrors = false;
    const finalTeams: Team[] = [];
    const teamNames = new Set<string>();

    teams.forEach((team, teamIndex) => {
      // Skip completely empty teams silently
      if (!team.name.trim() && !team.leadMemberId && team.members.length === 0) {
        return;
      }

      const teamName = team.name.trim();
      const leadMemberId = team.leadMemberId || null;

      if (!teamName) {
        toast({ variant: "destructive", title: `Error in Team ${teamIndex + 1}`, description: "Team name is required." });
        hasErrors = true;
        return;
      }
      if (teamNames.has(teamName.toLowerCase())) {
        toast({ variant: "destructive", title: `Error in Team ${teamIndex + 1}`, description: `Duplicate team name "${teamName}".` });
        hasErrors = true;
        return;
      }
       teamNames.add(teamName.toLowerCase());

      if (leadMemberId && !allMembers.some(m => m.id === leadMemberId)) {
           toast({ variant: "destructive", title: `Error in Team ${teamName}`, description: `Selected lead member no longer exists.` });
           hasErrors = true;
           return;
      }
       // Check if lead is actually a member AFTER potentially removing members
       if (leadMemberId && !team.members.some(tm => tm.memberId === leadMemberId)) {
           toast({ variant: "destructive", title: `Error in Team ${teamName}`, description: `Selected lead must be a member of the team.` });
           hasErrors = true;
           return;
       }


      const finalTeamMembers: TeamMember[] = team.members.map(tm => ({ memberId: tm.memberId }));

      // Sort members alphabetically by memberId before saving (or could sort by name later)
      finalTeamMembers.sort((a, b) => a.memberId.localeCompare(b.memberId));

      finalTeams.push({
        id: team.id || team._internalId, // Preserve existing ID or use internal one
        name: teamName,
        leadMemberId: leadMemberId,
        members: finalTeamMembers,
      });
    });

    if (hasErrors) {
      return;
    }

    // Sort teams alphabetically by name before saving
    finalTeams.sort((a, b) => a.name.localeCompare(b.name));

    onSaveTeams(finalTeams);
    setHasUnsavedChanges(false);
    // Update state to reflect sorted/cleaned data with potentially new IDs
     setTeams(finalTeams.map((team, teamIndex) => ({
        ...team,
        _internalId: team.id || `saved_team_${teamIndex}_${Date.now()}`,
        members: team.members.map((tm, memberIndex) => ({
           ...tm,
           _internalId: `saved_tm_${team.id}_${tm.memberId}_${memberIndex}_${Date.now()}`,
        })),
    })));
     if (finalTeams.length === 0) {
        setTeams([createEmptyTeam(allMembers)]); // Ensure one empty team if all were deleted/empty
     }
  };

   const getMemberName = (memberId: string): string => {
       return allMembers.find(m => m.id === memberId)?.name ?? 'Unknown Member';
   };

   // Find the team being edited for the dialog
   const teamBeingEdited = teams.find(t => t._internalId === editingTeamInternalId);

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" /> Teams: {projectName}</CardTitle>
            <CardDescription>Define teams within this project, assign members, and designate team leads.</CardDescription>
          </div>
           <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
             Save Teams
           </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Accordion type="multiple" className="w-full space-y-4" defaultValue={teams.map(t => t._internalId)}>
          {teams.map((team) => (
            <AccordionItem value={team._internalId} key={team._internalId} className="border rounded-lg bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b">
                 <div className="flex items-center gap-2 flex-1 min-w-0">
                     <Input
                        value={team.name}
                        onChange={(e) => handleTeamInputChange(team._internalId, 'name', e.target.value)}
                        placeholder="Team Name (e.g., Frontend Devs)"
                        className="h-8 text-base font-medium flex-1 mr-2 border-0 shadow-none focus-visible:ring-0 focus:bg-muted/50"
                        required
                     />
                       <Select value={team.leadMemberId ?? 'none'} onValueChange={(value) => handleLeadChange(team._internalId, value)}>
                           <SelectTrigger
                               className="h-8 w-48 text-sm border-0 shadow-none focus-visible:ring-0 focus:bg-muted/50"
                           >
                                <UserCog className="mr-2 h-4 w-4 text-muted-foreground" />
                               <SelectValue placeholder="Select Lead (Optional)" />
                           </SelectTrigger>
                           <SelectContent>
                               <SelectGroup>
                                   <SelectLabel>Team Lead</SelectLabel>
                                   <SelectItem value="none" className="text-muted-foreground">-- None --</SelectItem>
                                   {/* Only show members *currently in the team* as potential leads */}
                                   {allMembers
                                     .filter(m => team.members.some(tm => tm.memberId === m.id))
                                     .map(member => (
                                       <SelectItem key={member.id} value={member.id}>
                                           {member.name} ({member.role})
                                       </SelectItem>
                                   ))}
                                    {team.members.length === 0 && <SelectItem value="no-members" disabled>Add members first</SelectItem>}
                               </SelectGroup>
                           </SelectContent>
                       </Select>
                 </div>
                 <div className="flex items-center gap-2">
                     <AccordionTrigger className="p-2" aria-label={`Toggle ${team.name}`}>
                         {/* Icon moved inside trigger, or remove chevron if header click isn't needed */}
                     </AccordionTrigger>
                     <Button
                         type="button"
                         variant="ghost"
                         size="icon"
                         onClick={() => handleRemoveTeam(team._internalId)}
                         className="h-8 w-8 text-muted-foreground hover:text-destructive"
                         aria-label="Remove team"
                     >
                         <Trash2 className="h-4 w-4" />
                     </Button>
                 </div>
              </div>

              <AccordionContent className="px-4 pt-4 pb-2">
                 <div className="flex justify-between items-center mb-2">
                     <Label className="text-base font-semibold">Team Members</Label>
                     <Button variant="outline" size="sm" onClick={() => handleAddMemberClick(team._internalId)}>
                         <PlusCircle className="mr-2 h-4 w-4" /> Add Members
                     </Button>
                 </div>

                  {allMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-4 text-center">No members added to the project yet. Add members in the 'Members' tab first.</p>
                  ) : team.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-4 text-center">No members added to this team yet.</p>
                  ) : (
                     <div className="space-y-1 mt-2">
                        {team.members.map((teamMember) => (
                           <div key={teamMember._internalId} className="flex items-center justify-between p-2 border rounded-md bg-secondary/50">
                               <span className="text-sm">{getMemberName(teamMember.memberId)}</span>
                               <Button
                                   type="button"
                                   variant="ghost"
                                   size="icon"
                                   onClick={() => handleRemoveTeamMember(team._internalId, teamMember.memberId)}
                                   className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                   aria-label={`Remove ${getMemberName(teamMember.memberId)} from team`}
                               >
                                   <X className="h-4 w-4" />
                               </Button>
                           </div>
                        ))}
                     </div>
                  )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <Button type="button" onClick={handleAddTeam} variant="outline" size="sm" className="mt-4">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Team
        </Button>
      </CardContent>
       <CardFooter className="flex justify-between items-center border-t pt-4">
        <p className="text-xs text-muted-foreground">* Required field: Team Name.</p>
        <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
          Save Teams
        </Button>
      </CardFooter>
    </Card>

    {/* Add Member Dialog */}
     <AddTeamMemberDialog
        isOpen={isAddMemberDialogOpen}
        onOpenChange={setIsAddMemberDialogOpen}
        onSaveMembers={handleSaveNewTeamMembers}
        allMembers={allMembers}
        currentTeamMembers={teamBeingEdited?.members.map(tm => tm.memberId) ?? []} // Pass IDs of members already in the team
     />
    </>
  );
}

