'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, Minus } from 'lucide-react'; // Added Minus for ellipsis
import type { TaskStatus, Task } from '@/types/sprint-data';

interface TaskNodeProgressProps {
  tasks: Task[]; // Array of tasks to calculate progress from
}

const MAX_VISIBLE_NODES = 10; // Maximum nodes to show before using ellipsis
const NODES_BEFORE_ELLIPSIS = 4; // Number of nodes to show at the beginning
const NODES_AFTER_ELLIPSIS = 5; // Number of nodes to show at the end (including the last one)

export default function TaskNodeProgress({ tasks }: TaskNodeProgressProps) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No tasks planned for this sprint.
      </div>
    );
  }

  // Sort tasks: 'Done' first, then by original index/order if available or ticket number
  // Add an original index for consistent sorting and display
  const indexedTasks = tasks.map((task, index) => ({ ...task, originalIndex: index }));

  const sortedTasks = [...indexedTasks].sort((a, b) => {
    const aIsDone = a.status === 'Done';
    const bIsDone = b.status === 'Done';
    if (aIsDone && !bIsDone) return -1; // 'Done' comes first
    if (!aIsDone && bIsDone) return 1;
    // Fallback sort by original index
    return a.originalIndex - b.originalIndex;
  });

  const totalTasks = sortedTasks.length;

  const renderNode = (task: Task, displayIndex: number, isDone: boolean) => (
    <div
      key={task.id || task._internalId || displayIndex} // Ensure a stable key
      className="flex min-w-0 flex-1 flex-col items-center"
    >
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-all',
          isDone
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-primary bg-background text-primary ring-2 ring-primary/30'
        )}
        title={`Task ${task.ticketNumber || displayIndex}: ${task.status || 'N/A'}`}
      >
        {isDone ? <Check className="h-5 w-5" /> : displayIndex}
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

  const renderConnector = (isDone: boolean, key: string) => (
    <div
      key={key}
      className={cn(
        'mt-4 h-0.5 flex-1',
        isDone ? 'bg-primary' : 'bg-muted'
      )}
    />
  );

  // Updated ellipsis connector rendering based on the image
  const renderEllipsisConnector = (key: string) => (
    <div
      key={key}
      className="mt-4 flex flex-1 items-center justify-center self-stretch"
    >
      <span className="h-0.5 w-full border-t-2 border-dashed border-muted-foreground/50"></span>
    </div>
  );

  let nodesToRender: React.ReactNode[] = [];

  if (totalTasks <= MAX_VISIBLE_NODES) {
    // Render all nodes if within limit
    sortedTasks.forEach((task, index) => {
      const isDone = task.status === 'Done';
      nodesToRender.push(renderNode(task, index + 1, isDone));
      if (index < totalTasks - 1) {
        nodesToRender.push(renderConnector(isDone, `conn-${index}`));
      }
    });
  } else {
    // Render with ellipsis if exceeding limit
    const startNodes = sortedTasks.slice(0, NODES_BEFORE_ELLIPSIS);
    const endNodes = sortedTasks.slice(totalTasks - NODES_AFTER_ELLIPSIS);

    // Render starting nodes
    startNodes.forEach((task, index) => {
      const isDone = task.status === 'Done'; // Should always be true if sorted correctly
      nodesToRender.push(renderNode(task, index + 1, isDone));
      // Add connector after each start node
      nodesToRender.push(renderConnector(isDone, `start-conn-${index}`));
    });

    // Render Ellipsis connector
    // The connector after the last start node should lead into the ellipsis style
    // Replace the last solid connector with the ellipsis one
    nodesToRender.pop(); // Remove the last solid connector
    nodesToRender.push(renderEllipsisConnector('ellipsis-conn'));

    // Render ending nodes
    endNodes.forEach((task, relativeIndex) => {
      const originalIndex = totalTasks - NODES_AFTER_ELLIPSIS + relativeIndex;
      const isDone = task.status === 'Done'; // Should always be false if sorted correctly and enough tasks exist
      nodesToRender.push(renderNode(task, originalIndex + 1, isDone));
      if (originalIndex < totalTasks - 1) {
        // Add connector if not the very last node
        nodesToRender.push(renderConnector(isDone, `end-conn-${originalIndex}`));
      }
    });
  }

  return (
    <div className="flex w-full items-start justify-between space-x-2 px-4 py-2">
      {nodesToRender}
    </div>
  );
}
