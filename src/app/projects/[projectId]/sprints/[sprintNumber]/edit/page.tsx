
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Use Next.js navigation hooks
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Trash2, ArrowLeft } from 'lucide-react';
import type { Sprint, SprintDetailItem, AppData, Project, Member } from '@/types/sprint-data'; // Import Member
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from 'next/link'; // Import Link for back navigation

// Internal state structure for editing rows
interface DetailRow extends SprintDetailItem {
  _internalId: string; // For React key management
}

const createEmptyDetailRow = (): DetailRow => ({
    _internalId: `temp_${Date.now()}_${Math.random()}`,
    id: '', // Will be assigned on save if needed, or use _internalId
    ticketNumber: '',
    developer: '', // Keep as string, will store member name
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

  const [project, setProject] = useState<Project | null>(null);
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [members, setMembers] = useState<Member[]>([]); // State for project members

  // Load project data and find the specific sprint
  useEffect(() => {
    if (!projectId || isNaN(sprintNumber)) {
        toast({ variant: "destructive", title: "Error", description: "Invalid project or sprint ID." });
        router.push('/'); // Redirect to home if IDs are invalid
        return;
    }

    const savedData = localStorage.getItem('appData');
    if (savedData) {
      try {
        const allProjects: AppData = JSON.parse(savedData);
        const currentProject = allProjects.find(p => p.id === projectId);

        if (currentProject) {
          setProject(currentProject);
          setMembers(currentProject.members || []); // Load members
          const currentSprint = currentProject.sprintData.sprints.find(s => s.sprintNumber === sprintNumber);

          if (currentSprint) {
             // Check if sprint is completed
             if (currentSprint.status === 'Completed') {
                 toast({
                     variant: "default",
                     title: "Sprint Completed",
                     description: `Sprint ${sprintNumber} is completed and cannot be edited.`
                 });
                 router.push('/'); // Redirect if completed
                 return;
             }

            setSprint(currentSprint);
            // Initialize detail rows from the loaded sprint
            setDetailRows(
              (currentSprint.details || []).map((item, index) => ({
                ...item,
                developer: item.developer ?? '', // Ensure developer is string
                _internalId: item.id || `initial_${index}_${Date.now()}`,
              }))
            );
            if (!currentSprint.details || currentSprint.details.length === 0) {
               setDetailRows([createEmptyDetailRow()]); // Add one empty row if none exist
            }
          } else {
            toast({ variant: "destructive", title: "Error", description: `Sprint ${sprintNumber} not found in project ${currentProject.name}.` });
            router.push('/');
          }
        } else {
          toast({ variant: "destructive", title: "Error", description: "Project not found." });
          router.push('/');
        }
      } catch (error) {
        console.error("Failed to load data:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load project data." });
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    } else {
      toast({ variant: "destructive", title: "Error", description: "No project data found." });
      router.push('/');
      setIsLoading(false);
    }
  }, [projectId, sprintNumber, router, toast]);

  // Track unsaved changes
  useEffect(() => {
    if (!isLoading && sprint) { // Only track after initial load
       const originalDetailsString = JSON.stringify(sprint.details || []);
       const currentDetailsString = JSON.stringify(detailRows.map(({ _internalId, ...rest }) => ({
            // Exclude internal ID and ensure types match for comparison
            id: rest.id,
            ticketNumber: rest.ticketNumber?.trim() ?? '',
            developer: rest.developer?.trim() ?? '',
            storyPoints: Number(rest.storyPoints ?? 0),
            devTime: rest.devTime?.trim() ?? '',
       }))
          .filter(row => row.ticketNumber || row.developer || row.storyPoints || row.devTime)); // Filter out completely empty rows before comparing

       setHasUnsavedChanges(originalDetailsString !== currentDetailsString);
    }
  }, [detailRows, sprint, isLoading]);


  const handleAddDetailRow = () => {
    setDetailRows([...detailRows, createEmptyDetailRow()]);
  };

  const handleRemoveDetailRow = (internalId: string) => {
    setDetailRows(prevRows => {
        const newRows = prevRows.filter(row => row._internalId !== internalId);
        // Keep at least one empty row if all are removed
        return newRows.length > 0 ? newRows : [createEmptyDetailRow()];
    });
  };

  const handleDetailInputChange = (
    internalId: string,
    field: keyof Omit<SprintDetailItem, 'id'>,
    value: string | number | undefined
  ) => {
    setDetailRows(rows =>
      rows.map(row =>
        row._internalId === internalId ? { ...row, [field]: value ?? '' } : row // Set to empty string if value is undefined/null
      )
    );
  };

   const handleDeveloperChange = (internalId: string, value: string) => {
     handleDetailInputChange(internalId, 'developer', value === 'unassigned' ? undefined : value); // Set undefined if 'unassigned'
  };

  const handleSaveDetails = () => {
    if (!project || !sprint || sprint.status === 'Completed') {
        toast({ variant: "destructive", title: "Error", description: "Cannot save details for a completed sprint or if project/sprint is missing." });
        return;
    }

    let hasErrors = false;
    const finalDetails: SprintDetailItem[] = [];

    detailRows.forEach((row, index) => {
        // Skip completely empty rows silently on save
        if (!row.ticketNumber && !row.developer && !row.storyPoints && !row.devTime) {
            return;
        }

        const ticketNumber = row.ticketNumber.trim();
        const developer = row.developer.trim(); // This is the member's name
        const storyPoints = Number(row.storyPoints); // Ensure it's a number
        const devTime = row.devTime.trim();

        let rowErrors: string[] = [];
        if (!ticketNumber) rowErrors.push("Ticket # required");
        if (!developer) rowErrors.push("Developer required");
        if (isNaN(storyPoints) || storyPoints < 0) rowErrors.push("Invalid Story Points");
        if (!devTime) rowErrors.push("Dev Time required"); // Basic validation

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
            id: row.id || `detail_${sprint.sprintNumber}_${Date.now()}_${index}`, // Ensure a unique ID if new
            ticketNumber,
            developer,
            storyPoints,
            devTime,
        });
    });

    if (hasErrors) {
        return;
    }

    // Update the sprint details in the project
    const updatedSprint = { ...sprint, details: finalDetails };
    const updatedSprints = project.sprintData.sprints.map(s =>
        s.sprintNumber === sprintNumber ? updatedSprint : s
    );
    const updatedProjectData = {
        ...project.sprintData,
        sprints: updatedSprints,
    };
    const updatedProject = { ...project, sprintData: updatedProjectData };

    // Update the projects array in localStorage
    const savedData = localStorage.getItem('appData');
    if (savedData) {
        try {
            const allProjects: AppData = JSON.parse(savedData);
            const updatedProjects = allProjects.map(p => p.id === projectId ? updatedProject : p);
            localStorage.setItem('appData', JSON.stringify(updatedProjects));

            // Update local state to reflect saved changes
            setProject(updatedProject);
            setSprint(updatedSprint);
            // Re-initialize rows from the newly saved sprint data to get consistent IDs
            setDetailRows(
              (updatedSprint.details || []).map((item, index) => ({
                ...item,
                 developer: item.developer ?? '',
                _internalId: item.id || `saved_${index}_${Date.now()}`, // Use saved ID or generate new internal ID
              }))
            );
             if ((updatedSprint.details || []).length === 0) {
               setDetailRows([createEmptyDetailRow()]); // Ensure one empty row if saved details are empty
             }


            toast({ title: "Details Saved", description: `Details for Sprint ${sprintNumber} saved successfully.` });
            setHasUnsavedChanges(false); // Reset unsaved changes flag
        } catch (error) {
            console.error("Failed to save data:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save sprint details." });
        }
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading sprint details...</div>;
  }

  if (!project || !sprint) {
     return <div className="flex justify-center items-center min-h-screen">Error loading data. Please go back.</div>;
  }


  return (
    <div className="container mx-auto p-6">
       <Card>
          <CardHeader>
             <div className="flex justify-between items-center">
               <div>
                  <Link href="/" passHref legacyBehavior>
                     <Button variant="outline" size="sm" className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project Home
                     </Button>
                  </Link>
                  <CardTitle>Edit Details for Sprint {sprint.sprintNumber} ({sprint.status})</CardTitle>
                  <CardDescription>Project: {project.name}</CardDescription>
               </div>
               <Button onClick={handleSaveDetails} disabled={!hasUnsavedChanges || sprint.status === 'Completed'}>
                 Save Details
               </Button>
             </div>
             <CardDescription className="pt-2">
               {sprint.status === 'Completed'
                 ? 'This sprint is completed and read-only.'
                 : 'Add or modify ticket information for this sprint. Click \'Save Details\' when finished.'}
             </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
             {/* Table Header for larger screens */}
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
                   <div key={row._internalId} className="grid grid-cols-2 md:grid-cols-[1fr_1fr_100px_100px_40px] gap-x-3 gap-y-2 items-start border-b md:border-none pb-4 md:pb-0 last:border-b-0">
                      {/* Ticket Number */}
                      <div className="md:col-span-1 col-span-2">
                         <Label htmlFor={`ticket-${row._internalId}`} className="md:hidden text-xs font-medium">Ticket #*</Label>
                         <Input
                            id={`ticket-${row._internalId}`}
                            value={row.ticketNumber}
                            onChange={e => handleDetailInputChange(row._internalId, 'ticketNumber', e.target.value)}
                            placeholder="JIRA-123"
                            className="h-9"
                            disabled={sprint.status === 'Completed'}
                         />
                      </div>
                      {/* Developer (Assignee) Dropdown */}
                      <div className="md:col-span-1 col-span-2">
                         <Label htmlFor={`developer-${row._internalId}`} className="md:hidden text-xs font-medium">Developer*</Label>
                           <Select
                               value={row.developer ?? ''} // Use name as value
                               onValueChange={(value) => handleDeveloperChange(row._internalId, value)}
                               disabled={sprint.status === 'Completed'}
                           >
                               <SelectTrigger id={`developer-${row._internalId}`} className="h-9">
                                   <SelectValue placeholder="Select Developer" />
                               </SelectTrigger>
                               <SelectContent>
                                   <SelectItem value="unassigned" className="text-muted-foreground">-- Unassigned --</SelectItem>
                                   {members.map(member => (
                                       <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>
                                   ))}
                                   {members.length === 0 && <SelectItem value="no-members" disabled>No members in project</SelectItem>}
                               </SelectContent>
                           </Select>
                      </div>
                      {/* Story Points */}
                      <div className="md:col-span-1 col-span-1">
                         <Label htmlFor={`sp-${row._internalId}`} className="md:hidden text-xs font-medium">Story Pts*</Label>
                         <Input
                            id={`sp-${row._internalId}`}
                            type="number"
                            value={row.storyPoints}
                            onChange={e => handleDetailInputChange(row._internalId, 'storyPoints', Number(e.target.value))}
                            placeholder="Pts"
                            className="h-9 text-right"
                            min="0"
                            disabled={sprint.status === 'Completed'}
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
                            disabled={sprint.status === 'Completed'}
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
                            disabled={sprint.status === 'Completed'}
                         >
                            <Trash2 className="h-4 w-4" />
                         </Button>
                      </div>
                   </div>
                ))}
             </div>
             <Button type="button" onClick={handleAddDetailRow} variant="outline" size="sm" className="mt-4" disabled={sprint.status === 'Completed'}>
               <PlusCircle className="mr-2 h-4 w-4" />
               Add Detail Row
             </Button>

          </CardContent>
          <CardFooter className="flex justify-between items-center border-t pt-4">
            <p className="text-xs text-muted-foreground">* Required field.</p>
            <Button onClick={handleSaveDetails} disabled={!hasUnsavedChanges || sprint.status === 'Completed'}>
              Save Details
            </Button>
          </CardFooter>
       </Card>
    </div>
  );
}
