

"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, HomeIcon, BarChart, ListPlus, PlusCircle, NotebookPen, Users } from 'lucide-react'; // Added Users for Members, NotebookPen for Planning
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import HomeTab from '@/components/home-tab';
import EntryTab from '@/components/entry-tab';
import ReportsTab from '@/components/reports-tab';
import PlanningTab from '@/components/planning-tab';
import MembersTab from '@/components/members-tab'; // Import MembersTab
import AddMembersDialog from '@/components/add-members-dialog'; // Import AddMembersDialog


import type { SprintData, Sprint, AppData, Project, SprintDetailItem, SprintPlanning, Member } from '@/types/sprint-data';
import { initialSprintData, initialSprintPlanning } from '@/types/sprint-data'; // Import initialSprintData and initialSprintPlanning
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addDays, format, parseISO } from 'date-fns';

// Helper function (remains the same)
const calculateSprintMetrics = (startDateStr: string, duration: string): { totalDays: number, endDate: string } => {
    let totalDays = 0;
    let calendarDaysToAdd = 0;

    switch (duration) {
        case "1 Week": totalDays = 5; calendarDaysToAdd = 6; break;
        case "2 Weeks": totalDays = 10; calendarDaysToAdd = 13; break;
        case "3 Weeks": totalDays = 15; calendarDaysToAdd = 20; break;
        case "4 Weeks": totalDays = 20; calendarDaysToAdd = 27; break;
        default: return { totalDays: 0, endDate: 'N/A' };
    }

    if (!startDateStr) return { totalDays: 0, endDate: 'N/A' };

    try {
        const startDate = parseISO(startDateStr);
        const endDate = addDays(startDate, calendarDaysToAdd);
        return { totalDays, endDate: format(endDate, 'yyyy-MM-dd') };
    } catch (e) {
        console.error("Error calculating end date:", e);
        return { totalDays: 0, endDate: 'N/A' };
    }
};


