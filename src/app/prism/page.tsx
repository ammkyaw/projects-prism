"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'; // Added useRef, React
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Added CardContent
import { Download, HomeIcon, BarChart, ListPlus, PlusCircle, NotebookPen, Users, Trash2, CalendarDays, Edit, UsersRound, Package, LayoutDashboard, IterationCw, Layers, BarChartBig, Settings, Activity, Eye, Filter, GitCommitVertical, History, CheckCircle, Undo, ArrowUpDown, ListChecks } from 'lucide-react'; // Added ArrowUpDown, ListChecks icons
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; // Import AlertDialog components


// Main Content Components (Tabs) - Renamed and New Placeholders
import DashboardTab from '@/components/dashboard-tab'; // Renamed from HomeTab

// Sprint Sub-Tab Components
import SprintSummaryTab from '@/components/sprints/sprint-summary-tab'; // Updated path
import SprintPlanningTab from '@/components/sprints/sprint-planning-tab'; // New component for planning
import SprintRetrospectiveTab from '@/components/sprints/sprint-retrospective-tab'; // Updated path

// Backlog Sub-Tab Components
import BacklogTab from '@/components/backlog/backlog-tab'; // Updated path
import BacklogPrioritizationTab from '@/components/backlog/backlog-prioritization-tab'; // Updated path
import BacklogGroomingTab from '@/components/backlog/backlog-grooming-tab'; // Corrected import path
import HistoryTab from '@/components/backlog/history-tab'; // Import HistoryTab component

// Teams Sub-tab Components
import MembersTab from '@/components/teams/members-tab'; // Updated path
import TeamsTab from '@/components/teams/teams-tab'; // Updated path
import AddMembersDialog from '@/components/add-members-dialog';

// Analytics Sub-Tab Components
import AnalyticsChartsTab from '@/components/analytics-charts-tab';
import AnalyticsReportsTab from '@/components/analytics/analytics-reports-tab'; // Updated path

// Settings Sub-tab Components
import HolidaysTab from '@/components/settings/holidays-tab'; // Updated path

import type { SprintData, Sprint, AppData, Project, SprintDetailItem, SprintPlanning, Member, SprintStatus, Task, HolidayCalendar, PublicHoliday, Team, TeamMember, HistoryStatus, ToastFun } from '@/types/sprint-data'; // Added HistoryStatus, ToastFun
import { initialSprintData, initialSprintPlanning, taskStatuses, initialTeam, initialBacklogTask, taskPriorities } from '@/types/sprint-data'; // Import taskPriorities
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addDays, format, parseISO, isPast, isValid, getYear } from 'date-fns'; // Added getYear
import { useSprintsActions } from '@/hooks/use-sprints-actions'; // Import the new hook
import { useBacklogActions } from '@/hooks/use-backlog-actions';
import { generateNextBacklogIdHelper } from '@/lib/utils'; // Import the helper function
import { ModeToggle } from '@/components/mode-toggle'; // Import ModeToggle
import { useProjects, useUpdateProject, useDeleteProject } from '@/hooks/use-projects'; // Import React Query hooks
import { handleExport } from '@/lib/export';

