'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  PlusCircle,
  Trash2,
  Package,
  Save,
  ArrowUpDown,
  View,
  ArrowRightSquare,
  LinkIcon,
  Filter,
  GripVertical,
  ListChecks,
  XCircle,
  Edit,
  AlertTriangle, // For Severity icon
} from 'lucide-react';
import type {
  Task,
  Member,
  Sprint,
  SprintStatus,
  TaskType,
  SeverityType, // Import SeverityType
} from '@/types/sprint-data';
import {
  taskTypes,
  taskPriorities,
  initialBacklogTask,
  severities, // Import severities
} from '@/types/sprint-data';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid, getYear } from 'date-fns';
import SelectDependenciesDialog from '@/components/dialogs/select-dependencies-dialog';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BacklogTabProps {
  projectId: string;
  projectName: string;
  initialBacklog: Task[];
  onSaveNewItems: (newItems: Task[]) => void;
  members: Member[];
  sprints: Sprint[];
  onMoveToSprint: (backlogItemId: string, targetSprintNumber: number) => void;
  generateNextBacklogId: (allProjectBacklogItems: Task[]) => string;
  onUpdateSavedItem: (updatedItem: Task) => void;
  onDeleteSavedItem: (itemId: string) => void;
}

type SortKey =
  | 'backlogId'
  | 'title'
  | 'priority'
  | 'createdDate'
  | 'needsGrooming'
  | 'readyForSprint'
  | 'taskType' // Added taskType for sorting
  | 'severity'; // Added severity for sorting

type SortDirection = 'asc' | 'desc';

interface EditingBacklogRow extends Omit<Task, 'status' | 'storyPoints'> {
  _internalId: string;
  createdDateObj?: Date | undefined;
  storyPoints?: string | null; // Allow string for input
}

interface DisplayBacklogRow extends Task {
  ref?: React.RefObject<HTMLDivElement>;
  isEditing?: boolean;
}

