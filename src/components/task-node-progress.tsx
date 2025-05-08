'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, Minus } from 'lucide-react';
import type { TaskStatus, Task } from '@/types/sprint-data';

interface TaskNodeProgressProps {
  tasks: Task[]; // Array of tasks to calculate progress from
}

const MAX_VISIBLE_NODES = 10; // Max nodes to show including start/end/ellipsis placeholder
const NODES_BEFORE_ELLIPSIS = 4; // Default nodes at the start for mixed view
const NODES_AFTER_ELLIPSIS = 1; // Always show the last node

export default function TaskNodeProgress({ tasks }: TaskNodeProgressProps) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No tasks planned for this sprint.
      </div>
    );
  }

  // Add an original index for consistent sorting and display
  const indexedTasks = tasks.map((task, index) => ({
    ...task,
    originalIndex: index,
  }));

  // Sort tasks: 'Done' first, then by original index
  const sortedTasks = [...indexedTasks].sort((a, b) => {
    const aIsDone = a.status === 'Done';
    const bIsDone = b.status === 'Done';
    if (aIsDone && !bIsDone) return -1;
    if (!aIsDone && bIsDone) return 1;
    return a.originalIndex - b.originalIndex;
  });

  const totalTasks = sortedTasks.length;
  const numDone = sortedTasks.filter((task) => task.status === 'Done').length;
  const numNotDone = totalTasks - numDone;

  const renderNode = (task: Task, displayIndex: number, isDone: boolean) => (
    <div
      key={task.id || task._internalId || displayIndex}
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
      {/* Removed the small bars under the node for simplicity */}
    </div>
  );

  const renderConnector = (isDone: boolean, key: string) => (
    <div
      key={key}
      className={cn(
        'mt-4 h-0.5 flex-1', // Positioned connector correctly
        isDone ? 'bg-primary' : 'bg-muted'
      )}
    />
  );

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
        // Connector status based on the *next* node's status for visual flow
        const nextIsDone = sortedTasks[index + 1].status === 'Done';
        nodesToRender.push(renderConnector(isDone && nextIsDone, `conn-${index}`)); // Connector is 'done' only if both are done
      }
    });
  } else {
    // Logic for > MAX_VISIBLE_NODES
    if (numDone === totalTasks) {
      // All Done
      const nodesToShow = MAX_VISIBLE_NODES - NODES_AFTER_ELLIPSIS; // e.g., 9
      const firstNodes = sortedTasks.slice(0, nodesToShow);
      const lastNode = sortedTasks[totalTasks - 1];

      firstNodes.forEach((task, index) => {
        nodesToRender.push(renderNode(task, index + 1, true));
        // Add connector after each node except the last one shown before ellipsis
        if (index < nodesToShow - 1) {
          nodesToRender.push(renderConnector(true, `conn-all-done-${index}`));
        }
      });
      nodesToRender.push(renderEllipsisConnector('ellipsis-conn-all-done'));
      nodesToRender.push(renderNode(lastNode, totalTasks, true));

    } else if (numNotDone === totalTasks) {
       // All Not Done
      const nodesToShow = MAX_VISIBLE_NODES - NODES_AFTER_ELLIPSIS; // e.g., 9
      const firstNodes = sortedTasks.slice(0, nodesToShow);
      const lastNode = sortedTasks[totalTasks - 1];

      firstNodes.forEach((task, index) => {
        nodesToRender.push(renderNode(task, index + 1, false));
         if (index < nodesToShow - 1) {
            nodesToRender.push(renderConnector(false, `conn-all-not-done-${index}`));
         }
      });
      nodesToRender.push(renderEllipsisConnector('ellipsis-conn-all-not-done'));
      nodesToRender.push(renderNode(lastNode, totalTasks, false));

    } else {
      // Mixed Statuses
      const doneTasks = sortedTasks.slice(0, numDone);
      const notDoneTasks = sortedTasks.slice(numDone);
      const lastNotDoneNode = notDoneTasks[numNotDone - 1];

      if (numDone >= NODES_BEFORE_ELLIPSIS) {
        // Show first 4 Done
        const doneToShow = doneTasks.slice(0, NODES_BEFORE_ELLIPSIS);
        doneToShow.forEach((task, index) => {
          nodesToRender.push(renderNode(task, index + 1, true));
           // Add connector only if not the last node *before the next section*
          if (index < NODES_BEFORE_ELLIPSIS - 1) {
                nodesToRender.push(renderConnector(true, `conn-mixed-done-${index}`));
          }
        });

        // Show first 4 Not Done
        const notDoneToShow = notDoneTasks.slice(0, NODES_BEFORE_ELLIPSIS);
        // Add connector between Done and Not Done
        nodesToRender.push(renderConnector(false, `conn-mixed-done-last`));

        notDoneToShow.forEach((task, index) => {
          const originalIndex = numDone + index;
          nodesToRender.push(renderNode(task, originalIndex + 1, false));
           if (index < NODES_BEFORE_ELLIPSIS - 1) { // Add connector if not the last one shown before ellipsis
                nodesToRender.push(renderConnector(false, `conn-mixed-not-done-${index}`));
            }
        });

        nodesToRender.push(renderEllipsisConnector('ellipsis-conn-mixed-gt4'));
        nodesToRender.push(renderNode(lastNotDoneNode, totalTasks, false));

      } else { // numDone < 4
        // Show all Done
        doneTasks.forEach((task, index) => {
          nodesToRender.push(renderNode(task, index + 1, true));
           // Add connector only if not the last done node *before the next section*
           if (index < numDone - 1) {
             nodesToRender.push(renderConnector(true, `conn-mixed-done-${index}`));
           }
        });

        // Show first (8 - numDone) Not Done
        const numNotDoneToShow = MAX_VISIBLE_NODES - NODES_AFTER_ELLIPSIS - numDone -1; // -1 for the last node already accounted for

         // Add connector between Done and Not Done (if there were done tasks)
         if (numDone > 0) {
             nodesToRender.push(renderConnector(false, `conn-mixed-done-last`));
         }

        const firstNotDoneToShow = notDoneTasks.slice(0, numNotDoneToShow);

        firstNotDoneToShow.forEach((task, index) => {
            const originalIndex = numDone + index;
            nodesToRender.push(renderNode(task, originalIndex + 1, false));
             if (index < numNotDoneToShow - 1) { // Add connector if not the last one shown before ellipsis
                nodesToRender.push(renderConnector(false, `conn-mixed-not-done-${index}`));
             }
        });

        nodesToRender.push(renderEllipsisConnector('ellipsis-conn-mixed-lt4'));
        nodesToRender.push(renderNode(lastNotDoneNode, totalTasks, false));
      }
    }
  }


  return (
    <div className="flex w-full items-start justify-between space-x-2 px-4 py-2">
      {nodesToRender}
    </div>
  );
}
