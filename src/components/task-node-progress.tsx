'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, Minus } from 'lucide-react'; // Added Minus for ellipsis
import type { TaskStatus, Task } from '@/types/sprint-data';

interface TaskNodeProgressProps {
  tasks: Task[]; // Array of tasks to calculate progress from
}

const MAX_VISIBLE_NODES = 10;

export default function TaskNodeProgress({ tasks }: TaskNodeProgressProps) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No tasks planned for this sprint.
      </div>
    );
  }

  // Sort tasks: 'Done' first, then by original index/order if available or ticket number
  const sortedTasks = [...tasks].sort((a, b) => {
    const aIsDone = a.status === 'Done';
    const bIsDone = b.status === 'Done';
    if (aIsDone && !bIsDone) return -1; // 'Done' comes first
    if (!aIsDone && bIsDone) return 1;
    // Fallback sort (assuming tasks have a creation order or index)
    // If no order, sort by ticket number for consistency
    return (a.ticketNumber ?? '').localeCompare(b.ticketNumber ?? '');
  });

  const totalTasks = sortedTasks.length;
  const completedTasksCount = sortedTasks.filter(
    (task) => task.status === 'Done'
  ).length;

  const renderNode = (task: Task, index: number, isDone: boolean) => (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-all',
          isDone
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-primary bg-background text-primary ring-2 ring-primary/30'
        )}
        title={`Task ${task.ticketNumber || index + 1}: ${task.status || 'N/A'}`}
      >
        {isDone ? <Check className="h-5 w-5" /> : index + 1}
      </div>
      <div className="mt-1 space-y-0.5">
        <div
          className={cn(
            'h-1 w-6 rounded-full',
            isDone ? 'bg-primary' : 'bg-muted'
          )}
        ></div>
        <div
          className={cn(
            'mx-auto h-1 w-4 rounded-full',
            isDone ? 'bg-primary/70' : 'bg-muted/70'
          )}
        ></div>
      </div>
    </div>
  );

  const renderConnector = (isDone: boolean) => (
    <div
      className={cn(
        'mt-4 h-0.5 flex-1',
        isDone ? 'bg-primary' : 'bg-muted'
      )}
    />
  );

  const renderEllipsisConnector = () => (
    <div className="mt-4 flex flex-1 items-center justify-center">
      <span className="h-0.5 w-full border-t-2 border-dashed border-muted-foreground"></span>
      {/* Optional: add dots visually
          <Minus className="h-4 w-4 text-muted-foreground mx-1" />
          <Minus className="h-4 w-4 text-muted-foreground mx-1" />
          <Minus className="h-4 w-4 text-muted-foreground mx-1" /> */}
    </div>
  );

  let nodesToRender: React.ReactNode[] = [];

  if (totalTasks <= MAX_VISIBLE_NODES) {
    // Render all nodes if within limit
    sortedTasks.forEach((task, index) => {
      const isDone = task.status === 'Done';
      nodesToRender.push(renderNode(task, index, isDone));
      if (index < totalTasks - 1) {
        // Add connector if not the last node
        const nextIsDone = sortedTasks[index + 1]?.status === 'Done';
        // Connector is blue if the *current* node is done
        nodesToRender.push(renderConnector(isDone));
      }
    });
  } else {
    // Render with ellipsis if exceeding limit
    const nodesBeforeEllipsis = 4;
    const nodesAfterEllipsis = 5; // Include the very last node
    const lastTaskIndex = totalTasks - 1;

    // Ensure we don't try to render more 'done' nodes than exist
    const actualNodesBefore = Math.min(completedTasksCount, nodesBeforeEllipsis);
    const startNodes = sortedTasks.slice(0, actualNodesBefore);

    // Ensure we don't try to render more 'not done' nodes than exist, and get correct indices
    const actualNodesAfter = Math.min(
      totalTasks - completedTasksCount,
      nodesAfterEllipsis
    );
    // Calculate the starting index for the end slice correctly
    const endSliceStartIndex = totalTasks - actualNodesAfter;
    const endNodes = sortedTasks.slice(endSliceStartIndex);

    // Render starting 'Done' nodes
    startNodes.forEach((task, index) => {
      nodesToRender.push(renderNode(task, index, true));
      // Add connector after each start node, ensuring the last one connects to ellipsis
      nodesToRender.push(renderConnector(true));
    });

    // Render Ellipsis connector
    nodesToRender.push(renderEllipsisConnector());

    // Render ending 'Not Done' nodes
    endNodes.forEach((task, relativeIndex) => {
      const originalIndex = endSliceStartIndex + relativeIndex;
      nodesToRender.push(renderNode(task, originalIndex, false));
      if (originalIndex < lastTaskIndex) {
        // Add connector if not the last node
        nodesToRender.push(renderConnector(false));
      }
    });
  }

  return (
    <div className="flex w-full items-start justify-between space-x-2 px-4 py-2">
      {nodesToRender}
    </div>
  );
}
