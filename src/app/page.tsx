
"use client";

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'; // Added useRef, React
import * as XLSX from 'xlsx';
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Added CardContent
import { Download, HomeIcon, BarChart, ListPlus, PlusCircle, NotebookPen, Users, Trash2, CalendarDays, Edit, UsersRound, Package, LayoutDashboard, IterationCw, Layers, BarChartBig, Settings, Activity, Eye, Filter, GitCommitVertical, History, CheckCircle, Undo, ArrowUpDown, ListChecks } from 'lucide-react'; // Added ArrowUpDown, ListChecks icons
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


// Main Content Components (Tabs) - Renamed and New Placeholders
import DashboardTab from '@/components/dashboard-tab'; // Renamed from HomeTab
import BacklogTab from '@/components/backlog/backlog-tab'; // Updated path
import BacklogPrioritizationTab from '@/components/backlog/backlog-prioritization-tab'; // Updated path
import BacklogGroomingTab from '@/components/backlog/backlog-grooming-tab'; // Corrected import path
import HistoryTab from '@/components/backlog/history-tab'; // Import HistoryTab component

// Team and Settings Tabs
import MembersTab from '@/components/teams/members-tab'; // Updated path
import HolidaysTab from '@/components/settings/holidays-tab'; // Updated path
import TeamsTab from '@/components/teams/teams-tab'; // Updated path
import AddMembersDialog from '@/components/add-members-dialog';

// Sprint Sub-Tab Components
import SprintSummaryTab from '@/components/sprints/sprint-summary-tab'; // Updated path
import SprintPlanningTab from '@/components/sprints/sprint-planning-tab'; // New component for planning
import SprintRetrospectiveTab from '@/components/sprints/sprint-retrospective-tab'; // Updated path

// Analytics Sub-Tab Components
import AnalyticsChartsTab from '@/components/analytics-charts-tab';
import AnalyticsReportsTab from '@/components/analytics/analytics-reports-tab'; // Updated path


import type { SprintData, Sprint, AppData, Project, SprintDetailItem, SprintPlanning, Member, SprintStatus, Task, HolidayCalendar, PublicHoliday, Team, TeamMember, HistoryStatus } from '@/types/sprint-data'; // Added HistoryStatus
import { initialSprintData, initialSprintPlanning, taskStatuses, initialTeam, initialBacklogTask, taskPriorities } from '@/types/sprint-data'; // Import taskPriorities
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addDays, format, parseISO, isPast, isValid, getYear } from 'date-fns'; // Added getYear
import { ModeToggle } from '@/components/mode-toggle'; // Import ModeToggle


// Helper function to generate the next backlog ID based on *all* items (including historical and unsaved)
const generateNextBacklogIdHelper = (allProjectBacklogItems: Task[]): string => {
   const currentYear = getYear(new Date()).toString().slice(-2); // Get last two digits of the year
   const prefix = `BL-${currentYear}`;
   let maxNum = 0;

   allProjectBacklogItems.forEach(item => {
     const id = item.backlogId; // Use the actual backlogId
     // Consider only base BL-YYxxxx IDs from the current year
     // Use regex to extract the numeric part more reliably
     const match = id?.match(/^BL-\d{2}(\d{4})(?:-.*)?$/); // Match BL-YYNNNN or BL-YYNNNN-suffix
     if (id && id.startsWith(prefix) && match) {
         const numPart = parseInt(match[1], 10); // Get the NNNN part
         if (!isNaN(numPart) && numPart > maxNum) {
             maxNum = numPart;
         }
     }
   });

   const nextNum = maxNum + 1;
   const nextNumPadded = nextNum.toString().padStart(4, '0'); // Pad with leading zeros to 4 digits
   const newBaseId = `${prefix}${nextNumPadded}`;
   console.log("Generated next backlog ID:", newBaseId, "based on max:", maxNum); // Debug log
   return newBaseId;
 };