export default function Home() {
  const [projects, setProjects] = useState<AppData>([]); // State for all projects
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("home");
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState<boolean>(false);
  const [isAddMembersDialogOpen, setIsAddMembersDialogOpen] = useState<boolean>(false); // State for Add Members dialog
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<string | null>(null); // Track ID for Add Members dialog
  const { toast } = useToast();
  const [resetManualFormKey, setResetManualFormKey] = useState(0); // State to trigger form reset

  // Effect to load data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('appData');
    if (savedData) {
      try {
        const parsedData: AppData = JSON.parse(savedData);
        // Basic validation for the new structure including members
        if (Array.isArray(parsedData) && parsedData.every(p => p.id && p.name && p.sprintData && Array.isArray(p.sprintData.sprints) && Array.isArray(p.members))) {
           // Ensure details, planning arrays, and members exist on loaded sprints/projects
           const validatedData = parsedData.map(project => ({
              ...project,
              sprintData: {
                 ...project.sprintData,
                 sprints: project.sprintData.sprints.map(sprint => ({
                    ...sprint,
                    details: sprint.details ?? [], // Ensure details array exists
                    planning: sprint.planning ?? initialSprintPlanning, // Ensure planning object exists
                 })),
              },
              members: project.members ?? [], // Ensure members array exists
           }));
          setProjects(validatedData);
          setSelectedProjectId(validatedData.length > 0 ? validatedData[0].id : null);
        } else {
          console.warn("Invalid or outdated data found in localStorage.");
          localStorage.removeItem('appData'); // Clear invalid data
          setProjects([]);
          setSelectedProjectId(null);
        }
      } catch (error) {
        console.error("Failed to parse project data from localStorage:", error);
        localStorage.removeItem('appData'); // Clear corrupted data
        setProjects([]);
        setSelectedProjectId(null);
      }
    }
  }, []);

  // Effect to save data to localStorage whenever projects change
  useEffect(() => {
    if (projects && projects.length > 0) {
      try {
        const dataToSave = JSON.stringify(projects);
        localStorage.setItem('appData', dataToSave);
      } catch (error) {
         console.error("Failed to save project data to localStorage:", error);
         toast({
           variant: "destructive",
           title: "Save Error",
           description: "Could not save project data locally. Data might be too large or storage is unavailable.",
         });
      }
    } else if (projects?.length === 0) {
       localStorage.removeItem('appData');
    }
  }, [projects, toast]);

  // Find the currently selected project object
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) ?? null;
  }, [projects, selectedProjectId]);

  // Parser for sprint data (remains largely the same)
  const parseSprintData = (jsonData: any[]): SprintData => {
     const requiredColumns = ['SprintNumber', 'StartDate', 'Duration', 'TotalCommitment', 'TotalDelivered'];
    if (!jsonData || jsonData.length === 0) {
        throw new Error("No data found in the file.");
    }
    const firstRowKeys = Object.keys(jsonData[0]);
    const missingColumns = requiredColumns.filter(col => !firstRowKeys.includes(col));
    if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    const sprints: Sprint[] = [];
    let maxTotalDays = 0;

    jsonData.forEach((row, rowIndex) => {
        const sprintNumber = parseInt(row.SprintNumber, 10);
        let startDateValue = row.StartDate;
        const duration = row.Duration?.toString().trim();
        const commitment = parseInt(row.TotalCommitment, 10);
        const delivered = parseInt(row.TotalDelivered, 10);

        if (isNaN(sprintNumber) || !startDateValue || !duration || isNaN(commitment) || isNaN(delivered)) {
            console.warn(`Skipping invalid row ${rowIndex + 2}: Missing essential data.`, row);
            return;
        }
         const validDurations = ["1 Week", "2 Weeks", "3 Weeks", "4 Weeks"];
         if (!validDurations.includes(duration)) {
            console.warn(`Skipping row ${rowIndex + 2}: Invalid duration value "${duration}". Expected one of: ${validDurations.join(', ')}.`);
            return;
         }

         let startDateStr: string;
         if (typeof startDateValue === 'number') {
             if (startDateValue > 0) {
                 try {
                     const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                     const date = new Date(excelEpoch.getTime() + startDateValue * 86400000);
                     startDateStr = date.toISOString().split('T')[0];
                 } catch (e) {
                     console.warn(`Skipping row ${rowIndex + 2}: Invalid date format for value ${startDateValue}.`);
                     return;
                 }
             } else {
                 console.warn(`Skipping row ${rowIndex + 2}: Invalid Excel date number ${startDateValue}.`);
                 return;
             }
         } else if (typeof startDateValue === 'string') {
             const potentialDate = new Date(startDateValue);
             if (!isNaN(potentialDate.getTime())) {
                 if (potentialDate.getFullYear() > 1900 && potentialDate.toISOString().includes('-')) {
                    startDateStr = potentialDate.toISOString().split('T')[0];
                 } else {
                     console.warn(`Skipping row ${rowIndex + 2}: Invalid date string format ${startDateValue}. Expected YYYY-MM-DD.`);
                    return;
                 }
             } else {
                 console.warn(`Skipping row ${rowIndex + 2}: Invalid date string format ${startDateValue}. Expected YYYY-MM-DD.`);
                 return;
             }
         } else {
             console.warn(`Skipping row ${rowIndex + 2}: Unrecognized date type ${typeof startDateValue}.`);
             return;
         }

          const { totalDays, endDate } = calculateSprintMetrics(startDateStr, duration);
         if (totalDays <= 0 || endDate === 'N/A') {
             console.warn(`Skipping row ${rowIndex + 2}: Could not calculate metrics for start date ${startDateStr} and duration ${duration}.`);
             return;
         }

         if (totalDays > maxTotalDays) {
             maxTotalDays = totalDays;
         }

        sprints.push({
            sprintNumber,
            startDate: startDateStr,
            endDate,
            duration,
            committedPoints: commitment,
            completedPoints: delivered,
            details: [],
            planning: initialSprintPlanning,
            totalDays,
        });
    });

     if (sprints.length === 0) {
        throw new Error("No valid sprint data could be parsed from the file.");
    }

    sprints.sort((a, b) => a.sprintNumber - b.sprintNumber);

    return {
      sprints,
      totalStoryPoints: sprints.reduce((sum, s) => sum + s.completedPoints, 0),
      daysInSprint: maxTotalDays,
    };
  };

  // Handler to save processed sprint data to the *selected* project
  const handleSaveSprints = useCallback((newSprintData: SprintData) => {
    if (!selectedProjectId) {
       toast({ variant: "destructive", title: "Error", description: "No project selected." });
       return;
    }
    let projectNameForToast = 'N/A';
    setProjects(prevProjects => {
      const updatedProjects = prevProjects.map(p => {
         if (p.id === selectedProjectId) {
           projectNameForToast = p.name;
           const updatedSprints = newSprintData.sprints.map(newSprint => {
             const existingSprint = p.sprintData.sprints.find(
               oldSprint => oldSprint.sprintNumber === newSprint.sprintNumber
             );
             return {
               ...newSprint,
               details: existingSprint?.details ?? [],
               planning: existingSprint?.planning ?? initialSprintPlanning,
             };
           });

           return {
              ...p,
              sprintData: {
                 ...newSprintData,
                 sprints: updatedSprints,
              },
           };
         }
         return p;
      });
       return updatedProjects;
    });

    toast({ title: "Success", description: `Sprint data saved to project '${projectNameForToast}'.` });
    setActiveTab("home");
    setResetManualFormKey(prevKey => prevKey + 1);
  }, [selectedProjectId, toast]);


  // Handler to save planning data for a specific sprint
  const handleSavePlanning = useCallback((sprintNumber: number, planningData: SprintPlanning) => {
     if (!selectedProjectId) {
        toast({ variant: "destructive", title: "Error", description: "No project selected." });
        return;
     }
     let projectNameForToast = 'N/A';
     setProjects(prevProjects => {
       const updatedProjects = prevProjects.map(p => {
         if (p.id === selectedProjectId) {
           projectNameForToast = p.name;
           const updatedSprints = p.sprintData.sprints.map(s =>
             s.sprintNumber === sprintNumber ? { ...s, planning: planningData } : s
           );
           return {
             ...p,
             sprintData: {
               ...p.sprintData,
               sprints: updatedSprints,
             },
           };
         }
         return p;
       });
       return updatedProjects;
     });
      toast({ title: "Success", description: `Planning data saved for Sprint ${sprintNumber} in project '${projectNameForToast}'.` });
  }, [selectedProjectId, toast]);

  // Handler to save members for the *selected* project
  const handleSaveMembers = useCallback((updatedMembers: Member[]) => {
    if (!selectedProjectId) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }
    let projectNameForToast = 'N/A';
    setProjects(prevProjects => {
      const updatedProjects = prevProjects.map(p => {
        if (p.id === selectedProjectId) {
          projectNameForToast = p.name;
          return { ...p, members: updatedMembers };
        }
        return p;
      });
      return updatedProjects;
    });
    toast({ title: "Success", description: `Members updated for project '${projectNameForToast}'.` });
  }, [selectedProjectId, toast]);

  // Handler to add members to the *newly created* project (from dialog)
   const handleAddMembersToNewProject = useCallback((addedMembers: Member[]) => {
       if (!newlyCreatedProjectId) return;

       setProjects(prevProjects => {
         const updatedProjects = prevProjects.map(p => {
           if (p.id === newlyCreatedProjectId) {
             return { ...p, members: [...(p.members || []), ...addedMembers] };
           }
           return p;
         });
         return updatedProjects;
       });
       toast({ title: "Members Added", description: `Members added to the new project.` });
       setIsAddMembersDialogOpen(false); // Close the dialog
       setNewlyCreatedProjectId(null); // Reset the tracked ID
   }, [newlyCreatedProjectId, toast]);


  // Export data for the currently selected project
  const handleExport = () => {
    if (!selectedProject || !selectedProject.sprintData || selectedProject.sprintData.sprints.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `No data available to export for project '${selectedProject?.name ?? 'N/A'}'.`,
      });
      return;
    }
     try {
      const wb = XLSX.utils.book_new();

       // Sprint Summary Sheet
       const summaryData = selectedProject.sprintData.sprints.map(s => ({
         'SprintNumber': s.sprintNumber,
         'StartDate': s.startDate,
         'EndDate': s.endDate,
         'Duration': s.duration,
         'TotalCommitment': s.committedPoints,
         'TotalDelivered': s.completedPoints,
       }));
       const wsSummary = XLSX.utils.json_to_sheet(summaryData);
       XLSX.utils.book_append_sheet(wb, wsSummary, 'Sprint Summary');

       // Sprint Details Sheet
       const detailsExist = selectedProject.sprintData.sprints.some(s => s.details && s.details.length > 0);
       if (detailsExist) {
           const allDetails: any[] = [];
           selectedProject.sprintData.sprints.forEach(sprint => {
               (sprint.details || []).forEach(detail => {
                   allDetails.push({
                       'SprintNumber': sprint.sprintNumber,
                       'TicketNumber': detail.ticketNumber,
                       'Developer': detail.developer,
                       'StoryPoints': detail.storyPoints,
                       'DevelopmentTime': detail.devTime,
                   });
               });
           });
           if (allDetails.length > 0) {
               const wsDetails = XLSX.utils.json_to_sheet(allDetails);
               XLSX.utils.book_append_sheet(wb, wsDetails, 'Sprint Details');
           }
       }

       // Planning Sheets (Summary and Tasks)
       const planningExists = selectedProject.sprintData.sprints.some(s => s.planning && (s.planning.goal || s.planning.newTasks.length > 0 || s.planning.spilloverTasks.length > 0 || s.planning.definitionOfDone || s.planning.testingStrategy));
       if (planningExists) {
           const planningSummaryData: any[] = [];
           const planningTasksData: any[] = [];
           selectedProject.sprintData.sprints.forEach(sprint => {
               if (sprint.planning) {
                   planningSummaryData.push({
                      'SprintNumber': sprint.sprintNumber,
                      'Goal': sprint.planning.goal,
                      'DefinitionOfDone': sprint.planning.definitionOfDone,
                      'TestingStrategy': sprint.planning.testingStrategy,
                   });
                   sprint.planning.newTasks.forEach(task => planningTasksData.push({
                      'SprintNumber': sprint.sprintNumber,
                      'Type': 'New',
                      'TaskID': task.id,
                      'Description': task.description,
                      'StoryPoints': task.storyPoints,
                      'Assignee': task.assignee,
                      'Status': task.status,
                   }));
                    sprint.planning.spilloverTasks.forEach(task => planningTasksData.push({
                      'SprintNumber': sprint.sprintNumber,
                      'Type': 'Spillover',
                      'TaskID': task.id,
                      'Description': task.description,
                      'StoryPoints': task.storyPoints,
                      'Assignee': task.assignee,
                      'Status': task.status,
                   }));
               }
           });
            if (planningSummaryData.length > 0) {
               const wsPlanningSummary = XLSX.utils.json_to_sheet(planningSummaryData);
               XLSX.utils.book_append_sheet(wb, wsPlanningSummary, 'Planning Summary');
            }
            if (planningTasksData.length > 0) {
               const wsPlanningTasks = XLSX.utils.json_to_sheet(planningTasksData);
               XLSX.utils.book_append_sheet(wb, wsPlanningTasks, 'Planning Tasks');
            }
       }

       // Members Sheet
       if (selectedProject.members && selectedProject.members.length > 0) {
            const membersData = selectedProject.members.map(m => ({
                'MemberID': m.id,
                'Name': m.name,
                'Role': m.role,
            }));
            const wsMembers = XLSX.utils.json_to_sheet(membersData);
            XLSX.utils.book_append_sheet(wb, wsMembers, 'Members');
       }


      const projectNameSlug = selectedProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      XLSX.writeFile(wb, `sprint_stats_${projectNameSlug}_report.xlsx`);
      toast({ title: "Success", description: `Data for project '${selectedProject.name}' exported to Excel.` });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export data.",
      });
    }
  };

  // Handle creating a new project
  const handleCreateNewProject = () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
        toast({ variant: "destructive", title: "Error", description: "Project name cannot be empty." });
        return;
    }
    if (projects.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
        toast({ variant: "destructive", title: "Error", description: `Project with name "${trimmedName}" already exists.` });
        return;
    }

    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name: trimmedName,
      sprintData: initialSprintData,
      members: [], // Initialize with empty members array
    };

    setProjects(prevProjects => [...prevProjects, newProject]);
    setSelectedProjectId(newProject.id);
    setNewProjectName('');
    setIsNewProjectDialogOpen(false);
    toast({ title: "Project Created", description: `Project "${trimmedName}" created successfully.` });

    // Open the Add Members dialog for the newly created project
    setNewlyCreatedProjectId(newProject.id); // Track the new project ID
    setIsAddMembersDialogOpen(true); // Open the dialog
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-card border-b shadow-sm">
        <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-primary">Sprint Stats</h1>
             <Select
               value={selectedProjectId ?? undefined}
               onValueChange={(value) => {
                   setSelectedProjectId(value);
                   setActiveTab("home");
                   setResetManualFormKey(prevKey => prevKey + 1);
               }}
               disabled={projects.length === 0}
             >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Projects</SelectLabel>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                     {projects.length === 0 && <SelectItem value="no-projects" disabled>No projects yet</SelectItem>}
                  </SelectGroup>
                </SelectContent>
             </Select>
             <Dialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4" /> New Project</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                        <DialogDescription>
                            Enter a name for your new project. Click create when you're done.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                className="col-span-3"
                                placeholder="E.g., Website Redesign"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={handleCreateNewProject}>Create Project</Button>
                    </DialogFooter>
                </DialogContent>
             </Dialog>
        </div>

        <div className="flex items-center gap-4">
          {selectedProject && (selectedProject.sprintData.sprints.length > 0 || selectedProject.members.length > 0) && (
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Project Data
            </Button>
          )}
        </div>
      </header>

      {/* Add Members Dialog */}
      <AddMembersDialog
        isOpen={isAddMembersDialogOpen}
        onOpenChange={setIsAddMembersDialogOpen}
        onSaveMembers={handleAddMembersToNewProject} // Use the specific handler for new projects
        existingMembers={[]} // Start with no members for a new project
        projectId={newlyCreatedProjectId} // Pass the ID of the newly created project
      />


      <main className="flex-1 p-6">
         {selectedProject ? (
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6"> {/* Updated grid-cols to 5 */}
                <TabsTrigger value="home"><HomeIcon className="mr-2 h-4 w-4" />Home</TabsTrigger>
                <TabsTrigger value="entry"><ListPlus className="mr-2 h-4 w-4" />Entry</TabsTrigger>
                <TabsTrigger value="planning"><NotebookPen className="mr-2 h-4 w-4" />Planning</TabsTrigger>
                <TabsTrigger value="members"><Users className="mr-2 h-4 w-4" />Members</TabsTrigger> {/* Added Members Trigger */}
                <TabsTrigger value="reports"><BarChart className="mr-2 h-4 w-4" />Reports</TabsTrigger>
              </TabsList>

              <TabsContent value="home">
                 <HomeTab
                     projectId={selectedProject.id}
                     sprintData={selectedProject.sprintData}
                     projectName={selectedProject.name}
                 />
              </TabsContent>

              <TabsContent value="entry">
                <EntryTab
                    key={resetManualFormKey}
                    onSaveSprints={handleSaveSprints}
                    initialSprintData={selectedProject.sprintData}
                    parseSprintData={parseSprintData}
                    projectName={selectedProject.name}
                />
              </TabsContent>

              <TabsContent value="planning">
                  <PlanningTab
                    sprints={selectedProject.sprintData.sprints}
                    onSavePlanning={handleSavePlanning}
                    projectName={selectedProject.name}
                    members={selectedProject.members} // Pass members for assignee dropdown
                  />
               </TabsContent>

               <TabsContent value="members">
                 <MembersTab
                   projectId={selectedProject.id}
                   projectName={selectedProject.name}
                   initialMembers={selectedProject.members}
                   onSaveMembers={handleSaveMembers} // Pass the save handler
                 />
               </TabsContent>

              <TabsContent value="reports">
                 <ReportsTab sprintData={selectedProject.sprintData} projectName={selectedProject.name} />
              </TabsContent>
            </Tabs>
         ) : (
            <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
              <CardHeader className="text-center">
                <CardTitle>No Project Selected</CardTitle>
                <CardDescription>Please select a project from the dropdown above, or create a new one.</CardDescription>
              </CardHeader>
            </Card>
         )}
      </main>

      <footer className="text-center p-4 text-xs text-muted-foreground border-t">
         Sprint Stats - Agile Reporting Made Easy
      </footer>
    </div>
  );
}
