'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react'; // Added useRef, React
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'; // Added CardContent
import {
  Download,
  BarChart,
  ListPlus,
  PlusCircle,
  NotebookPen,
  Users,
  Trash2,
  CalendarDays,
  Edit,
  UsersRound,
  Package,
  LayoutDashboard,
  IterationCw,
  Layers,
  BarChartBig,
  Settings,
  Eye,
  GitCommitVertical,
  History,
  Loader2,
  AlertTriangle,
  ClipboardCheck,
} from 'lucide-react'; // Added ArrowUpDown, ListChecks icons, Loader2, AlertTriangle, ClipboardCheck
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'; // Import AlertDialog components

// Main Content Components (Tabs) - Renamed and New Placeholders
import DashboardTab from '@/components/backlog/dashboard-tab'; // Renamed from HomeTab
import RiskTab from '@/components/risk/risk-tab'; // New component
import EvaluationTab from '@/components/evaluation/evaluation-tab'; // New component

// Sprint Sub-Tab Components
import SprintSummaryTab from '@/components/sprints/sprint-summary-tab'; // Updated path
import SprintPlanningTab from '@/components/sprints/sprint-planning-tab'; // New component for planning
import SprintRetrospectiveTab from '@/components/sprints/sprint-retrospective-tab'; // Updated path

// Backlog Sub-Tab Components
import BacklogTab from '@/components/backlog/backlog-tab'; // Updated path
import BacklogGroomingTab from '@/components/backlog/backlog-grooming-tab'; // Corrected import path
import HistoryTab from '@/components/backlog/history-tab'; // Import HistoryTab component

// Settings Sub-tab Components (Moved from Teams)
import MembersTab from '@/components/settings/members-tab'; // Updated path
import TeamsTab from '@/components/settings/teams-tab'; // Updated path
import HolidaysTab from '@/components/settings/holidays-tab'; // Updated path
import AddMembersDialog from '@/components/dialogs/add-members-dialog';

// Analytics Sub-Tab Components
import AnalyticsChartsTab from '@/components/analytics/analytics-charts-tab';
import AnalyticsReportsTab from '@/components/analytics/analytics-reports-tab'; // Updated path

