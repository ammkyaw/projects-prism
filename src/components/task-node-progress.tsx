'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { TaskStatus, Task } from '@/types/sprint-data'; // Import Task type

interface TaskNodeProgressProps {
  tasks: Task[]; // Array of tasks to calculate progress from
}

export default function TaskNodeProgress({ tasks }: TaskNodeProgressProps) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No tasks planned for this sprint.
      </div>
    );
  }

  // Sort tasks: 'Done' first, then maybe by ticket number or order
  const sortedTasks = [...tasks].sort((a, b) => {
    const aIsDone = a.status === 'Done';
    const bIsDone = b.status === 'Done';
    if (aIsDone && !bIsDone) return -1; // 'Done' comes first
    if (!aIsDone && bIsDone) return 1;
    // Optional: Add secondary sort if needed (e.g., by ticketNumber)
    return (a.ticketNumber ?? '').localeCompare(b.ticketNumber ?? '');
  });

  const totalTasks = sortedTasks.length;

  return (
    <div className="flex w-full items-start justify-between space-x-2 px-4 py-2">
      {sortedTasks.map((task, index) => {
        const isDone = task.status === 'Done';
        const isLast = index === totalTasks - 1;

        return (
          <React.Fragment key={task.id || `task-${index}`}>
            <div className="flex min-w-0 flex-1 flex-col items-center">
              {' '}
              {/* Use flex-1 for equal spacing */}
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-all',
                  isDone
                    ? 'border-primary bg-primary text-primary-foreground' // Completed: Filled blue with check
                    : 'border-primary bg-background text-primary ring-2 ring-primary/30' // Not Done: Blue border, ring, white background
                )}
                title={`Task ${task.ticketNumber || index + 1}: ${task.status || 'N/A'}`} // Tooltip for status
              >
                {isDone ? <Check className="h-5 w-5" /> : index + 1}
              </div>
              {/* Decorative lines below node - keep simple */}
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

            {!isLast && (
              <div
                className={cn(
                  'mt-4 h-0.5 flex-1', // Adjust vertical alignment if needed
                  isDone ? 'bg-primary' : 'bg-muted' // Line color: blue if the stage *before* it is completed
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