export default function Home() {
  // Local UI state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState<boolean>(false);
  const [isAddMembersDialogOpen, setIsAddMembersDialogOpen] = useState<boolean>(false);
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);
  const [confirmProjectName, setConfirmProjectName] = useState<string>('');
  const [clientNow, setClientNow] = useState<Date | null>(null);
  const { toast } = useToast();

  // React Query hooks for data management
  const { data: projects = [], isLoading: isLoadingProjects, error: projectsError } = useProjects();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  // Get current date on client mount to avoid hydration issues
  useEffect(() => {
     setClientNow(new Date());
  }, []);

   // Effect to select the first project when data loads or changes, if none selected
   useEffect(() => {
     if (!isLoadingProjects && projects.length > 0 && !selectedProjectId) {
       setSelectedProjectId(projects[0].id);
       console.log("No project selected, defaulting to first project:", projects[0].id);
     } else if (!isLoadingProjects && projects.length === 0) {
        setSelectedProjectId(null); // Clear selection if no projects exist
     }
     // Do NOT reset selectedProjectId if it already exists and is valid within the loaded projects
   }, [isLoadingProjects, projects, selectedProjectId]);


  // Find the currently selected project object
  const selectedProject = useMemo(() => {
    const project = projects.find(p => p.id === selectedProjectId) ?? null;
    console.log("Selected project determined:", project?.name ?? 'None');
    return project;
  }, [projects, selectedProjectId]);

  // Define default sub-tabs for each main tab
  const defaultSubTabs: Record<string, string> = {
      sprints: 'summary',
      backlog: 'management',
      analytics: 'charts',
      teams: 'members',
      settings: 'holidays',
  };

  // Update activeTab logic for main tabs
  const handleMainTabChange = (mainTabKey: string) => {
      if (mainTabKey === 'dashboard') { // Only dashboard is a main tab without subtabs now
         setActiveTab(mainTabKey);
      } else {
         const defaultSub = defaultSubTabs[mainTabKey] || ''; // Fallback to empty string if no default
         setActiveTab(`${mainTabKey}/${defaultSub}`);
      }
  };

  // Get the active main tab key from the combined state
  const activeMainTab = useMemo(() => activeTab.split('/')[0], [activeTab]);

   // Helper function to update project data via mutation
   const updateProjectData = useCallback((updatedProject: Project) => {
        if (!updatedProject.id) {
            toast({ variant: "destructive", title: "Error", description: "Project ID missing, cannot update." });
            return;
        }
        updateProjectMutation.mutate(updatedProject, {
            onError: (error) => {
                toast({ variant: "destructive", title: "Save Error", description: `Failed to save changes: ${error.message}` });
            }
            // onSuccess is handled in the hook to invalidate query
        });
   }, [updateProjectMutation, toast]);


  // Use the custom hook for sprint actions
  const {
    handleSavePlanningAndUpdateStatus,
    handleCreateAndPlanSprint,
    handleCompleteSprint,
    handleDeleteSprint,
  } = useSprintsActions({
    selectedProject,
    updateProjectData,
    toast,
    clientNow,
    projects,
    selectedProjectId,
  });

  // Use the custom hook for backlog actions
  const {
    handleSaveNewBacklogItems,
    handleUpdateSavedBacklogItem,
    handleMoveToSprint,
    handleRevertTaskToBacklog,
    handleSplitBacklogItem,
    handleDeleteSavedBacklogItem,
    handleMergeBacklogItems,
    handleUndoBacklogAction
    } = useBacklogActions({
        selectedProject,
        updateProjectData,
        toast,
        projects,
        selectedProjectId,
      });


  // Handler to save members for the *selected* project
  const handleSaveMembers = useCallback((updatedMembers: Member[]) => {
    if (!selectedProject) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }
    const updatedProject: Project = { ...selectedProject, members: updatedMembers };
    updateProjectData(updatedProject);
    toast({ title: "Success", description: `Members updated for project '${selectedProject.name}'.` });
  }, [selectedProject, updateProjectData, toast]);

   // Handler to save holiday calendars for the *selected* project
   const handleSaveHolidayCalendars = useCallback((updatedCalendars: HolidayCalendar[]) => {
       if (!selectedProject) {
           toast({ variant: "destructive", title: "Error", description: "No project selected." });
           return;
       }

       const currentProjectName = selectedProject.name;
       let membersToUpdate: Member[] = [];

       // Check which members might lose their assigned calendar
       const updatedMembers = (selectedProject.members || []).map(member => {
           const calendarExists = updatedCalendars.some(cal => cal.id === member.holidayCalendarId);
           if (member.holidayCalendarId && !calendarExists) {
               membersToUpdate.push(member); // Track members whose calendar was removed
               return { ...member, holidayCalendarId: null }; // Unassign calendar
           }
           return member;
       });

       const updatedProject: Project = {
           ...selectedProject,
           holidayCalendars: updatedCalendars,
           members: updatedMembers,
       };

       updateProjectData(updatedProject);

       // Show toasts *after* the mutation call (optimistically)
       setTimeout(() => {
           toast({ title: "Success", description: `Holiday calendars updated for project '${currentProjectName}'.` });
           membersToUpdate.forEach(member => {
               toast({ variant: "warning", title: "Calendar Unassigned", description: `Holiday calendar assigned to ${member.name} was deleted or is no longer available.` });
           });
       }, 0);

   }, [selectedProject, updateProjectData, toast]);

   // Handler to save teams for the *selected* project
   const handleSaveTeams = useCallback((updatedTeams: Team[]) => {
       if (!selectedProject) {
           toast({ variant: "destructive", title: "Error", description: "No project selected." });
           return;
       }
       const currentProjectName = selectedProject.name;

       // Optionally, add validation here to ensure team members and leads still exist
       const validTeams = updatedTeams.map(team => {
           const validMembers = team.members.filter(tm => (selectedProject.members || []).some(m => m.id === tm.memberId));
           let validLead = team.leadMemberId;
           if (validLead && !(selectedProject.members || []).some(m => m.id === validLead)) {
                console.warn(`Lead member ID ${validLead} for team ${team.name} not found. Resetting.`);
                validLead = null;
           }
           return { ...team, members: validMembers, leadMemberId: validLead };
       });

       const updatedProject: Project = { ...selectedProject, teams: validTeams };
       updateProjectData(updatedProject);
       toast({ title: "Success", description: `Teams updated for project '${currentProjectName}'.` });
   }, [selectedProject, updateProjectData, toast]);

  // Handler to add members to the *newly created* project (from dialog)
   const handleAddMembersToNewProject = useCallback((addedMembers: Member[]) => {
       if (!newlyCreatedProjectId) return;

       const projectToUpdate = projects.find(p => p.id === newlyCreatedProjectId);
       if (!projectToUpdate) {
            toast({ variant: "destructive", title: "Error", description: "Newly created project not found." });
            setIsAddMembersDialogOpen(false);
            setNewlyCreatedProjectId(null);
            return;
       }

        const updatedProject: Project = {
           ...projectToUpdate,
           members: [...(projectToUpdate.members || []), ...addedMembers]
        };

       updateProjectData(updatedProject); // Update via mutation

       toast({ title: "Members Added", description: `Members added to project '${projectToUpdate.name}'.` });
       setIsAddMembersDialogOpen(false);
       setNewlyCreatedProjectId(null);

   }, [newlyCreatedProjectId, projects, updateProjectData, toast, setIsAddMembersDialogOpen, setNewlyCreatedProjectId]);


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
      members: [],
      holidayCalendars: [],
      teams: [],
      backlog: [],
    };

    updateProjectMutation.mutate(newProject, {
      onSuccess: (data, variables) => {
        // variables is the project object passed to mutate
        setSelectedProjectId(variables.id);
        setNewProjectName('');
        setIsNewProjectDialogOpen(false);
        setNewlyCreatedProjectId(variables.id);
        setActiveTab("dashboard");

        // Defer the toast and dialog opening slightly
        setTimeout(() => {
          toast({ title: "Project Created", description: `Project "${trimmedName}" created successfully.` });
          setIsAddMembersDialogOpen(true); // Open the dialog AFTER state update
        }, 50);
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Create Error", description: `Failed to create project: ${error.message}` });
      }
    });
  };

   // Handler to open the delete project confirmation dialog (uses local state)
   const handleOpenDeleteDialog = (projectId: string | null) => {
       if (!projectId) return;
       setProjectToDeleteId(projectId);
       setConfirmProjectName(''); // Reset confirmation input
       setIsDeleteDialogOpen(true);
   };

   // Handler to confirm and delete a project
   const handleConfirmDeleteProject = () => {
       if (!projectToDeleteId) return;

       const project = projects.find(p => p.id === projectToDeleteId);
       if (!project) {
           toast({ variant: "destructive", title: "Error", description: "Project not found." });
           setIsDeleteDialogOpen(false);
           setProjectToDeleteId(null);
           return;
       }

       if (confirmProjectName.trim().toLowerCase() !== project.name.toLowerCase()) {
           toast({ variant: "destructive", title: "Confirmation Failed", description: "Project name does not match." });
           return;
       }

       deleteProjectMutation.mutate(projectToDeleteId, {
          onSuccess: () => {
             toast({ title: "Project Deleted", description: `Project "${project.name}" has been deleted.` });
             setIsDeleteDialogOpen(false);
             setProjectToDeleteId(null);
              // If the deleted project was the selected one, select the first available project or null
             if (selectedProjectId === projectToDeleteId) {
                const remainingProjects = projects.filter(p => p.id !== projectToDeleteId);
                setSelectedProjectId(remainingProjects.length > 0 ? remainingProjects[0].id : null);
             }
          },
          onError: (error) => {
             toast({ variant: "destructive", title: "Delete Error", description: `Failed to delete project: ${error.message}` });
              setIsDeleteDialogOpen(false); // Close dialog even on error
              setProjectToDeleteId(null);
          }
       });
   };


  // Define the tab structure
  const tabsConfig: Record<string, { label: string; icon: React.ElementType; component?: React.ElementType; subTabs?: Record<string, { label: string; icon: React.ElementType; component: React.ElementType }> }> = {
      dashboard: { label: "Dashboard", icon: LayoutDashboard, component: DashboardTab },
      sprints: {
          label: "Sprints", icon: IterationCw, subTabs: {
              summary: { label: "Summary", icon: Eye, component: SprintSummaryTab },
              planning: { label: "Planning", icon: NotebookPen, component: SprintPlanningTab },
              retrospective: { label: "Retrospective", icon: GitCommitVertical, component: SprintRetrospectiveTab },
          }
      },
      backlog: {
          label: "Backlog", icon: Layers, subTabs: {
              management: { label: "Management", icon: Package, component: BacklogTab },
              grooming: { label: "Grooming", icon: Edit, component: BacklogGroomingTab },
              history: { label: "History", icon: History, component: HistoryTab }, // Added History Sub-Tab
          }
      },
      analytics: {
          label: "Analytics", icon: BarChartBig, subTabs: {
              charts: { label: "Charts", icon: BarChart, component: AnalyticsChartsTab },
              reports: { label: "Reports", icon: ListPlus, component: AnalyticsReportsTab },
          }
      },
      teams: {
          label: "Teams", icon: Users, subTabs: {
              members: { label: "Members", icon: Users, component: MembersTab },
              teams: { label: "Teams", icon: UsersRound, component: TeamsTab },
          }
      },
      settings: {
          label: "Settings", icon: Settings, subTabs: {
              holidays: { label: "Holidays", icon: CalendarDays, component: HolidaysTab },
          }
      },
  };

  // Render the currently active tab content
  const renderActiveTabContent = () => {
    if (!selectedProject) {
      // Initial loading state from React Query
      if (isLoadingProjects) {
          return (
              <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
                  <CardHeader className="text-center">
                      <CardTitle>Loading Project Data...</CardTitle>
                      <CardDescription>Please wait while the application loads.</CardDescription>
                  </CardHeader>
              </Card>
          );
      }
       // Error state from React Query
      if (projectsError) {
          return (
              <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2 border-destructive">
                  <CardHeader className="text-center">
                      <CardTitle className="text-destructive">Error Loading Projects</CardTitle>
                      <CardDescription>Could not load project data. Please check your connection or Firebase setup.</CardDescription>
                      <CardDescription className="text-xs text-muted-foreground mt-2">{projectsError.message}</CardDescription>
                  </CardHeader>
              </Card>
          );
      }
       // No projects exist state
       if (projects.length === 0) {
            return (
                <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
                  <CardHeader className="text-center">
                    <CardTitle>No Projects Found</CardTitle>
                    <CardDescription>Create your first project using the 'New Project' button above.</CardDescription>
                  </CardHeader>
                </Card>
            );
       }

       // No project selected (should ideally default to first, but handle as fallback)
      return (
        <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
          <CardHeader className="text-center">
            <CardTitle>No Project Selected</CardTitle>
            <CardDescription>Please select a project from the dropdown above, or create a new one.</CardDescription>
          </CardHeader>
        </Card>
      );
    }

    const [mainKey, subKey] = activeTab.split('/');
    const mainConfig = tabsConfig[mainKey as keyof typeof tabsConfig];

    if (!mainConfig) return null; // Should not happen if activeTab is valid

    let ActiveComponent;
    let componentProps: any = { // Base props for all components
        projectId: selectedProject.id,
        projectName: selectedProject.name,
    };

    if (mainConfig.subTabs && subKey) {
        const subConfig = mainConfig.subTabs[subKey as keyof typeof mainConfig.subTabs];
        if (!subConfig) return null; // Invalid sub-tab
        ActiveComponent = subConfig.component;

        // Add specific props based on the sub-tab component
         switch (`${mainKey}/${subKey}`) {
            case 'sprints/summary':
               componentProps = { ...componentProps, sprintData: selectedProject.sprintData, onDeleteSprint: handleDeleteSprint };
               break;
            case 'sprints/planning':
                componentProps = {
                    ...componentProps,
                    sprints: selectedProject.sprintData.sprints ?? [],
                    onSavePlanning: handleSavePlanningAndUpdateStatus,
                    onCreateAndPlanSprint: handleCreateAndPlanSprint,
                    members: selectedProject.members ?? [],
                    holidayCalendars: selectedProject.holidayCalendars ?? [],
                    teams: selectedProject.teams ?? [],
                    backlog: selectedProject.backlog?.filter(task => !task.historyStatus && task.readyForSprint) ?? [], // Pass ready & non-historical items
                    onRevertTask: handleRevertTaskToBacklog, // Pass revert function
                    onCompleteSprint: handleCompleteSprint, // Pass complete function
                 };
                break;
            case 'sprints/retrospective':
                 componentProps = { ...componentProps, sprints: selectedProject.sprintData.sprints ?? [] };
                 break;
            case 'backlog/management':
                componentProps = {
                    ...componentProps,
                    initialBacklog: selectedProject.backlog ?? [], // Pass ALL items
                    onSaveNewItems: handleSaveNewBacklogItems, // Pass handler for new items
                    onUpdateSavedItem: handleUpdateSavedBacklogItem, // Pass handler for updates
                    onDeleteSavedItem: handleDeleteSavedBacklogItem, // Pass handler for deletion
                    members: selectedProject.members ?? [], // Still needed for assignee dropdown
                    sprints: selectedProject.sprintData.sprints ?? [], // Still needed for "Move to Sprint" dialog options
                    onMoveToSprint: handleMoveToSprint, // Pass handler from hook
                    generateNextBacklogId: generateNextBacklogIdHelper, // Pass the helper
                 };
                break;
            case 'backlog/grooming':
                componentProps = {
                     ...componentProps,
                     initialBacklog: selectedProject.backlog ?? [], // Pass full backlog
                      // Grooming usually modifies existing items, requires saving the whole project
                      onSaveBacklog: (groomedBacklog: Task[]) => {
                           const updatedProject: Project = { ...selectedProject, backlog: groomedBacklog };
                           updateProjectData(updatedProject);
                           toast({ title: "Backlog Groomed", description: "Changes saved." });
                      },
                     onSplitBacklogItem: handleSplitBacklogItem, // Pass handler from hook
                     onMergeBacklogItems: handleMergeBacklogItems, // Pass handler from hook
                     onUndoBacklogAction: handleUndoBacklogAction, // Pass handler from hook
                     generateNextBacklogId: generateNextBacklogIdHelper, // Pass helper for merge dialog ID gen
                     allProjectBacklogItems: selectedProject.backlog ?? [], // Pass all items for uniqueness check
                 };
                break;
             case 'backlog/history': // Updated sub-tab path
                componentProps = {
                    ...componentProps,
                    historyItems: selectedProject.backlog?.filter(task => !!task.historyStatus) ?? [], // Pass items with history status
                    onUndoBacklogAction: handleUndoBacklogAction, // Pass handler from hook
                 };
                break;
            case 'analytics/charts':
                 componentProps = { ...componentProps, sprintData: selectedProject.sprintData, members: selectedProject.members ?? [] };
                 break;
            case 'analytics/reports':
                 componentProps = { ...componentProps, sprintData: selectedProject.sprintData };
                 break;
            case 'teams/members':
                componentProps = {
                    ...componentProps,
                    initialMembers: selectedProject.members ?? [],
                    onSaveMembers: handleSaveMembers,
                    holidayCalendars: selectedProject.holidayCalendars ?? [],
                 };
                break;
            case 'teams/teams':
                 componentProps = {
                    ...componentProps,
                    initialTeams: selectedProject.teams ?? [],
                    allMembers: selectedProject.members ?? [],
                    onSaveTeams: handleSaveTeams,
                 };
                 break;
            case 'settings/holidays':
                 componentProps = {
                    ...componentProps,
                    initialCalendars: selectedProject.holidayCalendars ?? [],
                    onSaveCalendars: handleSaveHolidayCalendars,
                 };
                 break;
            default:
                ActiveComponent = () => <div>Unknown Tab</div>;
                componentProps = {};
                break;
        }
    } else {
        // Handle main tabs without sub-tabs (Dashboard)
        ActiveComponent = mainConfig.component;
         if (mainKey === 'dashboard') {
            componentProps = { ...componentProps, sprintData: selectedProject.sprintData };
         }
        // Add props for other main tabs if needed
    }


    return <ActiveComponent {...componentProps} />;
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-card border-b shadow-sm">
        <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-primary">Projects Prism</h1>
             <Select
               value={selectedProjectId ?? null}
               onValueChange={(value) => {
                  if (value === 'loading' || value === 'no-projects') return; // Prevent selecting placeholder items
                   console.log(`Project selected: ${value}`);
                   setSelectedProjectId(value);
                   setActiveTab("dashboard"); // Reset to dashboard tab on project change
               }}
               disabled={isLoadingProjects || projects.length === 0} // Disable while loading or if no projects
             >
                <SelectTrigger className="w-[200px]"> {/* Increased width */}
                  <SelectValue placeholder={isLoadingProjects ? "Loading..." : (projects.length === 0 ? "No projects yet" : "Select a project")} />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Projects</SelectLabel>
                        {isLoadingProjects ? (
                            <SelectItem value="loading" disabled>Loading projects...</SelectItem>
                        ) : projects.length > 0 ? (
                            projects.map(project => (
                                <div key={project.id} className="flex items-center justify-between pr-2">
                                    <SelectItem value={project.id} className="flex-1"> {/* Allow text to take space */}
                                        {project.name}
                                    </SelectItem>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-2 text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent Select from closing
                                            handleOpenDeleteDialog(project.id);
                                        }}
                                        aria-label={`Delete project ${project.name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <SelectItem value="no-projects" disabled>No projects yet</SelectItem>
                        )}
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
                                placeholder="Auto-insurance"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" onClick={handleCreateNewProject} disabled={updateProjectMutation.isPending}>
                           {updateProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
             </Dialog>
        </div>

        <div className="flex items-center gap-4">
          {selectedProject && (selectedProject.sprintData?.sprints?.length > 0 || selectedProject.members?.length > 0 || selectedProject.holidayCalendars?.length > 0 || selectedProject.teams?.length > 0 || selectedProject.backlog?.length > 0) && (
            <Button onClick={() => handleExport(selectedProject, toast as ToastFun)} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Project Data
            </Button>
          )}
          <ModeToggle /> {/* Add the dark mode toggle */}
        </div>
      </header>

       {/* Delete Project Confirmation Dialog */}
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
           <AlertDialogContent>
               <AlertDialogHeader>
                   <AlertDialogTitle>Delete Project "{projects.find(p => p.id === projectToDeleteId)?.name}"?</AlertDialogTitle>
                   <AlertDialogDescription>
                       This action cannot be undone. This will permanently delete the project and all its associated data (sprints, backlog, members, etc.).
                       <br />
                       To confirm, please type the project name below:
                       <strong className="block mt-1">{projects.find(p => p.id === projectToDeleteId)?.name}</strong>
                   </AlertDialogDescription>
               </AlertDialogHeader>
               <div className="py-2">
                    <Input
                        id="confirm-project-name"
                        value={confirmProjectName}
                        onChange={(e) => setConfirmProjectName(e.target.value)}
                        placeholder="Type project name to confirm"
                        className="mt-2"
                    />
               </div>
               <AlertDialogFooter>
                   <AlertDialogCancel onClick={() => setProjectToDeleteId(null)}>Cancel</AlertDialogCancel>
                   <AlertDialogAction
                       onClick={handleConfirmDeleteProject}
                       disabled={
                            deleteProjectMutation.isPending ||
                            confirmProjectName.trim().toLowerCase() !== (projects.find(p => p.id === projectToDeleteId)?.name.toLowerCase() ?? ' ')
                        }
                       className={cn(buttonVariants({ variant: "destructive" }))}
                   >
                       {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
                   </AlertDialogAction>
               </AlertDialogFooter>
           </AlertDialogContent>
       </AlertDialog>

      {/* Add Members Dialog */}
      <AddMembersDialog
        isOpen={isAddMembersDialogOpen}
        onOpenChange={setIsAddMembersDialogOpen}
        onSaveMembers={handleAddMembersToNewProject} // Use the specific handler for new projects
        existingMembers={[]} // Start with no members for a new project
        projectId={newlyCreatedProjectId} // Pass the ID of the newly created project
      />


      <main className="flex-1 p-6">
         {isLoadingProjects ? ( // Use React Query loading state
             <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
                 <CardHeader className="text-center">
                     <CardTitle>Loading Project Data...</CardTitle>
                     <CardDescription>Please wait while the application loads.</CardDescription>
                 </CardHeader>
                  <CardContent>
                     {/* Optional: Add a spinner or loading indicator here */}
                 </CardContent>
             </Card>
         ) : (
             <Tabs value={activeMainTab} onValueChange={handleMainTabChange} className="w-full">
                {/* Main Tabs List - Updated grid cols (now 6 main tabs) */}
               <TabsList className="grid w-full grid-cols-6 mb-6">
                 {Object.entries(tabsConfig).map(([key, config]) => (
                     <TabsTrigger key={key} value={key}>
                        <config.icon className="mr-2 h-4 w-4" /> {config.label}
                     </TabsTrigger>
                 ))}
               </TabsList>

                {/* Sub Tabs and Content Area */}
                 <div className="mt-4">
                     {/* Render Sub Tabs only if the active main tab has them */}
                     {tabsConfig[activeMainTab as keyof typeof tabsConfig]?.subTabs && (
                         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
                            <TabsList className={cn(
                                "grid w-full",
                                // Adjust grid cols dynamically based on the number of subtabs
                                `grid-cols-${Object.keys(tabsConfig[activeMainTab as keyof typeof tabsConfig].subTabs!).length}`
                            )}>
                                {Object.entries(tabsConfig[activeMainTab as keyof typeof tabsConfig].subTabs!).map(([subKey, subConfig]) => (
                                    <TabsTrigger key={`${activeMainTab}/${subKey}`} value={`${activeMainTab}/${subKey}`}>
                                       <subConfig.icon className="mr-2 h-4 w-4" /> {subConfig.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                             {/* Content will be rendered below based on the combined activeTab state */}
                         </Tabs>
                     )}

                    {/* Render Content based on the full activeTab state */}
                    {renderActiveTabContent()}
                 </div>
             </Tabs>
          )}
      </main>

      <footer className="text-center p-4 text-xs text-muted-foreground border-t">
          Project Prism - Agile Reporting Made Easy
      </footer>
    </div>
  );

}
