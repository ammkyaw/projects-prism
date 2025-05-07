'use client';

import React, { useState, useEffect, useCallback } from 'react'; // Added React import
import type { Task } from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info, Layers, Save } from 'lucide-react'; // Use Layers icon or similar
import { useToast } from '@/hooks/use-toast';
import { taskPriorities } from '@/types/sprint-data';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils'; // Import cn utility

interface BacklogPrioritizationTabProps {
  projectId: string;
  projectName: string;
  initialBacklog: Task[]; // Receive the current backlog
  onSaveBacklog: (backlog: Task[]) => void; // Callback to save the reordered backlog
}

// Sortable Item Component
function SortableItem({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging, // Added isDragging
  } = useSortable({ id: task.id }); // Use task.id as the unique identifier

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined, // Elevate dragging item
    opacity: isDragging ? 0.8 : 1, // Reduce opacity when dragging
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'mb-2 touch-none rounded-md border bg-card p-3 shadow-sm', // Added touch-none
        'flex items-center justify-between',
        isDragging ? 'cursor-grabbing shadow-lg' : 'cursor-grab'
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium">{task.backlogId}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {task.title || '(No Title)'}
        </span>
      </div>
      <span className="ml-2 rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {task.priority || 'Medium'}
      </span>
    </div>
  );
}

export default function BacklogPrioritizationTab({
  projectId,
  projectName,
  initialBacklog,
  onSaveBacklog,
}: BacklogPrioritizationTabProps) {
  const [backlogItems, setBacklogItems] = useState<Task[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Require small movement to start drag
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize state when initialBacklog changes
  useEffect(() => {
    // Sort initial backlog by priority first
    const sortedInitial = (initialBacklog || []).slice().sort((a, b) => {
      const prioA = taskPriorities.indexOf(a.priority || 'Medium');
      const prioB = taskPriorities.indexOf(b.priority || 'Medium');
      return prioA - prioB;
    });
    setBacklogItems(sortedInitial);
    setHasUnsavedChanges(false); // Reset changes on initial load
  }, [initialBacklog]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id && over) {
      setBacklogItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Assign priorities based on the new order
        // Divide the list into roughly equal sections for each priority level
        const numItems = newOrder.length;
        const numPriorities = taskPriorities.length;
        const itemsPerPriority = Math.ceil(numItems / numPriorities);

        const prioritizedItems = newOrder.map((item, index) => {
          const priorityIndex = Math.min(
            Math.floor(index / itemsPerPriority),
            numPriorities - 1
          );
          return { ...item, priority: taskPriorities[priorityIndex] };
        });

        setHasUnsavedChanges(true); // Mark changes as unsaved
        return prioritizedItems;
      });
    }
  };

  const handleSavePrioritization = () => {
    // Combine the reordered items with any items not displayed (e.g., moved items)
    // In this tab, we assume initialBacklog contains only the items to be prioritized
    onSaveBacklog(backlogItems);
    setHasUnsavedChanges(false);
    toast({ title: 'Success', description: 'Backlog prioritization saved.' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Backlog Prioritization
            </CardTitle>
            <CardDescription>
              Drag and drop backlog items to reorder them. Priority will be
              assigned automatically based on order (Highest at top, Lowest at
              bottom).
            </CardDescription>
          </div>
          <Button
            onClick={handleSavePrioritization}
            disabled={!hasUnsavedChanges}
          >
            <Save className="mr-2 h-4 w-4" /> Save Prioritization
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {backlogItems.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-md border-2 border-dashed p-6">
            <Info className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              No backlog items to prioritize.
            </p>
            <p className="text-sm text-muted-foreground">
              Add items in the 'Management' tab.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={backlogItems.map((item) => item.id)} // Pass IDs for SortableContext
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {backlogItems.map((task) => (
                  <SortableItem key={task.id} task={task} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
      {backlogItems.length > 0 && (
        <CardFooter className="flex justify-end border-t pt-4">
          <Button
            onClick={handleSavePrioritization}
            disabled={!hasUnsavedChanges}
          >
            <Save className="mr-2 h-4 w-4" /> Save Prioritization
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