const parseDateString = (dateString: string | undefined): Date | undefined => {
  if (!dateString) return undefined;
  try {
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const generateNextBacklogIdHelper = (
  allProjectBacklogItems: Task[]
): string => {
  const currentYear = getYear(new Date()).toString().slice(-2);
  const prefix = `BL-${currentYear}`;
  let maxNum = 0;

  allProjectBacklogItems.forEach((item) => {
    const id = item.backlogId;
    const match = id?.match(/^BL-\d{2}(\d{4})(?:-.*)?$/);
    if (id && id.startsWith(prefix) && match) {
      const numPart = parseInt(match[1], 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  });

  const nextNum = maxNum + 1;
  const nextNumPadded = nextNum.toString().padStart(4, '0');
  return `${prefix}${nextNumPadded}`;
};

export default function BacklogTab({
  projectId,
  projectName,
  initialBacklog,
  onSaveNewItems,
  members,
  sprints,
  onMoveToSprint,
  generateNextBacklogId,
  onUpdateSavedItem,
  onDeleteSavedItem,
}: BacklogTabProps) {
  const [newBacklogRows, setNewBacklogRows] = useState<EditingBacklogRow[]>([]);
  const [savedBacklogItems, setSavedBacklogItems] = useState<
    DisplayBacklogRow[]
  >([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState<boolean>(false);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [selectedTargetSprint, setSelectedTargetSprint] = useState<
    number | null
  >(null);
  const [isDepsDialogOpen, setIsDepsDialogOpen] = useState(false);
  const [editingDepsTaskId, setEditingDepsTaskId] = useState<string | null>(
    null
  );
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);
  const [isFilteringReady, setIsFilteringReady] = useState(false);
  const savedRowRefs = useRef<Map<string, React.RefObject<HTMLDivElement>>>(
    new Map()
  );

  const displayableSavedItems = useMemo(() => {
    return savedBacklogItems.filter(
      (task) => !task.movedToSprint && !task.historyStatus
    );
  }, [savedBacklogItems]);

  const availableSprints = useMemo(() => {
    return sprints
      .filter((s) => s.status === 'Active' || s.status === 'Planned')
      .sort((a, b) => a.sprintNumber - b.sprintNumber);
  }, [sprints]);

  useEffect(() => {
    savedRowRefs.current.clear();
    const initialDisplayableItems = initialBacklog.filter(
      (task) => !task.movedToSprint && !task.historyStatus
    );

    const mappedItems = initialDisplayableItems.map((item) => {
      const internalId = item.id;
      if (!savedRowRefs.current.has(internalId)) {
        savedRowRefs.current.set(internalId, React.createRef<HTMLDivElement>());
      }
      return {
        ...item,
        _internalId: internalId,
        ref: savedRowRefs.current.get(internalId),
        isEditing: false,
        createdDateObj: parseDateString(item.createdDate),
        storyPoints: item.storyPoints?.toString() ?? '', // Ensure storyPoints is string for input
      };
    });
    setSavedBacklogItems(mappedItems);
    setNewBacklogRows([]);
    setHasUnsavedChanges(false);
  }, [initialBacklog, projectId]);

  useEffect(() => {
    setHasUnsavedChanges(newBacklogRows.length > 0);
  }, [newBacklogRows]);

  const filteredAndSortedSavedRows = useMemo(() => {
    let items = [...displayableSavedItems];
    if (isFilteringReady) {
      items = items.filter((row) => row.readyForSprint);
    }
    if (sortConfig !== null) {
      items.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        switch (sortConfig.key) {
          case 'priority':
            aValue = taskPriorities.indexOf(a.priority || 'Medium');
            bValue = taskPriorities.indexOf(b.priority || 'Medium');
            break;
          case 'createdDate':
            const dateA =
              a.createdDate && isValid(parseISO(a.createdDate))
                ? parseISO(a.createdDate)
                : new Date(0);
            const dateB =
              b.createdDate && isValid(parseISO(b.createdDate))
                ? parseISO(b.createdDate)
                : new Date(0);
            aValue = dateA.getTime();
            bValue = dateB.getTime();
            break;
          case 'severity':
            aValue = severities.indexOf(a.severity || 'Medium'); // Or a default
            bValue = severities.indexOf(b.severity || 'Medium');
            break;
          default:
            aValue =
              (a[sortConfig.key as keyof Task] as any)
                ?.toString()
                .toLowerCase() || '';
            bValue =
              (b[sortConfig.key as keyof Task] as any)
                ?.toString()
                .toLowerCase() || '';
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return (a.backlogId ?? '').localeCompare(b.backlogId ?? '');
      });
    } else {
      items.sort(
        (a, b) =>
          taskPriorities.indexOf(a.priority || 'Medium') -
          taskPriorities.indexOf(b.priority || 'Medium')
      );
    }
    return items.map((task) => ({
      ...task,
      ref: savedRowRefs.current.get(task.id),
    }));
  }, [displayableSavedItems, sortConfig, isFilteringReady]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'asc'
    ) {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
    }
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const toggleFilterReady = () => setIsFilteringReady((prev) => !prev);

  const handleAddNewRow = () => {
    const allCurrentItems = [...initialBacklog, ...newBacklogRows];
    const nextId = generateNextBacklogIdHelper(allCurrentItems);
    const newRow: EditingBacklogRow = {
      ...(initialBacklogTask as Omit<Task, 'id' | 'storyPoints'>), // Cast to exclude id
      storyPoints: null, // Ensure storyPoints is handled correctly
      _internalId: `new_backlog_${Date.now()}_${Math.random()}`,
      id: '',
      backlogId: nextId,
      createdDate: format(new Date(), 'yyyy-MM-dd'),
      createdDateObj: new Date(),
      dependsOn: [],
      needsGrooming: false,
      readyForSprint: false,
      severity: null,
    };
    setNewBacklogRows((prev) => [...prev, newRow]);
    setHasUnsavedChanges(true);
  };

  const handleRemoveNewRow = (internalId: string) => {
    setNewBacklogRows((prevRows) =>
      prevRows.filter((row) => row._internalId !== internalId)
    );
    setHasUnsavedChanges(newBacklogRows.length > 1);
  };

  const handleNewInputChange = (
    internalId: string,
    field: keyof Omit<
      EditingBacklogRow,
      | 'id'
      | '_internalId'
      | 'dependsOn'
      | 'createdDateObj'
      | 'ref'
      | 'movedToSprint'
      | 'needsGrooming'
      | 'readyForSprint'
      | 'historyStatus'
      | 'storyPoints'
    >,
    value: string | number | undefined
  ) => {
    setNewBacklogRows((rows) =>
      rows.map((row) => {
        if (row._internalId === internalId) {
          const updatedRow = { ...row, [field]: value ?? '' };
          // If taskType changes from 'Bug', reset severity
          if (field === 'taskType' && value !== 'Bug') {
            updatedRow.severity = null;
          }
          return updatedRow;
        }
        return row;
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleNewStoryPointsChange = (internalId: string, value: string) => {
    setNewBacklogRows((rows) =>
      rows.map((row) =>
        row._internalId === internalId ? { ...row, storyPoints: value } : row
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleNewDateChange = (
    internalId: string,
    field: 'createdDate',
    date: Date | undefined
  ) => {
    const dateString = date ? format(date, 'yyyy-MM-dd') : '';
    setNewBacklogRows((rows) =>
      rows.map((row) =>
        row._internalId === internalId
          ? { ...row, [field]: dateString, [`${field}Obj`]: date }
          : row
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleNewSelectChange = (
    internalId: string,
    field: 'taskType' | 'priority' | 'initiator' | 'severity',
    value: string
  ) => {
    let finalValue: string | undefined | null = value;
    if (value === 'none' && field !== 'severity') {
      finalValue = undefined;
    } else if (value === 'none' && field === 'severity') {
      finalValue = null;
    }

    setNewBacklogRows((rows) =>
      rows.map((row) => {
        if (row._internalId === internalId) {
          const updatedRow = { ...row, [field]: finalValue };
          if (field === 'taskType' && finalValue !== 'Bug') {
            updatedRow.severity = null;
          }
          return updatedRow;
        }
        return row;
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleNewCheckboxChange = (
    internalId: string,
    field: 'needsGrooming' | 'readyForSprint',
    checked: boolean | 'indeterminate'
  ) => {
    setNewBacklogRows((rows) =>
      rows.map((row) =>
        row._internalId === internalId ? { ...row, [field]: !!checked } : row
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleViewDetails = (task: Task) => {
    if (task.backlogId?.trim()) {
      setViewingTask(task);
      setIsViewDialogOpen(true);
    }
  };

  const handleOpenMoveDialog = (taskId: string) => {
    setMovingTaskId(taskId);
    setSelectedTargetSprint(null);
    setIsMoveDialogOpen(true);
  };

  const handleConfirmMoveToSprint = () => {
    if (!movingTaskId || selectedTargetSprint === null) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No target sprint selected.',
      });
      return;
    }
    onMoveToSprint(movingTaskId, selectedTargetSprint);
    setIsMoveDialogOpen(false);
    setMovingTaskId(null);
    setSavedBacklogItems((prev) =>
      prev.filter((item) => item.id !== movingTaskId)
    );
  };

  const handleOpenDepsDialog = (taskId: string, isNewItem: boolean) => {
    setEditingDepsTaskId(isNewItem ? taskId : taskId);
    setIsDepsDialogOpen(true);
  };

  const handleSaveDependencies = (selectedDeps: string[]) => {
    if (!editingDepsTaskId) return;
    const isEditingNewItem = newBacklogRows.some(
      (row) => row._internalId === editingDepsTaskId
    );
    if (isEditingNewItem) {
      setNewBacklogRows((prevRows) =>
        prevRows.map((row) =>
          row._internalId === editingDepsTaskId
            ? { ...row, dependsOn: selectedDeps.sort() }
            : row
        )
      );
    } else {
      setSavedBacklogItems((prevItems) =>
        prevItems.map((item) =>
          item.id === editingDepsTaskId
            ? { ...item, dependsOn: selectedDeps.sort() }
            : item
        )
      );
    }
    setHasUnsavedChanges(true);
    setIsDepsDialogOpen(false);
    setEditingDepsTaskId(null);
  };

  const handleScrollToDependency = (dependencyBacklogId: string) => {
    const targetRow = savedBacklogItems.find(
      (row) => row.backlogId === dependencyBacklogId
    );
    const targetRef = targetRow
      ? savedRowRefs.current.get(targetRow.id)
      : undefined;
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetRef.current.classList.add('bg-accent/20');
      setTimeout(() => {
        targetRef.current?.classList.remove('bg-accent/20');
      }, 1500);
    } else {
      toast({
        variant: 'default',
        title: 'Info',
        description: `Backlog item '${dependencyBacklogId}' not found or not rendered.`,
      });
    }
  };

  const handleSaveNewItems = () => {
    let hasErrors = false;
    const itemsToSave: Task[] = [];
    const allKnownBacklogIds = new Set<string>();
    initialBacklog.forEach((task) => {
      if (task.backlogId) allKnownBacklogIds.add(task.backlogId.toLowerCase());
    });

    newBacklogRows.forEach((row, index) => {
      const isEmptyRow =
        !row.backlogId?.trim() &&
        !row.title?.trim() &&
        !row.storyPoints?.toString().trim();
      if (isEmptyRow && newBacklogRows.length > 1) return;
      if (isEmptyRow && newBacklogRows.length === 1) {
        setNewBacklogRows([]);
        setHasUnsavedChanges(false);
        toast({ title: 'No New Items', description: 'No new items to save.' });
        return;
      }

      const backlogId = row.backlogId?.trim() || '';
      const title = row.title?.trim();
      const storyPointsRaw = row.storyPoints?.toString().trim() ?? '';
      const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : null; // Ensure null if empty
      const taskType = row.taskType ?? 'New Feature';
      const createdDate = row.createdDate ?? '';
      const initiator = row.initiator?.trim() || '';
      const dependsOn = row.dependsOn || [];
      const priority = row.priority ?? 'Medium';
      const needsGrooming = !!row.needsGrooming;
      const readyForSprint = !!row.readyForSprint;
      const severity = row.severity ?? null;

      let rowErrors: string[] = [];
      if (!backlogId) rowErrors.push(`Row ${index + 1}: Backlog ID required`);
      const lowerCaseBacklogId = backlogId.toLowerCase();
      if (backlogId && allKnownBacklogIds.has(lowerCaseBacklogId)) {
        rowErrors.push(
          `Row ${index + 1}: Duplicate Backlog ID "${backlogId}" already exists.`
        );
      }
      if (
        backlogId &&
        newBacklogRows.filter(
          (r) =>
            r._internalId !== row._internalId &&
            r.backlogId?.toLowerCase() === lowerCaseBacklogId
        ).length > 0
      ) {
        rowErrors.push(
          `Row ${index + 1}: Duplicate Backlog ID "${backlogId}" within new items.`
        );
      }
      if (!title) rowErrors.push('Title required');
      if (storyPointsRaw && (isNaN(storyPoints as number) || (storyPoints as number) < 0)) {
        rowErrors.push(`Row ${index + 1}: Invalid Story Points`);
      }
      if (!createdDate || !isValid(parseISO(createdDate))) {
        rowErrors.push('Invalid Created Date (use YYYY-MM-DD)');
      }
      if (!taskType || !taskTypes.includes(taskType as any)) {
        rowErrors.push('Invalid Task Type');
      }
      if (taskType === 'Bug' && (!severity || !severities.includes(severity))) {
        rowErrors.push('Severity is required for Bugs.');
      }
      if (!priority || !taskPriorities.includes(priority as any)) {
        rowErrors.push('Invalid Priority');
      }
      const combinedBacklogIds = new Set([
        ...initialBacklog.map((t) => t.backlogId!).filter(Boolean),
        ...newBacklogRows
          .filter((r) => r._internalId !== row._internalId && r.backlogId)
          .map((r) => r.backlogId!),
      ]);
      const invalidDeps = dependsOn.filter(
        (depId) => !combinedBacklogIds.has(depId)
      );
      if (invalidDeps.length > 0) {
        rowErrors.push(
          `Row ${index + 1}: Invalid dependencies: ${invalidDeps.join(', ')}`
        );
      }

      if (rowErrors.length > 0) {
        toast({
          variant: 'destructive',
          title: `Error in New Backlog Row ${index + 1}`,
          description: rowErrors.join(', '),
        });
        hasErrors = true;
        return;
      }
      if (backlogId) allKnownBacklogIds.add(lowerCaseBacklogId);

      itemsToSave.push({
        id: '',
        backlogId: backlogId,
        ticketNumber: backlogId,
        title,
        description: row.description?.trim() ?? '',
        storyPoints,
        taskType: taskType as TaskType,
        createdDate,
        initiator,
        dependsOn,
        priority: priority as Task['priority'],
        needsGrooming,
        readyForSprint,
        severity: taskType === 'Bug' ? severity : null,
        historyStatus: null,
        movedToSprint: null,
        devEstimatedTime: '',
        qaEstimatedTime: '',
        bufferTime: '',
        assignee: '',
        reviewer: '',
        status: 'To Do',
        startDate: '',
        acceptanceCriteria: row.acceptanceCriteria,
      });
    });

    if (hasErrors) return;
    if (itemsToSave.length === 0) {
      if (newBacklogRows.length > 0) {
        toast({
          title: 'No New Items',
          description: 'No valid new items to save.',
        });
      }
      setNewBacklogRows([]);
      setHasUnsavedChanges(false);
      return;
    }
    onSaveNewItems(itemsToSave);
    setNewBacklogRows([]);
    setHasUnsavedChanges(false);
    toast({
      title: 'Success',
      description: `${itemsToSave.length} new backlog item(s) saved.`,
    });
  };

  const handleSavedItemEditToggle = (itemId: string) => {
    setSavedBacklogItems((prev) =>
      prev.map(
        (item) =>
          item.id === itemId
            ? { ...item, isEditing: !item.isEditing }
            : { ...item, isEditing: false }
      )
    );
  };

  const handleSavedInputChange = (
    itemId: string,
    field: keyof Omit<
      Task,
      | 'id'
      | '_internalId'
      | 'ref'
      | 'isEditing'
      | 'createdDateObj'
      | 'dependsOn'
      | 'storyPoints'
    >,
    value: string | number | undefined
  ) => {
    setSavedBacklogItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value ?? '' };
          if (field === 'taskType' && value !== 'Bug') {
            updatedItem.severity = null;
          }
          return updatedItem;
        }
        return item;
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleSavedStoryPointsChange = (itemId: string, value: string) => {
    setSavedBacklogItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, storyPoints: value } : item
      )
    );
    setHasUnsavedChanges(true);
  };


  const handleSavedSelectChange = (
    itemId: string,
    field: 'taskType' | 'priority' | 'initiator' | 'severity',
    value: string
  ) => {
    let finalValue: string | undefined | null = value;
    if (value === 'none' && field !== 'severity') {
      finalValue = undefined;
    } else if (value === 'none' && field === 'severity') {
      finalValue = null;
    }
    handleSavedInputChange(itemId, field, finalValue);
  };

  const handleSavedCheckboxChange = (
    itemId: string,
    field: 'needsGrooming' | 'readyForSprint',
    checked: boolean | 'indeterminate'
  ) => {
    setSavedBacklogItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: !!checked } : item
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleSaveSingleEditedItem = (itemId: string) => {
    const itemToSave = savedBacklogItems.find((item) => item.id === itemId);
    if (!itemToSave) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Item not found.',
      });
      return;
    }
    const backlogId = itemToSave.backlogId?.trim() || '';
    const title = itemToSave.title?.trim();
    const storyPointsRaw = itemToSave.storyPoints?.toString().trim() ?? '';
    const storyPoints = storyPointsRaw ? parseInt(storyPointsRaw, 10) : null;
    const taskType = itemToSave.taskType;
    const severity = itemToSave.severity;

    let hasErrors = false;
    let errors: string[] = [];
    if (!backlogId) errors.push(`Backlog ID required`);
    if (
      initialBacklog.some(
        (t) =>
          t.id !== itemId &&
          t.backlogId?.toLowerCase() === backlogId.toLowerCase()
      )
    ) {
      errors.push(`Duplicate Backlog ID "${backlogId}" already exists.`);
    }
    if (!title) errors.push('Title required');
    if (taskType === 'Bug' && (!severity || !severities.includes(severity))) {
      errors.push('Severity is required for Bugs.');
    }


    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: `Validation Error`,
        description: errors.join(', '),
      });
      hasErrors = true;
      return;
    }
    if (!hasErrors) {
      const { _internalId, isEditing, ref, createdDateObj, ...baseTask } =
        itemToSave;
      const finalTask: Task = {
        ...baseTask,
        storyPoints: storyPoints, // Use parsed story points
        severity: taskType === 'Bug' ? severity : null, // Ensure severity is null if not a bug
      };
      onUpdateSavedItem(finalTask);
      setSavedBacklogItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, isEditing: false, storyPoints: storyPoints?.toString() ?? '' } : item
        )
      );
      toast({
        title: 'Success',
        description: `Backlog item '${finalTask.backlogId}' updated.`,
      });
    }
  };

  const savedPotentialDependencies = useMemo(() => {
    if (!editingDepsTaskId) return [];
    return savedBacklogItems
      .filter((item) => item.id !== editingDepsTaskId && item.backlogId?.trim())
      .map((item) => ({
        id: item.backlogId!,
        title: item.title || `Item ${item.backlogId}`,
      }));
  }, [savedBacklogItems, editingDepsTaskId]);

  const potentialDependenciesForNewItems = useMemo(() => {
    if (!editingDepsTaskId) return [];
    const allBacklogItems = [
      ...savedBacklogItems.map((t) => ({
        id: t.backlogId!,
        title: t.title || `Item ${t.backlogId}`,
      })),
      ...newBacklogRows
        .filter((r) => r._internalId !== editingDepsTaskId && r.backlogId)
        .map((r) => ({
          id: r.backlogId!,
          title: r.title || `Item ${r.backlogId}`,
        })),
    ];
    return allBacklogItems.filter((item) => item.id?.trim());
  }, [savedBacklogItems, newBacklogRows, editingDepsTaskId]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-primary" /> Add New Backlog
                Items
              </CardTitle>
              <CardDescription>
                Add new tasks to the project backlog. Click 'Add Backlog Item'
                to create rows, then 'Save New Items'.
              </CardDescription>
            </div>
            <Button
              onClick={handleSaveNewItems}
              disabled={newBacklogRows.length === 0}
            >
              <Save className="mr-2 h-4 w-4" /> Save New Items
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <div className="min-w-[1800px] space-y-4"> {/* Increased min-width */}
              <div className="sticky top-0 z-10 hidden grid-cols-[120px_1fr_120px_100px_120px_120px_100px_100px_80px_60px_60px_40px] items-center gap-x-3 border-b bg-card pb-2 md:grid"> {/* Adjusted grid for severity */}
                <Label className="text-xs font-medium text-muted-foreground">
                  Backlog ID*
                </Label>
                <Label className="text-xs font-medium text-muted-foreground">
                  Title*
                </Label>
                <Label className="text-xs font-medium text-muted-foreground">
                  Task Type*
                </Label>
                 <Label className="text-xs font-medium text-muted-foreground"> {/* Severity Header */}
                  Severity
                </Label>
                <Label className="text-xs font-medium text-muted-foreground">
                  Initiator
                </Label>
                <Label className="text-xs font-medium text-muted-foreground">
                  Created Date*
                </Label>
                <Label className="text-xs font-medium text-muted-foreground">
                  Priority*
                </Label>
                <Label className="text-xs font-medium text-muted-foreground">
                  Dependencies
                </Label>
                <Label className="text-center text-xs font-medium text-muted-foreground">
                  Groom?
                </Label>
                <Label className="text-center text-xs font-medium text-muted-foreground">
                  Ready?
                </Label>
                <div />
              </div>
              <div className="space-y-4 md:space-y-2">
                {newBacklogRows.map((row) => (
                  <div
                    key={row._internalId}
                    className="grid grid-cols-2 items-start gap-x-3 gap-y-2 border-b pb-4 last:border-b-0 md:grid-cols-[120px_1fr_120px_100px_120px_120px_100px_100px_80px_60px_60px_40px] md:border-none md:pb-0" // Adjusted grid for severity
                  >
                    <div className="col-span-1 md:col-span-1">
                      <Label
                        htmlFor={`new-backlog-id-${row._internalId}`}
                        className="text-xs font-medium md:hidden"
                      >
                        Backlog ID*
                      </Label>
                      <Input
                        id={`new-backlog-id-${row._internalId}`}
                        value={row.backlogId ?? ''}
                        readOnly
                        className="h-9 cursor-default bg-muted/50"
                      />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <Label
                        htmlFor={`new-backlog-title-${row._internalId}`}
                        className="text-xs font-medium md:hidden"
                      >
                        Title*
                      </Label>
                      <Input
                        id={`new-backlog-title-${row._internalId}`}
                        value={row.title ?? ''}
                        onChange={(e) =>
                          handleNewInputChange(
                            row._internalId,
                            'title',
                            e.target.value
                          )
                        }
                        placeholder="Task Title"
                        className="h-9"
                        required
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1">
                      <Label
                        htmlFor={`new-backlog-type-${row._internalId}`}
                        className="text-xs font-medium md:hidden"
                      >
                        Task Type*
                      </Label>
                      <Select
                        value={row.taskType ?? 'New Feature'}
                        onValueChange={(value) =>
                          handleNewSelectChange(
                            row._internalId,
                            'taskType',
                            value
                          )
                        }
                      >
                        <SelectTrigger
                          id={`new-backlog-type-${row._internalId}`}
                          className="h-9"
                        >
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {taskTypes.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                     {/* Severity Dropdown */}
                    <div className="col-span-1 md:col-span-1">
                      <Label htmlFor={`new-severity-${row._internalId}`} className="text-xs font-medium md:hidden">Severity</Label>
                      <Select
                        value={row.severity ?? 'none'}
                        onValueChange={(value) => handleNewSelectChange(row._internalId, 'severity', value)}
                        disabled={row.taskType !== 'Bug'}
                      >
                        <SelectTrigger id={`new-severity-${row._internalId}`} className="h-9">
                          <SelectValue placeholder="Severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-muted-foreground">-- Select --</SelectItem>
                          {severities.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 md:col-span-1">
                      <Label
                        htmlFor={`new-backlog-initiator-${row._internalId}`}
                        className="text-xs font-medium md:hidden"
                      >
                        Initiator
                      </Label>
                      <Select
                        value={row.initiator ?? 'none'}
                        onValueChange={(value) =>
                          handleNewSelectChange(
                            row._internalId,
                            'initiator',
                            value
                          )
                        }
                        disabled={members.length === 0}
                      >
                        <SelectTrigger
                          id={`new-backlog-initiator-${row._internalId}`}
                          className="h-9"
                        >
                          <SelectValue placeholder="Initiator" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="none"
                            className="text-muted-foreground"
                          >
                            -- None --
                          </SelectItem>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.name}>
                              {member.name}
                            </SelectItem>
                          ))}
                          {members.length === 0 && (
                            <SelectItem value="no-members" disabled>
                              No members
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 md:col-span-1">
                      <Label
                        htmlFor={`new-backlog-created-${row._internalId}`}
                        className="text-xs font-medium md:hidden"
                      >
                        Created Date*
                      </Label>
                      <Input
                        id={`new-backlog-created-${row._internalId}`}
                        type="date"
                        value={row.createdDate}
                        onChange={(e) =>
                          handleNewInputChange(
                            row._internalId,
                            'createdDate',
                            e.target.value
                          )
                        }
                        required
                        className="h-9 w-full"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1">
                      <Label
                        htmlFor={`new-backlog-priority-${row._internalId}`}
                        className="text-xs font-medium md:hidden"
                      >
                        Priority*
                      </Label>
                      <Select
                        value={row.priority ?? 'Medium'}
                        onValueChange={(value) =>
                          handleNewSelectChange(
                            row._internalId,
                            'priority',
                            value
                          )
                        }
                      >
                        <SelectTrigger
                          id={`new-backlog-priority-${row._internalId}`}
                          className="h-9"
                        >
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {taskPriorities.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 self-center md:col-span-1">
                      <Label
                        htmlFor={`new-backlog-deps-${row._internalId}`}
                        className="text-xs font-medium md:hidden"
                      >
                        Dependencies
                      </Label>
                      <div className="flex min-h-[36px] flex-wrap items-center gap-1">
                        {row.dependsOn && row.dependsOn.length > 0 ? (
                          row.dependsOn.map((depId) => (
                            <span
                              key={depId}
                              className="rounded bg-muted/50 px-1 py-0.5 text-xs text-muted-foreground"
                            >
                              {depId}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs italic text-muted-foreground">
                            None
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-1 h-6 w-6"
                          onClick={() =>
                            handleOpenDepsDialog(row._internalId, true)
                          }
                          aria-label="Edit Dependencies"
                        >
                          <LinkIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="col-span-1 flex items-center justify-center pt-2 md:col-span-1 md:pt-0">
                      <Label
                        htmlFor={`new-needs-grooming-${row._internalId}`}
                        className="text-xs font-medium md:hidden"
                      >
                        Groom?
                      </Label>
                      <Checkbox
                        id={`new-needs-grooming-${row._internalId}`}
                        checked={row.needsGrooming}
                        onCheckedChange={(checked) =>
                          handleNewCheckboxChange(
                            row._internalId,
                            'needsGrooming',
                            checked
                          )
                        }
                        className="h-5 w-5"
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center pt-2 md:col-span-1 md:pt-0">
                      <Label
                        htmlFor={`new-ready-sprint-${row._internalId}`}
                        className="text-xs font-medium md:hidden"
                      >
                        Ready?
                      </Label>
                      <Checkbox
                        id={`new-ready-sprint-${row._internalId}`}
                        checked={row.readyForSprint}
                        onCheckedChange={(checked) =>
                          handleNewCheckboxChange(
                            row._internalId,
                            'readyForSprint',
                            checked
                          )
                        }
                        className="h-5 w-5"
                      />
                    </div>
                    <div className="col-span-2 mt-1 flex items-center justify-end md:col-span-1 md:mt-0 md:self-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveNewRow(row._internalId)}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        aria-label="Remove new backlog row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                onClick={handleAddNewRow}
                variant="outline"
                size="sm"
                className="mt-4"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Backlog Item
              </Button>
            </div>
          </div>
          <CardFooter className="flex items-center justify-between border-t pt-4">
            <p className="text-xs text-muted-foreground">* Required field.</p>
            <Button
              onClick={handleSaveNewItems}
              disabled={newBacklogRows.length === 0}
            >
              <Save className="mr-2 h-4 w-4" /> Save New Items (
              {newBacklogRows.length})
            </Button>
          </CardFooter>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" /> Saved Backlog
                Items
              </CardTitle>
              <CardDescription>
                View and manage existing backlog items. Use the filter or sort
                options.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={isFilteringReady ? 'secondary' : 'outline'}
                size="sm"
                onClick={toggleFilterReady}
              >
                <Filter className="mr-2 h-4 w-4" />
                {isFilteringReady ? 'Show All' : 'Show Ready Only'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredAndSortedSavedRows.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-md border-2 border-dashed p-6">
              <Package className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {isFilteringReady
                  ? "No items marked 'Ready for Sprint'."
                  : 'The saved backlog is empty.'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isFilteringReady
                  ? 'Clear the filter or mark items as ready.'
                  : 'Add and save new items using the section above.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1800px] space-y-4"> {/* Increased min-width */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">
                        <Button
                          variant="ghost"
                          onClick={() => requestSort('backlogId')}
                          className="h-auto justify-start px-1 text-xs font-medium text-muted-foreground"
                        >
                          Backlog ID {getSortIndicator('backlogId')}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => requestSort('title')}
                          className="h-auto justify-start px-1 text-xs font-medium text-muted-foreground"
                        >
                          Title {getSortIndicator('title')}
                        </Button>
                      </TableHead>
                      <TableHead className="w-[120px]">
                         <Button variant="ghost" onClick={() => requestSort('taskType')} className="h-auto justify-start px-1 text-xs font-medium text-muted-foreground">
                            Task Type {getSortIndicator('taskType')}
                        </Button>
                      </TableHead>
                       <TableHead className="w-[100px]"> {/* Severity Column */}
                        <Button variant="ghost" onClick={() => requestSort('severity')} className="h-auto justify-start px-1 text-xs font-medium text-muted-foreground">
                            Severity {getSortIndicator('severity')}
                        </Button>
                      </TableHead>
                      <TableHead className="w-[120px]">Initiator</TableHead>
                      <TableHead className="w-[120px]">
                        <Button
                          variant="ghost"
                          onClick={() => requestSort('createdDate')}
                          className="h-auto justify-start px-1 text-xs font-medium text-muted-foreground"
                        >
                          Created {getSortIndicator('createdDate')}
                        </Button>
                      </TableHead>
                      <TableHead className="w-[100px]">
                        <Button
                          variant="ghost"
                          onClick={() => requestSort('priority')}
                          className="h-auto justify-start px-1 text-xs font-medium text-muted-foreground"
                        >
                          Priority {getSortIndicator('priority')}
                        </Button>
                      </TableHead>
                      <TableHead className="w-[100px]">Dependencies</TableHead>
                      <TableHead className="w-[80px] text-center">
                        <Button
                          variant="ghost"
                          onClick={() => requestSort('needsGrooming')}
                          className="h-auto justify-center px-1 text-xs font-medium text-muted-foreground"
                        >
                          Groom? {getSortIndicator('needsGrooming')}
                        </Button>
                      </TableHead>
                      <TableHead className="w-[60px] text-center">
                        <Button
                          variant="ghost"
                          onClick={() => requestSort('readyForSprint')}
                          className="h-auto justify-center px-1 text-xs font-medium text-muted-foreground"
                        >
                          Ready? {getSortIndicator('readyForSprint')}
                        </Button>
                      </TableHead>
                      <TableHead className="w-[80px] text-center">
                        Actions
                      </TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedSavedRows.map((row) => (
                      <TableRow
                        key={row.id}
                        ref={row.ref}
                        className="transition-colors duration-1000"
                      >
                        <TableCell className="font-medium">
                          {row.isEditing ? (
                            <Input
                              id={`saved-backlog-id-${row.id}`}
                              value={row.backlogId ?? ''}
                              onChange={(e) =>
                                handleSavedInputChange(
                                  row.id,
                                  'backlogId',
                                  e.target.value
                                )
                              }
                              placeholder="ID-123"
                              className="h-9"
                              required
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleViewDetails(row)}
                              className="cursor-pointer text-sm font-semibold text-primary underline hover:text-primary/80"
                              aria-label={`View details for ${row.backlogId}`}
                            >
                              {row.backlogId}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.isEditing ? (
                            <Input
                              id={`saved-title-${row.id}`}
                              value={row.title ?? ''}
                              onChange={(e) =>
                                handleSavedInputChange(
                                  row.id,
                                  'title',
                                  e.target.value
                                )
                              }
                              placeholder="Task Title"
                              className="h-9"
                              required
                            />
                          ) : (
                            <span className="text-sm">{row.title}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.isEditing ? (
                            <Select
                              value={row.taskType ?? 'New Feature'}
                              onValueChange={(value) =>
                                handleSavedSelectChange(
                                  row.id,
                                  'taskType',
                                  value
                                )
                              }
                            >
                              <SelectTrigger
                                id={`saved-type-${row.id}`}
                                className="h-9"
                              >
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                {taskTypes.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm">{row.taskType}</span>
                          )}
                        </TableCell>
                         {/* Severity Cell */}
                        <TableCell>
                          {row.isEditing ? (
                            <Select
                              value={row.severity ?? 'none'}
                              onValueChange={(value) => handleSavedSelectChange(row.id, 'severity', value)}
                              disabled={row.taskType !== 'Bug'}
                            >
                              <SelectTrigger id={`saved-severity-${row.id}`} className="h-9">
                                <SelectValue placeholder="Severity" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-muted-foreground">-- Select --</SelectItem>
                                {severities.map(option => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm">{row.severity || (row.taskType === 'Bug' ? '-' : '')}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.isEditing ? (
                            <Select
                              value={row.initiator ?? 'none'}
                              onValueChange={(value) =>
                                handleSavedSelectChange(
                                  row.id,
                                  'initiator',
                                  value
                                )
                              }
                              disabled={members.length === 0}
                            >
                              <SelectTrigger
                                id={`saved-initiator-${row.id}`}
                                className="h-9"
                              >
                                <SelectValue placeholder="Initiator" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  value="none"
                                  className="text-muted-foreground"
                                >
                                  -- None --
                                </SelectItem>
                                {members.map((member) => (
                                  <SelectItem
                                    key={member.id}
                                    value={member.name}
                                  >
                                    {member.name}
                                  </SelectItem>
                                ))}
                                {members.length === 0 && (
                                  <SelectItem value="no-members" disabled>
                                    No members
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm">
                              {row.initiator || '-'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.createdDate && isValid(parseISO(row.createdDate))
                            ? format(parseISO(row.createdDate), 'MMM d, yyyy')
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {row.isEditing ? (
                            <Select
                              value={row.priority ?? 'Medium'}
                              onValueChange={(value) =>
                                handleSavedSelectChange(
                                  row.id,
                                  'priority',
                                  value
                                )
                              }
                            >
                              <SelectTrigger
                                id={`saved-priority-${row.id}`}
                                className="h-9"
                              >
                                <SelectValue placeholder="Priority" />
                              </SelectTrigger>
                              <SelectContent>
                                {taskPriorities.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm">{row.priority}</span>
                          )}
                        </TableCell>
                        <TableCell className="self-center">
                          <div className="flex min-h-[36px] flex-wrap items-center gap-1">
                            {row.dependsOn && row.dependsOn.length > 0 ? (
                              row.dependsOn.map((depId) => (
                                <button
                                  key={depId}
                                  type="button"
                                  onClick={() =>
                                    handleScrollToDependency(depId)
                                  }
                                  className="cursor-pointer rounded border-none bg-primary/10 px-1 py-0.5 text-xs text-primary underline hover:text-primary/80"
                                  disabled={row.isEditing}
                                >
                                  {depId}
                                </button>
                              ))
                            ) : (
                              <span className="text-xs italic text-muted-foreground">
                                None
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-1 h-6 w-6"
                              onClick={() =>
                                handleOpenDepsDialog(row.id, false)
                              }
                              aria-label="Edit Dependencies"
                              disabled={row.isEditing}
                            >
                              <LinkIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            id={`saved-grooming-${row.id}`}
                            checked={row.needsGrooming}
                            onCheckedChange={(checked) =>
                              handleSavedCheckboxChange(
                                row.id,
                                'needsGrooming',
                                checked
                              )
                            }
                            disabled={!row.isEditing}
                            className="h-5 w-5"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            id={`saved-ready-${row.id}`}
                            checked={row.readyForSprint}
                            onCheckedChange={(checked) =>
                              handleSavedCheckboxChange(
                                row.id,
                                'readyForSprint',
                                checked
                              )
                            }
                            disabled={!row.isEditing}
                            className="h-5 w-5"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {row.isEditing ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700"
                                onClick={() =>
                                  handleSaveSingleEditedItem(row.id)
                                }
                                title="Save Changes"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  handleSavedItemEditToggle(row.id)
                                }
                                title="Edit Item"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={
                                availableSprints.length === 0 ||
                                !row.id?.trim() ||
                                !row.readyForSprint ||
                                row.isEditing
                              }
                              onClick={() => handleOpenMoveDialog(row.id)}
                              aria-label="Move to Sprint"
                              title={
                                row.isEditing
                                  ? 'Save or cancel edit first'
                                  : !row.readyForSprint
                                    ? 'Item not ready for sprint'
                                    : availableSprints.length === 0
                                      ? 'No active/planned sprints'
                                      : 'Move to Sprint'
                              }
                            >
                              <ArrowRightSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteSavedItem(row.id)}
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            aria-label="Delete saved backlog item"
                            disabled={row.isEditing}
                            title="Delete Item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Backlog Item Details: {viewingTask?.backlogId}
            </DialogTitle>
          </DialogHeader>
          {viewingTask && (
            <div className="grid gap-4 py-4 text-sm">
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right font-medium text-muted-foreground">
                  Title
                </Label>
                <span className="col-span-2">{viewingTask.title || '-'}</span>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right font-medium text-muted-foreground">
                  Type
                </Label>
                <span className="col-span-2">{viewingTask.taskType}</span>
              </div>
               {viewingTask.taskType === 'Bug' && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label className="text-right font-medium text-muted-foreground">Severity</Label>
                  <span className="col-span-2">{viewingTask.severity || '-'}</span>
                </div>
              )}
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right font-medium text-muted-foreground">
                  Priority
                </Label>
                <span className="col-span-2">{viewingTask.priority}</span>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right font-medium text-muted-foreground">
                  Initiator
                </Label>
                <span className="col-span-2">
                  {viewingTask.initiator || '-'}
                </span>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right font-medium text-muted-foreground">
                  Created
                </Label>
                <span className="col-span-2">
                  {viewingTask.createdDate &&
                  isValid(parseISO(viewingTask.createdDate))
                    ? format(parseISO(viewingTask.createdDate), 'PPP')
                    : '-'}
                </span>
              </div>
              <div className="grid grid-cols-3 items-start gap-4">
                <Label className="pt-1 text-right font-medium text-muted-foreground">
                  Description
                </Label>
                <p className="col-span-2 whitespace-pre-wrap break-words">
                  {viewingTask.description || '-'}
                </p>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right font-medium text-muted-foreground">
                  Dependencies
                </Label>
                <span className="col-span-2">
                  {viewingTask.dependsOn && viewingTask.dependsOn.length > 0
                    ? viewingTask.dependsOn.join(', ')
                    : 'None'}
                </span>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right font-medium text-muted-foreground">
                  Story Points
                </Label>
                <span className="col-span-2">
                  {viewingTask.storyPoints || '-'}
                </span>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right font-medium text-muted-foreground">
                  Needs Grooming
                </Label>
                <span className="col-span-2">
                  {viewingTask.needsGrooming ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right font-medium text-muted-foreground">
                  Ready for Sprint
                </Label>
                <span className="col-span-2">
                  {viewingTask.readyForSprint ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Move Backlog Item to Sprint</DialogTitle>
            <DialogDescription>
              Select the target sprint to move backlog item '
              {savedBacklogItems.find((r) => r.id === movingTaskId)?.backlogId}'
              to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="target-sprint">Target Sprint</Label>
            <Select
              value={selectedTargetSprint?.toString()}
              onValueChange={(value) =>
                setSelectedTargetSprint(value ? parseInt(value, 10) : null)
              }
            >
              <SelectTrigger id="target-sprint">
                <SelectValue placeholder="Select a sprint..." />
              </SelectTrigger>
              <SelectContent>
                {availableSprints.map((sprint) => (
                  <SelectItem
                    key={sprint.sprintNumber}
                    value={sprint.sprintNumber.toString()}
                  >
                    Sprint {sprint.sprintNumber} ({sprint.status})
                  </SelectItem>
                ))}
                {availableSprints.length === 0 && (
                  <SelectItem value="no-sprints" disabled>
                    No planned/active sprints
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleConfirmMoveToSprint}
              disabled={selectedTargetSprint === null}
            >
              Move Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SelectDependenciesDialog
        isOpen={isDepsDialogOpen}
        onOpenChange={setIsDepsDialogOpen}
        currentDependencies={
          newBacklogRows.find((row) => row._internalId === editingDepsTaskId)
            ?.dependsOn ??
          savedBacklogItems.find((item) => item.id === editingDepsTaskId)
            ?.dependsOn ??
          []
        }
        potentialDependencies={
          newBacklogRows.some((row) => row._internalId === editingDepsTaskId)
            ? potentialDependenciesForNewItems
            : savedPotentialDependencies
        }
        onSave={handleSaveDependencies}
        currentTaskName={
          newBacklogRows.find((row) => row._internalId === editingDepsTaskId)
            ?.title ||
          savedBacklogItems.find((item) => item.id === editingDepsTaskId)
            ?.title ||
          ''
        }
        currentTaskId={
          newBacklogRows.find((row) => row._internalId === editingDepsTaskId)
            ?.backlogId ||
          savedBacklogItems.find((item) => item.id === editingDepsTaskId)
            ?.backlogId ||
          ''
        }
      />
    </>
  );
}