export default function Home() {
  const [projects, setProjects] = useState<AppData>([]); // State for all projects
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  // Combined state for active main and sub tab. Format: "main/sub" or just "main"
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState<boolean>(false); // Set default to false
  const [isAddMembersDialogOpen, setIsAddMembersDialogOpen] = useState<boolean>(false);
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<string | null>(null); // Track ID for Add Members dialog
  const { toast } = useToast();
  const [clientNow, setClientNow] = useState<Date | null>(null); // For client-side date comparison
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false); // State for delete project dialog
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null); // Track ID for deletion
  const [confirmProjectName, setConfirmProjectName] = useState<string>(''); // Input for delete confirmation

  // Get current date on client mount to avoid hydration issues
  useEffect(() => {
     setClientNow(new Date());
  }, []);

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


 // Effect to load data from localStorage on mount
 useEffect(() => {
     console.log("Attempting to load data from localStorage...");
     setIsLoading(true);
     try {
         const savedData = localStorage.getItem('appData');
         const savedProjectId = localStorage.getItem('selectedProjectId');
         console.log("Retrieved 'appData' from localStorage:", savedData ? savedData.substring(0, 100) + '...' : 'null'); // Log truncated data or null
         console.log("Retrieved 'selectedProjectId' from localStorage:", savedProjectId);

         if (savedData) {
             const parsedData: AppData = JSON.parse(savedData);
              if (Array.isArray(parsedData)) { // Basic validation
                 // Validate and potentially migrate data here if needed
                 const validatedProjects = parsedData.map(project => ({
                     ...project,
                     sprintData: project.sprintData ?? initialSprintData,
                     members: project.members ?? [],
                     holidayCalendars: project.holidayCalendars ?? [],
                     teams: project.teams ?? [],
                     backlog: (project.backlog ?? []).map(task => ({
                          ...task,
                           priority: taskPriorities.includes(task.priority as any) ? task.priority : 'Medium',
                           // Ensure backlogId exists during validation
                           backlogId: task.backlogId ?? `BL-LEGACY-${task.id}`, // Provide a fallback if missing
                           needsGrooming: task.needsGrooming ?? false, // Default to false if missing
                           readyForSprint: task.readyForSprint ?? false, // Default to false if missing
                           splitFromId: task.splitFromId, // Preserve if exists
                           mergeEventId: task.mergeEventId, // Preserve if exists
                     })).sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? '')),
                     sprintData: {
                         ...project.sprintData,
                         sprints: (project.sprintData?.sprints ?? []).sort((a, b) => a.sprintNumber - b.sprintNumber)
                     }
                 }));

                 setProjects(validatedProjects);
                 console.log("Successfully loaded and validated project data from localStorage.");

                 // Restore selected project ID if it exists and is valid
                 if (savedProjectId && validatedProjects.some(p => p.id === savedProjectId)) {
                     setSelectedProjectId(savedProjectId);
                     console.log(`Restored selected project ID: ${savedProjectId}`);
                 } else {
                     // If saved ID is invalid or no projects, select the first project or null
                     setSelectedProjectId(validatedProjects.length > 0 ? validatedProjects[0].id : null);
                     console.log("Selected project ID not found or invalid, selecting first project or null.");
                     // Clean up invalid saved ID
                     if (savedProjectId) {
                          localStorage.removeItem('selectedProjectId');
                     }
                 }
             } else {
                 throw new Error("Stored 'appData' is not an array.");
             }
         } else {
             console.log("No 'appData' found in localStorage. Initializing with empty state.");
             setProjects([]); // Initialize with empty array if no data found
             setSelectedProjectId(null);
         }
     } catch (error: any) {
         console.error("CRITICAL: Failed to parse or validate project data from localStorage. Error:", error.message, error.stack);
         toast({
             variant: "destructive",
             title: "Data Load Error",
             description: "Could not load project data. Resetting to empty state. Please report this issue if it persists.",
         });
         // Reset to a known good state
         setProjects([]);
         setSelectedProjectId(null);
         // Attempt to clear potentially corrupted data
         try {
              localStorage.removeItem('appData');
              localStorage.removeItem('selectedProjectId');
         } catch (clearError) {
             console.error("Failed to clear corrupted data from localStorage:", clearError);
         }
     } finally {
         setIsLoading(false);
         console.log("Finished loading data attempt.");
     }
 }, [toast]); // Rerun this effect only on mount (and if toast changes, which is unlikely)


     // Effect to save data to localStorage whenever projects change (now empty on first load)
     useEffect(() => {
         // Only run save logic after initial load is complete
         if (!isLoading) {
             console.log("Projects state changed, attempting to save to localStorage...");
             try {
                 const dataToSave = JSON.stringify(projects);
                 console.log("Stringified data to save:", dataToSave.substring(0, 500) + '...'); // Log truncated data
                 localStorage.setItem('appData', dataToSave);
                 console.log("Successfully saved project data to localStorage.");
             } catch (error: any) {
                 console.error("CRITICAL: Failed to save project data to localStorage. Error:", error.message, error.stack);
                 toast({
                     variant: "destructive",
                     title: "Save Error",
                     description: "Could not save project data locally. Data might be too large or storage is unavailable.",
                 });
             }
         } else {
             console.log("Skipping save to localStorage during initial loading.");
         }
     }, [projects, isLoading, toast]); // Add isLoading dependency

     // Effect to save the selected project ID
     useEffect(() => {
         if (!isLoading) { // Only save after initial load
             try {
                 if (selectedProjectId) {
                     console.log(`Saving selected project ID to localStorage: ${selectedProjectId}`);
                     localStorage.setItem('selectedProjectId', selectedProjectId);
                 } else {
                     console.log("No project selected, removing selectedProjectId from localStorage.");
                     // Remove if no project is selected to avoid stale references
                     localStorage.removeItem('selectedProjectId');
                 }
             } catch (err) {
                 console.error("Error accessing localStorage for selectedProjectId:", err);
                  toast({
                    variant: "destructive",
                    title: "Storage Error",
                    description: "Could not save selected project.",
                  });
             }
         } else {
             console.log("Skipping saving selected project ID during initial loading.");
         }
     }, [selectedProjectId, isLoading, toast]);


  // Find the currently selected project object
  const selectedProject = useMemo(() => {
    const project = projects.find(p => p.id === selectedProjectId) ?? null;
    console.log("Selected project determined:", project?.name ?? 'None');
    return project;
  }, [projects, selectedProjectId]);

  // Handler to save planning data AND potentially update sprint status (used by PlanningTab)
   const handleSavePlanningAndUpdateStatus = useCallback((sprintNumber: number, planningData: SprintPlanning, newStatus?: SprintStatus) => {
     if (!selectedProjectId) {
        toast({ variant: "destructive", title: "Error", description: "No project selected." });
        return;
     }
     let currentProjectName = 'N/A';
     let statusUpdateMessage = '';

     setProjects(prevProjects => {
        const updatedProjects = prevProjects.map(p => {
          if (p.id === selectedProjectId) {
              currentProjectName = p.name; // Capture project name here
              let tempSprints = [...(p.sprintData.sprints ?? [])]; // Create a mutable copy (handle null/undefined)

              // First pass: Deactivate other sprints if the target is becoming active
              if (newStatus === 'Active') {
                  tempSprints = tempSprints.map(otherS =>
                      otherS.sprintNumber !== sprintNumber && otherS.status === 'Active'
                          ? { ...otherS, status: 'Planned' } // Change other active to Planned
                          : otherS
                  );
                  // Make sure the target sprint's status is set correctly below
              } else if (newStatus === 'Completed') {
                   // Logic to handle completion (e.g., calculate completed points, move unfinished tasks?) - currently just sets status
              }


              // Second pass: Update the target sprint's planning and status
              const updatedSprints = tempSprints.map(s => {
                  if (s.sprintNumber === sprintNumber) {
                      let finalStatus = s.status;
                       // Only update status if newStatus is provided and different
                       if (newStatus && newStatus !== s.status) {
                            finalStatus = newStatus;
                            statusUpdateMessage = ` Sprint ${sprintNumber} status updated to ${newStatus}.`;
                       } else if (!newStatus && s.status === 'Active' && clientNow && s.endDate && isValid(parseISO(s.endDate)) && isPast(parseISO(s.endDate))) {
                             // Auto-complete if end date passed (only if status wasn't explicitly provided)
                             // We might want to disable auto-complete or make it optional
                             console.warn(`Auto-completing sprint ${sprintNumber} based on end date.`);
                             // finalStatus = 'Completed';
                             // statusUpdateMessage = ` Sprint ${sprintNumber} auto-completed based on end date.`;
                       }


                      // Ensure task IDs are present and correctly typed before saving
                       const validatedPlanning: SprintPlanning = {
                           ...planningData,
                           newTasks: (planningData.newTasks || []).map(task => ({
                              ...task,
                              id: task.id || `task_save_new_${Date.now()}_${Math.random()}`,
                              qaEstimatedTime: task.qaEstimatedTime ?? '2d', // Default QA time
                              bufferTime: task.bufferTime ?? '1d', // Default Buffer time
                              backlogId: task.backlogId ?? '', // Ensure backlogId
                           })),
                           spilloverTasks: (planningData.spilloverTasks || []).map(task => ({
                              ...task,
                              id: task.id || `task_save_spill_${Date.now()}_${Math.random()}`,
                              qaEstimatedTime: task.qaEstimatedTime ?? '2d', // Default QA time
                              bufferTime: task.bufferTime ?? '1d', // Default buffer time
                              backlogId: task.backlogId ?? '', // Ensure backlogId
                           })),
                      };
                       // Calculate committed points based on saved tasks
                       const committedPoints = [...(validatedPlanning.newTasks || []), ...(validatedPlanning.spilloverTasks || [])]
                            .reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);


                      return { ...s, planning: validatedPlanning, status: finalStatus, committedPoints: committedPoints };
                  }
                  return s;
              });

              return {
                  ...p,
                  sprintData: {
                      ...(p.sprintData ?? initialSprintData), // Use initialSprintData if sprintData is null/undefined
                      sprints: updatedSprints,
                  },
              };
          }
          return p;
        });
        // Trigger save effect by returning a new array reference
        return [...updatedProjects];
     });
     toast({ title: "Success", description: `Planning data saved for Sprint ${sprintNumber}.${statusUpdateMessage} in project '${currentProjectName}'` });
   }, [selectedProjectId, toast, clientNow]);


  // Handler to create a new sprint and save its initial planning data (used by PlanningTab)
  const handleCreateAndPlanSprint = useCallback((
    sprintDetails: Omit<Sprint, 'details' | 'planning' | 'status' | 'committedPoints' | 'completedPoints'>,
    planningData: SprintPlanning
  ) => {
    if (!selectedProjectId) {
       toast({ variant: "destructive", title: "Error", description: "No project selected." });
       return;
    }
    let projectNameForToast = 'N/A';
    let projectWasUpdated = false;

    setProjects(prevProjects => {
       const updatedProjects = prevProjects.map(p => {
        if (p.id === selectedProjectId) {
            projectNameForToast = p.name;
            if ((p.sprintData.sprints ?? []).some(s => s.sprintNumber === sprintDetails.sprintNumber)) { // Handle null/undefined
                console.error(`Sprint number ${sprintDetails.sprintNumber} already exists for project ${p.name}.`);
                 // Error handled by returning original 'p'
                return p;
            }

             // Validate planning data before creating
             const validatedPlanning: SprintPlanning = {
                ...planningData,
                 newTasks: (planningData.newTasks || []).map(task => ({
                    ...task,
                    id: task.id || `task_create_new_${Date.now()}_${Math.random()}`,
                    qaEstimatedTime: task.qaEstimatedTime ?? '2d', // Default QA time
                    bufferTime: task.bufferTime ?? '1d', // Default buffer time
                    backlogId: task.backlogId ?? '', // Ensure backlogId
                 })),
                 spilloverTasks: (planningData.spilloverTasks || []).map(task => ({
                    ...task,
                    id: task.id || `task_create_spill_${Date.now()}_${Math.random()}`,
                    qaEstimatedTime: task.qaEstimatedTime ?? '2d', // Default QA time
                    bufferTime: task.bufferTime ?? '1d', // Default buffer time
                    backlogId: task.backlogId ?? '', // Ensure backlogId
                 })),
             };

             // Calculate committed points for the new sprint
             const committedPoints = [...(validatedPlanning.newTasks || []), ...(validatedPlanning.spilloverTasks || [])]
                .reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);

            const newSprint: Sprint = {
                ...sprintDetails,
                committedPoints: committedPoints, // Set calculated committed points
                completedPoints: 0, // Initialize completed points
                status: 'Planned',
                details: [],
                planning: validatedPlanning,
            };

            const updatedSprints = [...(p.sprintData.sprints ?? []), newSprint]; // Handle null/undefined
            updatedSprints.sort((a, b) => a.sprintNumber - b.sprintNumber);
            projectWasUpdated = true; // Mark that an update occurred

            return {
                ...p,
                sprintData: {
                    ...(p.sprintData ?? initialSprintData), // Use initialSprintData if sprintData is null/undefined
                    sprints: updatedSprints,
                    daysInSprint: Math.max(p.sprintData?.daysInSprint || 0, newSprint.totalDays), // Handle null/undefined
                },
            };
        }
        return p;
      });

      // If no update happened (e.g., sprint number existed), return the previous state
      if (!projectWasUpdated) {
         // Using setTimeout to ensure toast doesn't interfere with rendering updates
         setTimeout(() => {
            toast({ variant: "destructive", title: "Error", description: `Sprint number ${sprintDetails.sprintNumber} already exists in project '${projectNameForToast}'.` });
         }, 0);
          return prevProjects;
      }

       // Return the updated projects array
       return updatedProjects;
    });

     // Show toast *after* setProjects has potentially completed its update cycle
     if (projectWasUpdated) {
         // Using setTimeout to ensure toast doesn't interfere with rendering updates
         setTimeout(() => {
              toast({ title: "Success", description: `Sprint ${sprintDetails.sprintNumber} created and planned for project '${projectNameForToast}'.` });
         }, 50); // Increased timeout
     }

  }, [selectedProjectId, toast]);

  // Handler to complete a sprint
  const handleCompleteSprint = useCallback((sprintNumber: number) => {
      if (!selectedProjectId) {
          toast({ variant: "destructive", title: "Error", description: "No project selected." });
          return;
      }
      let currentProjectName = 'N/A';

      setProjects(prevProjects => {
          const updatedProjects = prevProjects.map(p => {
              if (p.id === selectedProjectId) {
                   currentProjectName = p.name;
                   const updatedSprints = p.sprintData.sprints.map(s => {
                       if (s.sprintNumber === sprintNumber && s.status === 'Active') {
                           // Calculate completed points based on 'Done' tasks in the current planning state
                           const completedPoints = [...(s.planning?.newTasks || []), ...(s.planning?.spilloverTasks || [])]
                               .filter(task => task.status === 'Done')
                               .reduce((sum, task) => sum + (Number(task.storyPoints) || 0), 0);

                            // Move unfinished tasks back to backlog? (Optional - requires more complex logic)
                           // For now, just update status and points

                           return { ...s, status: 'Completed' as SprintStatus, completedPoints: completedPoints };
                       }
                       return s;
                   });
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
      toast({ title: "Success", description: `Sprint ${sprintNumber} marked as Completed in project '${currentProjectName}'.` });
       // Optionally switch tab or select next planned sprint
       setActiveTab('sprints/summary');
  }, [selectedProjectId, toast, setActiveTab]);


  // Handler to save members for the *selected* project
  const handleSaveMembers = useCallback((updatedMembers: Member[]) => {
    if (!selectedProjectId) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }
    let currentProjectName = 'N/A';
    setProjects(prevProjects => {
      const updatedProjects = prevProjects.map(p => {
        if (p.id === selectedProjectId) {
          currentProjectName = p.name; // Capture name
          return { ...p, members: updatedMembers };
        }
        return p;
      });
      return updatedProjects;
    });
    toast({ title: "Success", description: `Members updated for project '${currentProjectName}'.` });
  }, [selectedProjectId, toast]);

   // Handler to save holiday calendars for the *selected* project
   const handleSaveHolidayCalendars = useCallback((updatedCalendars: HolidayCalendar[]) => {
     if (!selectedProjectId) {
         toast({ variant: "destructive", title: "Error", description: "No project selected." });
         return;
     }

     let currentProjectName = 'N/A';
     let membersToUpdate: Member[] = [];

     setProjects(prevProjects => {
         const updatedProjects = prevProjects.map(p => {
             if (p.id === selectedProjectId) {
                 currentProjectName = p.name; // Capture name
                 // Keep track of members whose calendars might change
                 membersToUpdate = (p.members || []).map(member => {
                     if (member.holidayCalendarId && !updatedCalendars.some(cal => cal.id === member.holidayCalendarId)) {
                         return { ...member, holidayCalendarId: null }; // Mark for update
                     }
                     return member;
                 }).filter((m, index) => m.holidayCalendarId !== (p.members || [])[index].holidayCalendarId); // Only keep those that changed

                 const updatedMembers = (p.members || []).map(member => ({
                     ...member,
                     holidayCalendarId: member.holidayCalendarId && updatedCalendars.some(cal => cal.id === member.holidayCalendarId) ? member.holidayCalendarId : null,
                 }));

                 return { ...p, holidayCalendars: updatedCalendars, members: updatedMembers };
             }
             return p;
         });
         return updatedProjects;
     });

     // Show toasts *after* the state update
      setTimeout(() => {
         toast({ title: "Success", description: `Holiday calendars updated for project '${currentProjectName}'.` });
         membersToUpdate.forEach(member => {
             toast({ variant: "warning", title: "Calendar Unassigned", description: `Holiday calendar assigned to ${member.name} was deleted or is no longer available.` });
         });
      }, 0);

 }, [selectedProjectId, toast]);

   // Handler to save teams for the *selected* project
   const handleSaveTeams = useCallback((updatedTeams: Team[]) => {
     if (!selectedProjectId) {
         toast({ variant: "destructive", title: "Error", description: "No project selected." });
         return;
     }
     let currentProjectName = 'N/A';
     setProjects(prevProjects => {
         const updatedProjects = prevProjects.map(p => {
             if (p.id === selectedProjectId) {
                 currentProjectName = p.name; // Capture name
                 // Optionally, add validation here to ensure team members and leads still exist
                 const validTeams = updatedTeams.map(team => {
                     const validMembers = team.members.filter(tm => (p.members || []).some(m => m.id === tm.memberId));
                     let validLead = team.leadMemberId;
                     if (validLead && !(p.members || []).some(m => m.id === validLead)) {
                          console.warn(`Lead member ID ${validLead} for team ${team.name} not found. Resetting.`);
                          validLead = null;
                     }
                     return { ...team, members: validMembers, leadMemberId: validLead };
                 });
                 return { ...p, teams: validTeams };
             }
             return p;
         });
         return updatedProjects;
     });
     toast({ title: "Success", description: `Teams updated for project '${currentProjectName}'.` });
   }, [selectedProjectId, toast]);

    // Handler to save NEW backlog items (from the new items table)
    const handleSaveNewBacklogItems = useCallback((newItems: Task[]) => {
        if (!selectedProjectId) {
            toast({ variant: "destructive", title: "Error", description: "No project selected." });
            return;
        }
        let currentProjectName = 'N/A';
        setProjects(prevProjects => {
            const updatedProjects = prevProjects.map(p => {
                if (p.id === selectedProjectId) {
                    currentProjectName = p.name;
                    const existingBacklog = p.backlog ?? [];
                    // Assign persistent IDs to new items before adding
                    const itemsWithIds = newItems.map((item, index) => ({
                        ...item,
                        id: `backlog_${p.id}_${Date.now()}_${index}`, // Generate a more robust unique ID
                    }));
                    const updatedBacklog = [...existingBacklog, ...itemsWithIds];
                    // Re-sort the entire backlog after adding
                     updatedBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? ''));
                    return { ...p, backlog: updatedBacklog };
                }
                return p;
            });
            return updatedProjects;
        });
        // No separate toast here, handled in BacklogTab's save function
    }, [selectedProjectId, toast]);

    // Handler to update a specific SAVED backlog item
     const handleUpdateSavedBacklogItem = useCallback((updatedItem: Task) => {
        if (!selectedProjectId) {
            toast({ variant: "destructive", title: "Error", description: "No project selected." });
            return;
        }
        setProjects(prevProjects =>
            prevProjects.map(p =>
                p.id === selectedProjectId
                    ? { ...p, backlog: (p.backlog ?? []).map(item => item.id === updatedItem.id ? updatedItem : item) }
                    : p
            )
        );
        // Optional: Add a success toast here if needed
     }, [selectedProjectId, toast]);

     // Handler to delete a specific SAVED backlog item
      const handleDeleteSavedBacklogItem = useCallback((itemId: string) => {
         if (!selectedProjectId) {
             toast({ variant: "destructive", title: "Error", description: "No project selected." });
             return;
         }
         // TODO: Add confirmation dialog here before deleting
         setProjects(prevProjects =>
             prevProjects.map(p =>
                 p.id === selectedProjectId
                     ? { ...p, backlog: (p.backlog ?? []).filter(item => item.id !== itemId) }
                     : p
             )
         );
         toast({ title: "Backlog Item Deleted", description: "The item has been removed from the backlog." });
      }, [selectedProjectId, toast]);


   // Handler to move a backlog item to a sprint
   const handleMoveToSprint = useCallback((backlogItemId: string, targetSprintNumber: number) => {
       if (!selectedProjectId) {
           toast({ variant: "destructive", title: "Error", description: "No project selected." });
           return;
       }
       let currentProjectName = 'N/A';
       let movedItemDetails: string | null = null;

       setProjects(prevProjects => {
           const updatedProjects = prevProjects.map(p => {
               if (p.id === selectedProjectId) {
                    currentProjectName = p.name; // Capture name
                   const backlogItemIndex = (p.backlog ?? []).findIndex(item => item.id === backlogItemId);
                   if (backlogItemIndex === -1) {
                       console.error("Backlog item not found:", backlogItemId);
                       // Don't show toast here, maybe already removed?
                       return p; // Return unchanged project
                   }

                   const backlogItem = p.backlog![backlogItemIndex];
                   movedItemDetails = `${backlogItem.backlogId} (${backlogItem.title || 'No Title'})`; // For toast message

                   const targetSprintIndex = (p.sprintData.sprints ?? []).findIndex(s => s.sprintNumber === targetSprintNumber);
                   if (targetSprintIndex === -1) {
                        console.error("Target sprint not found:", targetSprintNumber);
                        toast({ variant: "destructive", title: "Error", description: "Target sprint not found." });
                        return p; // Return unchanged project
                   }

                   // Create the task for the sprint
                   const sprintTask: Task = {
                       ...backlogItem,
                       id: `sprint_task_${Date.now()}_${Math.random()}`, // New ID for the sprint task instance
                       status: 'To Do', // Set initial status for sprint
                       startDate: undefined, // Sprint start date is set during planning
                       devEstimatedTime: backlogItem.devEstimatedTime ?? '', // Carry over estimates if they exist, else empty
                       qaEstimatedTime: backlogItem.qaEstimatedTime ?? '2d', // Default QA time
                       bufferTime: backlogItem.bufferTime ?? '1d', // Default Buffer time
                       // Carry over other relevant fields if needed (assignee, reviewer, etc.)
                       assignee: backlogItem.assignee,
                       reviewer: backlogItem.reviewer,
                       // Clear backlog-specific fields that shouldn't be in sprint context
                       // taskType: undefined, // Keep taskType for history? Decide later.
                       // createdDate: undefined, // Keep createdDate? Decide later.
                       initiator: backlogItem.initiator, // Keep initiator
                       movedToSprint: undefined, // Clear movedToSprint for sprint task
                       historyStatus: undefined, // Clear history status for sprint task
                        needsGrooming: undefined, // Clear flag
                        readyForSprint: undefined, // Clear flag
                        backlogId: backlogItem.backlogId ?? '', // Ensure backlogId
                   };

                   // Instead of removing, update the item in backlog to mark it as moved
                   const updatedBacklog = p.backlog!.map((item, index) => {
                       if (index === backlogItemIndex) {
                           return { ...item, movedToSprint: targetSprintNumber, historyStatus: 'Move' as HistoryStatus }; // Set history status to 'Move'
                       }
                       return item;
                   });

                   // Add item to the target sprint's newTasks
                   const updatedSprints = [...p.sprintData.sprints];
                   const targetSprint = updatedSprints[targetSprintIndex];
                   const updatedPlanning = {
                       ...(targetSprint.planning ?? initialSprintPlanning),
                       newTasks: [...(targetSprint.planning?.newTasks ?? []), sprintTask],
                   };
                   updatedSprints[targetSprintIndex] = { ...targetSprint, planning: updatedPlanning };

                   return {
                       ...p,
                       backlog: updatedBacklog, // Save the updated backlog
                       sprintData: {
                           ...p.sprintData,
                           sprints: updatedSprints,
                       }
                   };
               }
               return p;
           });
           return updatedProjects;
       });

       if (movedItemDetails) {
         toast({ title: "Item Moved", description: `Backlog item '${movedItemDetails}' moved to Sprint ${targetSprintNumber}. Marked in backlog.` });
       }
   }, [selectedProjectId, toast]);


   // Handler to revert a task from sprint planning back to the backlog
   const handleRevertTaskToBacklog = useCallback((sprintNumber: number, taskId: string, taskBacklogId: string | undefined) => {
        if (!selectedProjectId) {
            toast({ variant: "destructive", title: "Error", description: "No project selected." });
            return;
        }

        let revertedTaskDetails: string | null = null;
        let updatePerformed = false; // Track if an update actually happened

        // Use setTimeout to ensure toast is shown after state update attempt
        const showToast = (options: any) => setTimeout(() => toast(options), 0);

        setProjects(prevProjects => {
            const updatedProjects = prevProjects.map(p => {
                if (p.id === selectedProjectId) {
                    let foundAndRemoved = false;
                    let taskToRemoveDetails: Partial<Task> = {};
                    let originalProject = p; // Keep reference to original project state for toast

                    // Find the task in the specified sprint's planning.newTasks
                    let targetSprintIndex = p.sprintData.sprints.findIndex(s => s.sprintNumber === sprintNumber);
                    if (targetSprintIndex === -1) {
                        console.warn(`Sprint ${sprintNumber} not found.`);
                         showToast({ variant: "warning", title: "Sprint Not Found", description: `Could not find Sprint ${sprintNumber}.` });
                         return originalProject;
                    }

                    let targetSprint = p.sprintData.sprints[targetSprintIndex];
                    let updatedNewTasks = [...(targetSprint.planning?.newTasks || [])];
                    let taskIndex = updatedNewTasks.findIndex(t => t.id === taskId);

                    if (taskIndex !== -1) {
                        const taskToRemove = updatedNewTasks[taskIndex];
                        taskToRemoveDetails = { ...taskToRemove }; // Capture details before removing
                         // Use backlog ID if available, otherwise ticket number
                         revertedTaskDetails = `${taskToRemove.backlogId || taskToRemove.ticketNumber} (${taskToRemove.title || 'No Title'})`;
                         foundAndRemoved = true;
                        updatedNewTasks.splice(taskIndex, 1); // Remove the task
                    } else {
                          console.warn(`Task ID ${taskId} not found in Sprint ${sprintNumber} new tasks.`);
                          showToast({ variant: "warning", title: "Task Not Found", description: `Could not find task ID ${taskId} in Sprint ${sprintNumber} planning.` });
                          return originalProject; // Return original project state
                    }

                     // If the task wasn't found in the sprint, no need to update backlog (handled above)


                    // Update the sprint with the modified tasks
                    const updatedSprints = [...p.sprintData.sprints];
                    updatedSprints[targetSprintIndex] = {
                        ...targetSprint,
                        planning: {
                            ...(targetSprint.planning || initialSprintPlanning),
                            newTasks: updatedNewTasks,
                        }
                    };

                    // Find the corresponding item in the backlog and reset its 'movedToSprint' status
                    const updatedBacklog = (p.backlog || []).map(item => {
                        // Match primarily using taskBacklogId if available, otherwise try matching by ticketNumber if backlogId is missing
                         const isMatch = taskBacklogId ? item.backlogId === taskBacklogId : item.ticketNumber === taskToRemoveDetails.ticketNumber;

                         if (isMatch && item.movedToSprint === sprintNumber && item.historyStatus === 'Move') {
                            updatePerformed = true; // Mark that we found and updated the backlog item
                            return { ...item, movedToSprint: undefined, historyStatus: undefined }; // Reset movedToSprint and historyStatus
                         }
                         return item;
                    });

                     // If the backlog item was not found to be updated (e.g., it was manually deleted from backlog), show a warning
                     if (!updatePerformed) {
                         console.warn(`Could not find corresponding backlog item for task ${revertedTaskDetails} (Backlog ID: ${taskBacklogId}) that was marked as moved to sprint ${sprintNumber}. Task removed from sprint only.`);
                         showToast({ variant: "warning", title: "Task Removed from Sprint", description: `Task '${revertedTaskDetails}' removed from Sprint ${sprintNumber}, but its corresponding backlog item couldn't be updated (may have been deleted or modified).` });
                     } else {
                         showToast({ title: "Task Reverted", description: `Task '${revertedTaskDetails}' removed from Sprint ${sprintNumber} and returned to backlog.` });
                     }

                    return {
                        ...p,
                        backlog: updatedBacklog,
                        sprintData: {
                            ...p.sprintData,
                            sprints: updatedSprints,
                        }
                    };
                }
                return p;
            });
            return updatedProjects;
        });
    }, [selectedProjectId, toast, setProjects]); // Include setProjects


    // Handler to split a backlog item
    const handleSplitBacklogItem = useCallback((originalTaskId: string, splitTasks: Task[]) => {
        if (!selectedProjectId) {
            toast({ variant: "destructive", title: "Error", description: "No project selected." });
            return;
        }

        let originalTaskDetails: string | null = null;
        let newIds: string[] = [];

        setProjects(prevProjects => {
            const updatedProjects = prevProjects.map(p => {
                if (p.id === selectedProjectId) {
                    const originalBacklogIndex = (p.backlog ?? []).findIndex(item => item.id === originalTaskId);
                    if (originalBacklogIndex === -1) {
                        console.error("Original backlog item not found for splitting:", originalTaskId);
                        toast({ variant: "destructive", title: "Error", description: "Original item not found." });
                        return p;
                    }

                    const originalItem = p.backlog![originalBacklogIndex];
                    originalTaskDetails = `${originalItem.backlogId} (${originalItem.title || 'No Title'})`;

                    // 1. Mark the original item with 'Split' status in history
                    const markedOriginalItem = {
                        ...originalItem,
                        historyStatus: 'Split' as HistoryStatus,
                        movedToSprint: undefined, // Ensure it's not marked as moved to a sprint
                        splitFromId: undefined, // Original items don't have this
                    };

                     // 2. Prepare new split tasks with unique IDs and backlog IDs
                     const allItemsForIdGen = [...(p.backlog || []), ...splitTasks]; // Include potential new tasks for ID uniqueness check

                     const newSplitTasksWithIds = splitTasks.map((task, index) => {
                         // Split results now get their own unique, standard IDs
                         const suffix = String.fromCharCode(97 + index); // 'a', 'b', 'c'...
                         const newSplitBacklogId = `${originalItem.backlogId}-${suffix}`;

                         return {
                           ...task,
                           id: `split_${originalTaskId}_${newSplitBacklogId}_${Date.now()}`, // Use new backlog ID in unique ID
                           backlogId: newSplitBacklogId, // Assign generated suffixed ID
                           ticketNumber: newSplitBacklogId, // Default ticket number
                           needsGrooming: true, // Mark as needing grooming
                           readyForSprint: false, // Mark as not ready
                           splitFromId: originalItem.id, // Link back to the original task ID
                         };
                     });


                     newIds = newSplitTasksWithIds.map(t => t.backlogId || t.id); // Store new IDs for toast

                    // 3. Update the backlog array: Replace original with historical, add new splits
                    const updatedBacklog = [
                        ...(p.backlog?.slice(0, originalBacklogIndex) ?? []),
                        markedOriginalItem, // Keep historical original
                        ...newSplitTasksWithIds, // Add new split tasks
                        ...(p.backlog?.slice(originalBacklogIndex + 1) ?? []),
                    ];

                    return {
                        ...p,
                        backlog: updatedBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? '')), // Re-sort backlog
                    };
                }
                return p;
            });
            return updatedProjects;
        });

        if (originalTaskDetails) {
            toast({
                title: "Item Split",
                description: `Backlog item '${originalTaskDetails}' marked as Split. New items added: ${newIds.join(', ')}.`,
                duration: 5000,
            });
        }
    }, [selectedProjectId, toast]); // Removed generateNextBacklogId dependency


    // Handler to merge backlog items
    const handleMergeBacklogItems = useCallback((taskIdsToMerge: string[], mergedTask: Task) => {
       if (!selectedProjectId) {
         toast({ variant: "destructive", title: "Error", description: "No project selected." });
         return;
       }
       if (taskIdsToMerge.length < 2) {
          toast({ variant: "destructive", title: "Error", description: "At least two items must be selected for merging." });
          return;
       }

       const mergeEventId = `merge_${Date.now()}`; // Generate a unique ID for this merge event
       let mergedItemDetails: string[] = [];

       setProjects(prevProjects => {
          const updatedProjects = prevProjects.map(p => {
             if (p.id === selectedProjectId) {
                let updatedBacklog = [...(p.backlog ?? [])];
                const itemsToMarkHistorical: Task[] = [];
                let firstOriginalBacklogId: string | undefined = undefined;

                // Mark original items as merged
                updatedBacklog = updatedBacklog.map(item => {
                   if (taskIdsToMerge.includes(item.id)) {
                        if (!firstOriginalBacklogId) {
                           firstOriginalBacklogId = item.backlogId; // Capture the first original ID for naming convention
                        }
                       mergedItemDetails.push(`${item.backlogId} (${item.title || 'No Title'})`);
                       itemsToMarkHistorical.push({
                           ...item,
                           historyStatus: 'Merge' as HistoryStatus,
                           movedToSprint: undefined, // Ensure not marked as moved
                           mergeEventId: mergeEventId, // Link to the merge event
                       });
                       return null; // Mark for removal from active backlog later
                   }
                   return item;
                }).filter((item): item is Task => item !== null); // Remove the original items from active view

                // Generate the new merged backlog ID
                const newMergedBacklogId = `${firstOriginalBacklogId || 'merged'}-m`; // Use first original ID + '-m'

                const newMergedTaskWithId: Task = {
                   ...mergedTask,
                   id: `merged_${Date.now()}_${Math.random()}`, // Generate unique ID
                   backlogId: newMergedBacklogId, // Assign merged ID
                   ticketNumber: newMergedBacklogId, // Default ticket number
                   needsGrooming: true,
                   readyForSprint: false,
                   mergeEventId: mergeEventId, // Link the resulting merged item to the event
                };

                // Combine active backlog, new merged task, and historical items
                 const finalBacklog = [
                    ...updatedBacklog,
                    newMergedTaskWithId,
                    ...itemsToMarkHistorical
                 ];

                return {
                   ...p,
                   backlog: finalBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? '')), // Re-sort
                };
             }
             return p;
          });
          return updatedProjects;
       });

        toast({
            title: "Items Merged",
            description: `Items [${mergedItemDetails.join(', ')}] marked as Merged. New item '${mergedTask.title}' created.`,
            duration: 5000,
        });

    }, [selectedProjectId, toast]); // Removed generateNextBacklogId dependency

    // Handler to undo a backlog action (Split/Merge)
     const handleUndoBacklogAction = useCallback((taskId: string) => {
         if (!selectedProjectId) {
             toast({ variant: "destructive", title: "Error", description: "No project selected." });
             return;
         }

         let undoneActionType: HistoryStatus | undefined;
         let undoneItemDetails: string | null = null;
         let restoredItemIds: string[] = [];
         let removedItemIds: string[] = [];
         let actionSuccess = false; // Track if the undo logic successfully modified state

          // Defer toast to avoid render interference
         const showToast = (options: any) => setTimeout(() => toast(options), 50);

         setProjects(prevProjects => {
             let projectUpdated = false;
             const updatedProjects = prevProjects.map(p => {
                 if (p.id === selectedProjectId) {
                     let updatedBacklog = [...(p.backlog || [])];
                     const triggerItem = updatedBacklog.find(item => item.id === taskId);

                     if (!triggerItem) {
                         console.error("Undo Trigger item not found:", taskId);
                         showToast({ variant: "destructive", title: "Error", description: "Cannot perform undo: Item not found." });
                         return p;
                     }

                      // Enhanced logging for debugging
                      console.log("Attempting to undo action for item:", triggerItem);

                     let originalItemToRestore: Task | undefined;
                     let itemsToRemove: Task[] = [];
                     let itemsToRestore: Task[] = [];
                     let mergeEventId: string | undefined;

                     // Determine action and related items based on the *trigger item*
                     if (triggerItem.historyStatus === 'Split') { // Undoing original historical Split item
                         undoneActionType = 'Split';
                         originalItemToRestore = triggerItem; // This is the item to restore
                         itemsToRemove = updatedBacklog.filter(item => item.splitFromId === originalItemToRestore!.id); // Find results by splitFromId
                     } else if (triggerItem.historyStatus === 'Merge') { // Undoing original historical Merge item
                         undoneActionType = 'Merge';
                         mergeEventId = triggerItem.mergeEventId;
                         if (!mergeEventId) {
                             console.error("Cannot undo merge: Missing mergeEventId on historical item", taskId);
                             showToast({ variant: "destructive", title: "Error", description: "Cannot undo merge action (missing link)." });
                             return p;
                         }
                         // Find the resulting merged item and the original items using the mergeEventId
                         itemsToRemove = updatedBacklog.filter(item => item.mergeEventId === mergeEventId && !item.historyStatus); // The non-historical item with the event ID is the result
                         itemsToRestore = updatedBacklog.filter(item => item.mergeEventId === mergeEventId && item.historyStatus === 'Merge'); // Original items have status 'Merge' and the event ID
                     } else if (triggerItem.splitFromId) { // Undoing a resulting Split item
                         undoneActionType = 'Split';
                         // Find the original historical item that was split
                         originalItemToRestore = updatedBacklog.find(item => item.id === triggerItem.splitFromId && item.historyStatus === 'Split');
                         if (!originalItemToRestore) {
                             console.error("Cannot undo split: Original item not found for split item", taskId);
                             showToast({ variant: "destructive", title: "Error", description: "Cannot undo split action (original missing)." });
                             return p;
                         }
                         // Find all items resulting from that split (including the trigger item itself)
                         itemsToRemove = updatedBacklog.filter(item => item.splitFromId === originalItemToRestore!.id);
                     } else if (triggerItem.mergeEventId && !triggerItem.historyStatus) { // Undoing a resulting Merge item
                         undoneActionType = 'Merge';
                         mergeEventId = triggerItem.mergeEventId;
                         itemsToRemove = [triggerItem]; // The item itself is the result to remove
                         itemsToRestore = updatedBacklog.filter(item => item.mergeEventId === mergeEventId && item.historyStatus === 'Merge'); // Find originals via event ID
                     } else {
                         console.error("Item not eligible for undo:", taskId, triggerItem);
                         showToast({ variant: "destructive", title: "Error", description: "Cannot undo this action (item not eligible)." });
                         return p;
                     }


                     // Set details for toast message based on the action type and trigger item
                     if (undoneActionType === 'Split') {
                        undoneItemDetails = originalItemToRestore ? `${originalItemToRestore.backlogId} (${originalItemToRestore.title || 'No Title'})` : `Split items related to ${triggerItem.backlogId}`;
                     } else if (undoneActionType === 'Merge') {
                        undoneItemDetails = mergeEventId ? `Merged Items (Event: ${mergeEventId})` : `Merge related to ${triggerItem.backlogId}`;
                     }


                     // Perform the updates only if an action type was determined
                     if (undoneActionType) {
                         projectUpdated = true;
                         actionSuccess = true; // Assume success unless checks fail

                         // IDs of items to be removed
                         const removedIdsSet = new Set(itemsToRemove.map(t => t.id));
                         removedItemIds = itemsToRemove.map(t => t.backlogId || t.id); // Store IDs for toast

                         // Filter out the items created by the action
                         updatedBacklog = updatedBacklog.filter(item => !removedIdsSet.has(item.id));


                         // IDs of items to be restored (either original split parent or original merge children)
                         const itemsToMakeActive = undoneActionType === 'Split' ? [originalItemToRestore] : itemsToRestore;
                         const restoredIdsSet = new Set(itemsToMakeActive.filter(Boolean).map(t => t!.id));
                         restoredItemIds = itemsToMakeActive.filter(Boolean).map(t => t!.backlogId || t!.id); // Store IDs for toast

                         // Restore original items: Remove historyStatus and related IDs
                         updatedBacklog = updatedBacklog.map(item => {
                             if (restoredIdsSet.has(item.id)) {
                                  console.log("Restoring item:", item.id, item.backlogId);
                                 return { ...item, historyStatus: undefined, splitFromId: undefined, mergeEventId: undefined, movedToSprint: undefined };
                             }
                             return item;
                         });

                          // Validation checks
                         if (undoneActionType === 'Merge' && itemsToRestore.length === 0 && mergeEventId) {
                             console.error(`Undo Merge: Could not find original items for mergeEventId ${mergeEventId}`);
                              showToast({ variant: "warning", title: "Undo Incomplete", description: "Could not restore original merged items." });
                              actionSuccess = false;
                              return p; // Revert state change
                         }
                         if (itemsToRemove.length === 0 && (undoneActionType === 'Split' || undoneActionType === 'Merge')) {
                              console.warn(`Undo ${undoneActionType}: Could not find the resulting item(s) to remove. Originals restored.`);
                              showToast({ variant: "warning", title: "Undo Warning", description: `Resulting ${undoneActionType === 'Split' ? 'split' : 'merged'} item(s) not found, originals restored.` });
                         }

                         return {
                             ...p,
                             backlog: updatedBacklog.sort((a, b) => (taskPriorities.indexOf(a.priority!) - taskPriorities.indexOf(b.priority!)) || (a.backlogId ?? '').localeCompare(b.backlogId ?? '')),
                         };
                     } else {
                         // Should not reach here if logic above is correct, but acts as a safeguard
                         console.error("Undo Error: Could not determine action type for item", taskId);
                         showToast({ variant: "destructive", title: "Undo Failed", description: "Could not process the undo request." });
                         return p;
                     }
                 }
                 return p;
             });

              // Show appropriate toast after the state update attempt
             if (actionSuccess && undoneItemDetails && undoneActionType) {
                 const restoredCount = restoredItemIds.length;
                 const removedCount = removedItemIds.length;
                 showToast({
                     title: `${undoneActionType} Undone`,
                     description: `Action related to '${undoneItemDetails}' undone. ${restoredCount} item(s) restored, ${removedCount} item(s) removed.`,
                     duration: 5000,
                 });
              } else if (!actionSuccess && undoneActionType) {
                  // Toast for failure might have already been shown, but add a generic one if needed
                  // showToast({ variant: "destructive", title: "Undo Failed", description: "The undo operation could not be completed." });
              }


             return projectUpdated ? updatedProjects : prevProjects; // Return original state if no update occurred
         });

     }, [selectedProjectId, toast, setProjects]); // Added setProjects dependency


  // Handler to add members to the *newly created* project (from dialog)
   const handleAddMembersToNewProject = useCallback((addedMembers: Member[]) => {
       if (!newlyCreatedProjectId) return;
       let newProjectName = 'the new project';

        // Wrap state updates in setTimeout to defer execution
        setTimeout(() => {
            setProjects(prevProjects => {
              const updatedProjects = prevProjects.map(p => {
                if (p.id === newlyCreatedProjectId) {
                  newProjectName = p.name; // Capture name
                  return { ...p, members: [...(p.members || []), ...addedMembers] };
                }
                return p;
              });
              return updatedProjects;
            });
            toast({ title: "Members Added", description: `Members added to project '${newProjectName}'.` });
            setIsAddMembersDialogOpen(false); // Close the dialog
            setNewlyCreatedProjectId(null); // Reset the tracked ID
        }, 0); // Use 0 timeout to push to the end of the event loop

   }, [newlyCreatedProjectId, toast, setProjects, setIsAddMembersDialogOpen, setNewlyCreatedProjectId]); // Include state setters in dependency array if ESLint requires

  // Handler to delete a sprint
  const handleDeleteSprint = useCallback((sprintNumber: number) => {
    if (!selectedProjectId) {
      toast({ variant: "destructive", title: "Error", description: "No project selected." });
      return;
    }
    let currentProjectName = 'N/A';
    setProjects(prevProjects => {
      const updatedProjects = prevProjects.map(p => {
        if (p.id === selectedProjectId) {
          currentProjectName = p.name; // Capture name
          const filteredSprints = (p.sprintData.sprints ?? []).filter(s => s.sprintNumber !== sprintNumber); // Handle null/undefined
          return {
            ...p,
            sprintData: {
              ...(p.sprintData ?? initialSprintData), // Use initialSprintData if sprintData is null/undefined
              sprints: filteredSprints,
              // Recalculate overall metrics if needed
              totalStoryPoints: filteredSprints.reduce((sum, s) => sum + s.completedPoints, 0),
              daysInSprint: filteredSprints.length > 0 ? Math.max(...filteredSprints.map(s => s.totalDays)) : 0,
            },
          };
        }
        return p;
      });
      return updatedProjects;
    });
    toast({ title: "Sprint Deleted", description: `Sprint ${sprintNumber} deleted from project '${currentProjectName}'.` });
  }, [selectedProjectId, toast]);


  // Export data for the currently selected project
  const handleExport = () => {
    if (!selectedProject || (!selectedProject.sprintData?.sprints?.length && !selectedProject.members?.length && !selectedProject.holidayCalendars?.length && !selectedProject.teams?.length && !selectedProject.backlog?.length)) {
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
       if (selectedProject.sprintData?.sprints?.length > 0) {
           const summaryData = selectedProject.sprintData.sprints.map(s => ({
             'SprintNumber': s.sprintNumber,
             'StartDate': s.startDate,
             'EndDate': s.endDate,
             'Duration': s.duration,
             'Status': s.status,
             'TotalCommitment': s.committedPoints,
             'TotalDelivered': s.completedPoints,
           }));
           const wsSummary = XLSX.utils.json_to_sheet(summaryData);
           XLSX.utils.book_append_sheet(wb, wsSummary, 'Sprint Summary');
       }

       // Planning Sheets (Summary and Tasks)
       const planningExists = selectedProject.sprintData?.sprints?.some(s => s.planning && (s.planning.goal || s.planning.newTasks?.length > 0 || s.planning.spilloverTasks?.length > 0 || s.planning.definitionOfDone || s.planning.testingStrategy));
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
                   // Helper function to map task to export row
                    const mapTaskToRow = (task: Task, type: 'New' | 'Spillover') => ({
                      'SprintNumber': sprint.sprintNumber,
                      'Type': type,
                      'TaskID': task.id,
                      'TicketNumber': task.ticketNumber, // Use ticketNumber
                      'BacklogID': task.backlogId, // Include backlog ID
                      'Title': task.title,
                      'Description': task.description,
                      'StoryPoints': task.storyPoints,
                      'DevEstTime': task.devEstimatedTime,
                      'QAEstTime': task.qaEstimatedTime,
                      'BufferTime': task.bufferTime,
                      'Assignee': task.assignee,
                      'Reviewer': task.reviewer,
                      'Status': task.status,
                      'StartDate': task.startDate,
                      'Priority': task.priority,
                    });


                   (sprint.planning.newTasks || []).forEach(task => planningTasksData.push(mapTaskToRow(task, 'New')));
                    (sprint.planning.spilloverTasks || []).forEach(task => planningTasksData.push(mapTaskToRow(task, 'Spillover')));
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

        // Backlog Sheet
        if (selectedProject.backlog && selectedProject.backlog.length > 0) {
            const backlogData = selectedProject.backlog.map(task => ({
                'BacklogItemID': task.id,
                'BacklogID': task.backlogId,
                'Title': task.title,
                'Description': task.description,
                'TaskType': task.taskType,
                'Priority': task.priority,
                'Initiator': task.initiator,
                'CreatedDate': task.createdDate,
                'StoryPoints': task.storyPoints,
                'DependsOn': (task.dependsOn || []).join(', '), // Flatten dependency array
                'MovedToSprint': task.movedToSprint ?? '', // Add movedToSprint history
                'HistoryStatus': task.historyStatus ?? '', // Add history status
                 'NeedsGrooming': task.needsGrooming ? 'Yes' : 'No', // Add flag
                 'ReadyForSprint': task.readyForSprint ? 'Yes' : 'No', // Add flag
                  'SplitFromID': task.splitFromId ?? '', // Export split info
                  'MergeEventID': task.mergeEventId ?? '', // Export merge info
                 // Other backlog specific fields if needed
            }));
            const wsBacklog = XLSX.utils.json_to_sheet(backlogData);
            XLSX.utils.book_append_sheet(wb, wsBacklog, 'Backlog');
        }

       // Members Sheet
       if (selectedProject.members && selectedProject.members.length > 0) {
            const membersData = selectedProject.members.map(m => ({
                'MemberID': m.id,
                'Name': m.name,
                'Role': m.role,
                'HolidayCalendarID': m.holidayCalendarId, // Added holiday calendar ID
            }));
            const wsMembers = XLSX.utils.json_to_sheet(membersData);
            XLSX.utils.book_append_sheet(wb, wsMembers, 'Members');
       }

       // Holiday Calendars Sheet
       if (selectedProject.holidayCalendars && selectedProject.holidayCalendars.length > 0) {
           const calendarsData: any[] = [];
           selectedProject.holidayCalendars.forEach(cal => {
               cal.holidays.forEach(holiday => {
                  calendarsData.push({
                      'CalendarID': cal.id,
                      'CalendarName': cal.name,
                      'CountryCode': cal.countryCode,
                      'HolidayID': holiday.id,
                      'HolidayName': holiday.name,
                      'HolidayDate': holiday.date,
                  });
               });
               // Add row for calendar itself if it has no holidays
               if (cal.holidays.length === 0) {
                   calendarsData.push({
                       'CalendarID': cal.id,
                       'CalendarName': cal.name,
                       'CountryCode': cal.countryCode,
                       'HolidayID': '',
                       'HolidayName': '',
                       'HolidayDate': '',
                   });
               }
           });
            const wsHolidays = XLSX.utils.json_to_sheet(calendarsData);
            XLSX.utils.book_append_sheet(wb, wsHolidays, 'Holiday Calendars');
       }

        // Teams Sheet
        if (selectedProject.teams && selectedProject.teams.length > 0) {
            const teamsData: any[] = [];
            selectedProject.teams.forEach(team => {
                team.members.forEach(tm => {
                    teamsData.push({
                        'TeamID': team.id,
                        'TeamName': team.name,
                        'LeadMemberID': team.leadMemberId,
                        'MemberID': tm.memberId,
                    });
                });
                 // Add row for team itself if it has no members
                 if (team.members.length === 0) {
                    teamsData.push({
                        'TeamID': team.id,
                        'TeamName': team.name,
                        'LeadMemberID': team.leadMemberId,
                        'MemberID': '',
                    });
                 }
            });
            const wsTeams = XLSX.utils.json_to_sheet(teamsData);
            XLSX.utils.book_append_sheet(wb, wsTeams, 'Teams');
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
      holidayCalendars: [], // Initialize with empty holiday calendars
      teams: [], // Initialize with empty teams array
      backlog: [], // Initialize with empty backlog array
    };

    // Update projects state first
    setProjects(prevProjects => [...prevProjects, newProject]);
    setSelectedProjectId(newProject.id);
    setNewProjectName('');
    setIsNewProjectDialogOpen(false);
    setNewlyCreatedProjectId(newProject.id); // Track the new project ID for dialog
    setActiveTab("dashboard"); // Set dashboard as active after creating

    // Defer the toast and dialog opening slightly
     setTimeout(() => {
        toast({ title: "Project Created", description: `Project "${trimmedName}" created successfully.` });
        setIsAddMembersDialogOpen(true); // Open the dialog AFTER state update
    }, 50); // Increased timeout slightly
  };

   // Handler to open the delete project confirmation dialog
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

       setProjects(prevProjects => prevProjects.filter(p => p.id !== projectToDeleteId));

       // If the deleted project was the selected one, select the first available project or null
       if (selectedProjectId === projectToDeleteId) {
           setSelectedProjectId(projects.length > 1 ? projects.find(p => p.id !== projectToDeleteId)?.id ?? null : null);
       }

       toast({ title: "Project Deleted", description: `Project "${project.name}" has been deleted.` });
       setIsDeleteDialogOpen(false);
       setProjectToDeleteId(null);
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
                    members: selectedProject.members ?? [],
                    sprints: selectedProject.sprintData.sprints ?? [],
                    onMoveToSprint: handleMoveToSprint,
                    generateNextBacklogId: generateNextBacklogIdHelper, // Pass the helper
                 };
                break;
            case 'backlog/grooming':
                componentProps = {
                     ...componentProps,
                     initialBacklog: selectedProject.backlog ?? [], // Pass full backlog
                      // Grooming usually modifies existing items, so reuse update handler or create specific one
                      onSaveBacklog: (groomedBacklog: Task[]) => {
                          // Determine which items were updated in grooming
                          const updatedIds = new Set(groomedBacklog.filter(t => !t.historyStatus).map(t => t.id));
                          const combined = [
                              ...groomedBacklog, // Groomed items (may include newly marked historical)
                              ...(selectedProject.backlog?.filter(t => t.historyStatus && !groomedBacklog.some(gt => gt.id === t.id)) || []) // Keep existing historical not touched in grooming
                          ];
                           setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, backlog: combined } : p));
                           toast({ title: "Backlog Groomed", description: "Changes saved." });
                      },
                     onSplitBacklogItem: handleSplitBacklogItem, // Pass split handler
                     onMergeBacklogItems: handleMergeBacklogItems, // Pass merge handler
                     onUndoBacklogAction: handleUndoBacklogAction, // Pass undo handler
                     allProjectBacklogItems: selectedProject.backlog ?? [], // Pass all items for uniqueness check
                 };
                break;
             case 'backlog/history': // Updated sub-tab path
                componentProps = {
                    ...componentProps,
                    historyItems: selectedProject.backlog?.filter(task => !!task.historyStatus) ?? [], // Pass items with history status
                    onUndoBacklogAction: handleUndoBacklogAction, // Pass undo handler
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
            <h1 className="text-2xl font-semibold text-primary">Project Prism</h1>
             <Select
               value={selectedProjectId ?? undefined}
               onValueChange={(value) => {
                  if (value === 'loading') return; // Prevent selecting the loading indicator
                   console.log(`Project selected: ${value}`);
                   setSelectedProjectId(value);
                   setActiveTab("dashboard"); // Reset to dashboard tab on project change
               }}
               disabled={isLoading || projects.length === 0} // Disable while loading or if no projects
             >
                <SelectTrigger className="w-[200px]"> {/* Increased width */}
                  <SelectValue placeholder={isLoading ? "Loading..." : "Select a project"} />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Projects</SelectLabel>
                        {isLoading ? (
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
          {selectedProject && (selectedProject.sprintData?.sprints?.length > 0 || selectedProject.members?.length > 0 || selectedProject.holidayCalendars?.length > 0 || selectedProject.teams?.length > 0 || selectedProject.backlog?.length > 0) && (
            <Button onClick={handleExport} variant="outline" size="sm">
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
                       disabled={confirmProjectName.trim().toLowerCase() !== (projects.find(p => p.id === projectToDeleteId)?.name.toLowerCase() ?? ' ')}
                       className={cn(buttonVariants({ variant: "destructive" }))}
                   >
                       Delete Project
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
         {isLoading ? (
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
                {selectedProject ? (
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
                 ) : (
                    // Render the "No Project Selected" card if no project is selected
                     <Card className="flex flex-col items-center justify-center min-h-[400px] border-dashed border-2 mt-4">
                        <CardHeader className="text-center">
                           <CardTitle>No Project Selected</CardTitle>
                           <CardDescription>Please select a project from the dropdown above, or create a new one.</CardDescription>
                        </CardHeader>
                         <CardContent>
                             {/* Optional: Add a button or link to create a new project */}
                         </CardContent>
                     </Card>
                 )}
             </Tabs>
          )}
      </main>

      <footer className="text-center p-4 text-xs text-muted-foreground border-t">
          Project Prism - Agile Reporting Made Easy
      </footer>
    </div>
  );

}