import type { Project, Member, Task, ToastFun } from '@/types/sprint-data'; // Added HistoryStatus, ToastFun
import { initialSprintData } from '@/types/sprint-data'; // Import taskPriorities
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSprintsActions } from '@/hooks/use-sprints-actions'; // Import the new hook
import { useBacklogActions } from '@/hooks/use-backlog-actions';
import { useSettingsActions } from '@/hooks/use-settings-actions'; // Import the new hook for settings
import { generateNextBacklogIdHelper } from '@/lib/utils'; // Import the helper function
import { ModeToggle } from '@/components/mode-toggle'; // Import ModeToggle
import {
  useProjects,
  useUpdateProject,
  useDeleteProject,
} from '@/hooks/use-projects'; // Import React Query hooks
import { handleExport } from '@/lib/export';
import { auth } from '@/lib/firebase'; // Import auth
import { onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged
import { useRouter } from 'next/navigation'; // Import useRouter
import QueryProvider from '@/components/query-provider'; // Import QueryProvider

// Wrap the main export with QueryProvider
export default function PrismPageWrapper() {
  return (
    <QueryProvider>
      <PrismPage />
    </QueryProvider>
  );
}

function PrismPage() {
  const router = useRouter(); // Initialize router
  // Local UI state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] =
    useState<boolean>(false);
  const [isAddMembersDialogOpen, setIsAddMembersDialogOpen] =
    useState<boolean>(false);
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<
    string | null
  >(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(
    null
  );
  const [confirmProjectName, setConfirmProjectName] = useState<string>('');
  const [clientNow, setClientNow] = useState<Date | null>(null);
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // Track auth state

  // React Query hooks for data management
  const {
    data: projects = [],
    isLoading: isLoadingProjects,
    error: projectsError,
    isSuccess: isProjectsSuccess,
  } = useProjects();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  // Check auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        router.push('/'); // Redirect to landing if not authenticated
      }
    });
    return () => unsubscribe(); // Cleanup subscription
  }, [router]);

  // Get current date on client mount to avoid hydration issues
  useEffect(() => {
    setClientNow(new Date());
  }, []);

  // Effect to select the first project when data loads or changes, if none selected
  // Also show login success toast when projects are successfully loaded for the first time after auth
  const [loginToastShown, setLoginToastShown] = useState(false);
  useEffect(() => {
    if (isAuthenticated && isProjectsSuccess && !loginToastShown) {
      // Defer toast slightly to avoid potential conflict with dialog opening
      setTimeout(() => {
        toast({
          title: 'Login Successful',
          description: 'Welcome to Projects Prism!',
        });
        setLoginToastShown(true); // Ensure toast is shown only once per session
      }, 100);
    }

    if (!isLoadingProjects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
      console.log(
        'No project selected, defaulting to first project:',
        projects[0].id
      );
    } else if (!isLoadingProjects && projects.length === 0) {
      setSelectedProjectId(null); // Clear selection if no projects exist
    }
    // Do NOT reset selectedProjectId if it already exists and is valid within the loaded projects
  }, [
    isLoadingProjects,
    projects,
    selectedProjectId,
    isAuthenticated,
    isProjectsSuccess,
    loginToastShown,
    toast,
  ]);

  // Find the currently selected project object
  const selectedProject = useMemo(() => {
    const project = projects.find((p) => p.id === selectedProjectId) ?? null;
    console.log('Selected project determined:', project?.name ?? 'None');
    return project;
  }, [projects, selectedProjectId]);

  // Memoize the list of plannable sprints (Active or Planned) for the selected project
  const plannableSprints = useMemo(() => {
    if (!selectedProject) return [];
    return (selectedProject.sprintData?.sprints ?? []).filter(
      (s) => s.status === 'Active' || s.status === 'Planned'
    );
  }, [selectedProject]);

  // Define default sub-tabs for each main tab
  const defaultSubTabs: Record<string, string> = {
    sprints: 'summary',
    backlog: 'management',
    analytics: 'charts',
    settings: 'members', // Default to 'members' under settings now
    // Risk and Evaluation are main tabs without subtabs for now
  };

  // Derive activeMainTab from activeTab
  const activeMainTab = useMemo(() => {
    return activeTab.split('/')[0];
  }, [activeTab]);

  // Update activeTab logic for main tabs
  const handleMainTabChange = useCallback(
    (mainTabKey: string) => {
      // Handle main tabs that don't have sub-tabs directly
      if (['dashboard', 'risk', 'evaluation'].includes(mainTabKey)) {
        setActiveTab(mainTabKey);
      } else if (mainTabKey === 'sprints') {
        // If navigating to Sprints and there's only one plannable sprint, go directly to planning
        if (plannableSprints.length === 1) {
          setActiveTab('sprints/planning');
          // If you have a selectedSprintNumber state, you might want to set it here too
          // e.g., setSelectedSprintNumberForPlanning(plannableSprints[0].sprintNumber);
        } else {
          // Otherwise, go to the default sub-tab for Sprints (summary)
          setActiveTab(`sprints/${defaultSubTabs.sprints}`);
        }
      } else {
        const defaultSub = defaultSubTabs[mainTabKey] || ''; // Fallback to empty string if no default
        setActiveTab(`${mainTabKey}/${defaultSub}`);
      }
    },
    [plannableSprints, defaultSubTabs]
  ); // Add plannableSprints and defaultSubTabs to dependencies

  // Helper function to update project data via mutation
  const updateProjectData = useCallback(
    (updatedProject: Project) => {
      if (!updatedProject.id) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Project ID missing, cannot update.',
        });
        return;
      }
      updateProjectMutation.mutate(updatedProject, {
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Save Error',
            description: `Failed to save changes: ${error.message}`,
          });
        },
        // onSuccess is handled in the hook to invalidate query
      });
    },
    [updateProjectMutation, toast]
  );

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
    handleMoveSelectedBacklogItemsToSprint, // Get the updated function
    handleRevertTaskToBacklog,
    handleSplitBacklogItem,
    handleDeleteSavedBacklogItem,
    handleMergeBacklogItems,
    handleUndoBacklogAction,
  } = useBacklogActions({
    selectedProject,
    updateProjectData,
    toast,
    projects,
    selectedProjectId,
  });

  // Use the custom hook for settings actions
  const { handleSaveMembers, handleSaveHolidayCalendars, handleSaveTeams } =
    useSettingsActions({
      selectedProject,
      updateProjectData,
      toast,
    });

  // Handler to add members to the *newly created* project (from dialog)
  const handleAddMembersToNewProject = useCallback(
    (addedMembers: Member[]) => {
      if (!newlyCreatedProjectId) return;

      const projectToUpdate = projects.find(
        (p) => p.id === newlyCreatedProjectId
      );
      if (!projectToUpdate) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Newly created project not found.',
        });
        setIsAddMembersDialogOpen(false);
        setNewlyCreatedProjectId(null);
        return;
      }

      const updatedProject: Project = {
        ...projectToUpdate,
        members: [...(projectToUpdate.members || []), ...addedMembers],
      };

      updateProjectData(updatedProject); // Update via mutation

      toast({
        title: 'Members Added',
        description: `Members added to project '${projectToUpdate.name}'.`,
      });
      setIsAddMembersDialogOpen(false);
      setNewlyCreatedProjectId(null);
    },
    [
      newlyCreatedProjectId,
      projects,
      updateProjectData,
      toast,
      setIsAddMembersDialogOpen,
      setNewlyCreatedProjectId,
    ]
  );

  // Handle creating a new project
  const handleCreateNewProject = () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Project name cannot be empty.',
      });
      return;
    }
    if (
      projects.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Project with name "${trimmedName}" already exists.`,
      });
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
        setActiveTab('dashboard');

        // Defer the toast and dialog opening slightly
        setTimeout(() => {
          toast({
            title: 'Project Created',
            description: `Project "${trimmedName}" created successfully.`,
          });
          setIsAddMembersDialogOpen(true); // Open the dialog AFTER state update
        }, 50);
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Create Error',
          description: `Failed to create project: ${error.message}`,
        });
      },
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

    const project = projects.find((p) => p.id === projectToDeleteId);
    if (!project) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Project not found.',
      });
      setIsDeleteDialogOpen(false);
      setProjectToDeleteId(null);
      return;
    }

    if (
      confirmProjectName.trim().toLowerCase() !== project.name.toLowerCase()
    ) {
      toast({
        variant: 'destructive',
        title: 'Confirmation Failed',
        description: 'Project name does not match.',
      });
      return;
    }

    deleteProjectMutation.mutate(projectToDeleteId, {
      onSuccess: () => {
        toast({
          title: 'Project Deleted',
          description: `Project "${project.name}" has been deleted.`,
        });
        setIsDeleteDialogOpen(false);
        setProjectToDeleteId(null);
        // If the deleted project was the selected one, select the first available project or null
        if (selectedProjectId === projectToDeleteId) {
          const remainingProjects = projects.filter(
            (p) => p.id !== projectToDeleteId
          );
          setSelectedProjectId(
            remainingProjects.length > 0 ? remainingProjects[0].id : null
          );
        }
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Delete Error',
          description: `Failed to delete project: ${error.message}`,
        });
        setIsDeleteDialogOpen(false); // Close dialog even on error
        setProjectToDeleteId(null);
      },
    });
  };

  // Define the tab structure including new tabs
  const tabsConfig: Record<
    string,
    {
      label: string;
      icon: React.ElementType;
      component?: React.ElementType;
      subTabs?: Record<
        string,
        { label: string; icon: React.ElementType; component: React.ElementType }
      >;
    }
  > = {
    dashboard: {
      label: 'Dashboard',
      icon: LayoutDashboard,
      component: DashboardTab,
    },
    sprints: {
      label: 'Sprints',
      icon: IterationCw,
      subTabs: {
        summary: { label: 'Overview', icon: Eye, component: SprintSummaryTab },
        planning: {
          label: 'Planning',
          icon: NotebookPen,
          component: SprintPlanningTab,
        },
        retrospective: {
          label: 'Retrospective',
          icon: GitCommitVertical,
          component: SprintRetrospectiveTab,
        },
      },
    },
    backlog: {
      label: 'Backlog',
      icon: Layers,
      subTabs: {
        management: {
          label: 'Management',
          icon: Package,
          component: BacklogTab,
        },
        grooming: {
          label: 'Grooming',
          icon: Edit,
          component: BacklogGroomingTab,
        },
        history: { label: 'History', icon: History, component: HistoryTab },
      },
    },
    risk: { label: 'Risk', icon: AlertTriangle, component: RiskTab }, // New Risk Tab
    evaluation: {
      label: 'Evaluation',
      icon: ClipboardCheck,
      component: EvaluationTab,
    }, // New Evaluation Tab
    analytics: {
      label: 'Analytics',
      icon: BarChartBig,
      subTabs: {
        charts: {
          label: 'Charts',
          icon: BarChart,
          component: AnalyticsChartsTab,
        },
        reports: {
          label: 'Reports',
          icon: ListPlus,
          component: AnalyticsReportsTab,
        },
      },
    },
    settings: {
      label: 'Settings',
      icon: Settings,
      subTabs: {
        members: { label: 'Members', icon: Users, component: MembersTab },
        teams: { label: 'Teams', icon: UsersRound, component: TeamsTab },
        holidays: {
          label: 'Holidays',
          icon: CalendarDays,
          component: HolidaysTab,
        },
      },
    },
  };

  // Render the currently active tab content
  const renderActiveTabContent = () => {
    // Handle initial loading state for authentication check
    if (isAuthenticated === null) {
      return (
        <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
          <CardHeader className="text-center">
            <CardTitle>Authenticating...</CardTitle>
            <CardDescription>Please wait.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      );
    }

    if (!selectedProject) {
      // Initial loading state from React Query
      if (isLoadingProjects) {
        return (
          <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
            <CardHeader className="text-center">
              <CardTitle>Loading Project Data...</CardTitle>
              <CardDescription>
                Please wait while the application loads.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        );
      }
      // Error state from React Query
      if (projectsError) {
        return (
          <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed border-destructive">
            <CardHeader className="text-center">
              <CardTitle className="text-destructive">
                Error Loading Projects
              </CardTitle>
              <CardDescription>
                Could not load project data. Please check your connection or
                Firebase setup.
              </CardDescription>
              <CardDescription className="mt-2 text-xs text-muted-foreground">
                {projectsError.message}
              </CardDescription>
            </CardHeader>
          </Card>
        );
      }
      // No projects exist state
      if (projects.length === 0) {
        return (
          <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
            <CardHeader className="text-center">
              <CardTitle>No Projects Found</CardTitle>
              <CardDescription>
                Create your first project using the 'New Project' button above.
              </CardDescription>
            </CardHeader>
          </Card>
        );
      }

      // No project selected (should ideally default to first, but handle as fallback)
      return (
        <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
          <CardHeader className="text-center">
            <CardTitle>No Project Selected</CardTitle>
            <CardDescription>
              Please select a project from the dropdown above, or create a new
              one.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    const [mainKey, subKey] = activeTab.split('/');
    const mainConfig = tabsConfig[mainKey as keyof typeof tabsConfig];

    if (!mainConfig) return null; // Should not happen if activeTab is valid

    let ActiveComponent: React.ElementType | undefined;
    let componentProps: any = {
      // Base props for all components
      projectId: selectedProject.id,
      projectName: selectedProject.name,
    };

    if (mainConfig.subTabs && subKey) {
      const subConfig =
        mainConfig.subTabs[subKey as keyof typeof mainConfig.subTabs];
      if (!subConfig) return null; // Invalid sub-tab
      ActiveComponent = subConfig.component;

      // Add specific props based on the sub-tab component
      switch (`${mainKey}/${subKey}`) {
        case 'sprints/summary':
          componentProps = {
            ...componentProps,
            sprintData: selectedProject.sprintData,
            onDeleteSprint: handleDeleteSprint,
          };
          break;
        case 'sprints/planning':
          const availableBacklogItems =
            selectedProject.backlog?.filter(
              (task) => !task.movedToSprint && !task.historyStatus
            ) ?? [];
          componentProps = {
            ...componentProps,
            sprints: selectedProject.sprintData.sprints ?? [],
            onSavePlanning: handleSavePlanningAndUpdateStatus,
            onCreateAndPlanSprint: handleCreateAndPlanSprint,
            onCompleteSprint: handleCompleteSprint,
            members: selectedProject.members ?? [],
            holidayCalendars: selectedProject.holidayCalendars ?? [],
            teams: selectedProject.teams ?? [],
            backlog: availableBacklogItems, // Pass only active backlog items
            onRevertTask: handleRevertTaskToBacklog,
            onAddBacklogItems: handleMoveSelectedBacklogItemsToSprint, // Pass the move function
          };
          break;
        case 'sprints/retrospective':
          componentProps = {
            ...componentProps,
            sprints: selectedProject.sprintData.sprints ?? [],
          };
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
            initialBacklog:
              selectedProject.backlog?.filter((task) => !task.historyStatus) ??
              [], // Pass only non-historical items to grooming
            onSaveBacklog: (groomedBacklog: Task[]) => {
              // Combine groomed items with historical items before saving
              const historicalItems = (selectedProject.backlog ?? []).filter(
                (task) => task.historyStatus
              );
              const fullBacklog = [...groomedBacklog, ...historicalItems];
              const updatedProject: Project = {
                ...selectedProject,
                backlog: fullBacklog,
              };
              updateProjectData(updatedProject);
              toast({
                title: 'Backlog Groomed',
                description: 'Changes saved.',
              });
            },
            onSplitBacklogItem: handleSplitBacklogItem, // Pass handler from hook
            onMergeBacklogItems: handleMergeBacklogItems, // Pass handler from hook
            onUndoBacklogAction: handleUndoBacklogAction, // Pass handler from hook
            generateNextBacklogId: generateNextBacklogIdHelper, // Pass helper for merge dialog ID gen
            allProjectBacklogItems: selectedProject.backlog ?? [], // Pass all items for uniqueness check
          };
          break;
        case 'backlog/history':
          componentProps = {
            ...componentProps,
            historyItems:
              selectedProject.backlog?.filter((task) => !!task.historyStatus) ??
              [], // Pass items with history status
            onUndoBacklogAction: handleUndoBacklogAction, // Pass handler from hook
          };
          break;
        case 'analytics/charts':
          componentProps = {
            ...componentProps,
            sprintData: selectedProject.sprintData,
            members: selectedProject.members ?? [],
          };
          break;
        case 'analytics/reports':
          componentProps = {
            ...componentProps,
            sprintData: selectedProject.sprintData,
          };
          break;
        case 'settings/members': // Updated path
          componentProps = {
            ...componentProps,
            initialMembers: selectedProject.members ?? [],
            onSaveMembers: handleSaveMembers,
            holidayCalendars: selectedProject.holidayCalendars ?? [],
          };
          break;
        case 'settings/teams': // Updated path
          componentProps = {
            ...componentProps,
            initialTeams: selectedProject.teams ?? [],
            allMembers: selectedProject.members ?? [],
            onSaveTeams: handleSaveTeams,
          };
          break;
        case 'settings/holidays': // Updated path
          componentProps = {
            ...componentProps,
            initialCalendars: selectedProject.holidayCalendars ?? [],
            onSaveCalendars: handleSaveHolidayCalendars,
          };
          break;
        default:
          // ActiveComponent = () => <div>Unknown Tab</div>; // Fallback if a specific case isn't matched but subConfig exists
          componentProps = {};
          break;
      }
    } else {
      // Handle main tabs without sub-tabs (Dashboard, Risk, Evaluation)
      ActiveComponent = mainConfig.component;
      if (mainKey === 'dashboard') {
        componentProps = {
          ...componentProps,
          sprintData: selectedProject.sprintData,
        };
      } else if (mainKey === 'risk') {
        componentProps = {
          ...componentProps,
          sprintData: selectedProject.sprintData,
          backlog: selectedProject.backlog,
        }; // Add props for RiskTab if needed
      } else if (mainKey === 'evaluation') {
        componentProps = {
          ...componentProps,
          sprintData: selectedProject.sprintData,
          backlog: selectedProject.backlog,
          members: selectedProject.members,
        }; // Add props for EvaluationTab if needed
      }
      // Add props for other main tabs if needed
    }

    if (!ActiveComponent) {
      console.error(
        `Error: ActiveComponent is undefined for tab: ${activeTab}. MainKey: ${mainKey}, SubKey: ${subKey}`
      );
      return (
        <div>Error: Tab component not found. Please check configuration.</div>
      );
    }

    return <ActiveComponent {...componentProps} />;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 md:gap-4">
          {' '}
          {/* Adjusted gap for mobile */}
          <h1 className="text-lg font-semibold text-primary md:text-2xl">
            Project Prism
          </h1>
          <Select
            value={selectedProjectId ?? undefined} // Use undefined if null for Select
            onValueChange={(value) => {
              if (value === 'loading' || value === 'no-projects') return; // Prevent selecting placeholder items
              console.log(`Project selected: ${value}`);
              setSelectedProjectId(value);
              setActiveTab('dashboard'); // Reset to dashboard tab on project change
            }}
            disabled={isLoadingProjects || projects.length === 0} // Disable while loading or if no projects
          >
            <SelectTrigger className="w-[150px] md:w-[200px]">
              {' '}
              {/* Adjusted width for mobile */}
              <SelectValue
                placeholder={
                  isLoadingProjects
                    ? 'Loading...'
                    : projects.length === 0
                      ? 'No projects yet'
                      : 'Select a project'
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Projects</SelectLabel>
                {isLoadingProjects ? (
                  <SelectItem value="loading" disabled>
                    Loading projects...
                  </SelectItem>
                ) : projects.length > 0 ? (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between pr-2"
                    >
                      <SelectItem value={project.id} className="flex-1">
                        {' '}
                        {/* Allow text to take space */}
                        {project.name}
                      </SelectItem>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 h-6 w-6 text-muted-foreground hover:text-destructive"
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
                  <SelectItem value="no-projects" disabled>
                    No projects yet
                  </SelectItem>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Dialog
            open={isNewProjectDialogOpen}
            onOpenChange={setIsNewProjectDialogOpen}
          >
            <DialogTrigger asChild>
              {/* Icon only on mobile, button with text on larger screens */}
              <Button
                variant="outline"
                size="sm"
                className="p-2 md:px-3 md:py-2"
              >
                <PlusCircle className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">New Project</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Enter a name for your new project. Click create when you're
                  done.
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
                <Button
                  type="button"
                  onClick={handleCreateNewProject}
                  disabled={updateProjectMutation.isPending}
                >
                  {updateProjectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {' '}
          {/* Adjusted gap */}
          {selectedProject &&
            (selectedProject.sprintData?.sprints?.length > 0 ||
              selectedProject.members?.length > 0 ||
              selectedProject.holidayCalendars?.length > 0 ||
              selectedProject.teams?.length > 0 ||
              selectedProject.backlog?.length > 0) && (
              <Button
                onClick={() => handleExport(selectedProject, toast as ToastFun)}
                variant="outline"
                size="sm"
                className="p-2 md:px-3 md:py-2" // Icon only on mobile
              >
                <Download className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Export Project Data</span>
              </Button>
            )}
          <ModeToggle /> {/* Add the dark mode toggle */}
        </div>
      </header>

      {/* Delete Project Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Project "
              {projects.find((p) => p.id === projectToDeleteId)?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              project and all its associated data (sprints, backlog, members,
              etc.).
              <br />
              To confirm, please type the project name below:
              <strong className="mt-1 block">
                {projects.find((p) => p.id === projectToDeleteId)?.name}
              </strong>
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
            <AlertDialogCancel onClick={() => setProjectToDeleteId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteProject}
              disabled={
                deleteProjectMutation.isPending ||
                confirmProjectName.trim().toLowerCase() !==
                  (projects
                    .find((p) => p.id === projectToDeleteId)
                    ?.name.toLowerCase() ?? ' ')
              }
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              {deleteProjectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Project'
              )}
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
          <Card className="flex min-h-[400px] flex-col items-center justify-center border-2 border-dashed">
            <CardHeader className="text-center">
              <CardTitle>Loading Project Data...</CardTitle>
              <CardDescription>
                Please wait while the application loads.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : (
          <Tabs
            value={activeMainTab}
            onValueChange={handleMainTabChange}
            className="w-full"
          >
            {/* Main Tabs List - Sticky below header */}
            <TabsList className="sticky top-16 z-10 mb-6 grid w-full grid-cols-7 bg-background shadow-sm">
              {' '}
              {/* Added sticky, top-16 (adjust as needed), z-10, background */}
              {Object.entries(tabsConfig).map(([key, config]) => (
                <TabsTrigger key={key} value={key}>
                  <config.icon className="h-4 w-4 md:mr-2" />{' '}
                  {/* Icon always visible, margin only on larger screens */}
                  <span className="hidden md:inline">{config.label}</span>{' '}
                  {/* Text hidden on mobile */}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Sub Tabs and Content Area */}
            <div className="mt-4">
              {/* Render Sub Tabs only if the active main tab has them */}
              {tabsConfig[activeMainTab as keyof typeof tabsConfig]
                ?.subTabs && (
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="mb-6 w-full"
                >
                  <TabsList
                    className={cn(
                      'grid w-full',
                      // Adjust grid cols dynamically based on the number of subtabs
                      `grid-cols-${Object.keys(tabsConfig[activeMainTab as keyof typeof tabsConfig].subTabs!).length}`
                    )}
                  >
                    {Object.entries(
                      tabsConfig[activeMainTab as keyof typeof tabsConfig]
                        .subTabs!
                    ).map(([subKey, subConfig]) => (
                      <TabsTrigger
                        key={`${activeMainTab}/${subKey}`}
                        value={`${activeMainTab}/${subKey}`}
                      >
                        <subConfig.icon className="h-4 w-4 md:mr-2" />{' '}
                        {/* Icon always visible, margin only on larger screens */}
                        <span className="hidden md:inline">
                          {subConfig.label}
                        </span>{' '}
                        {/* Text hidden on mobile */}
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

      <footer className="border-t p-4 text-center text-xs text-muted-foreground">
        Project Prism - Agile Reporting Made Easy
      </footer>
    </div>
  );
}
