
"use client";

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Check } from 'lucide-react';
import type { TaskStatus, Task } from '@/types/sprint-data'; // Import Task type

interface TaskNodeProgressProps {
  tasks: Task[]; // Array of tasks to calculate progress from
}

const statuses: TaskStatus[] = ["To Do", "In Progress", "In Review", "QA", "Done"];

const getStatusCounts = (tasks: Task[]) => {
  const counts: { [key in TaskStatus | 'Blocked']: number } = { // Include Blocked explicitly
    "To Do": 0,
    "In Progress": 0,
    "In Review": 0,
    "QA": 0,
    "Done": 0,
    "Blocked": 0, // Initialize Blocked count
  };
  tasks.forEach(task => {
    const status = task.status ?? 'To Do'; // Default to 'To Do' if status is null/undefined
    if (counts.hasOwnProperty(status)) {
      counts[status as TaskStatus | 'Blocked']++; // Use type assertion
    } else {
      console.warn(`Unknown task status encountered: ${task.status}`);
      counts["To Do"]++; // Fallback to To Do for unknown statuses
    }
  });
  return counts;
};

export default function TaskNodeProgress({ tasks }: TaskNodeProgressProps) {
  const statusCounts = getStatusCounts(tasks);
  const totalTasks = tasks.length;

  if (totalTasks === 0) {
    return <div className="text-sm text-muted-foreground">No tasks planned for this sprint.</div>;
  }

  // Determine the furthest stage reached by any task (excluding 'Blocked')
  let activeStageIndex = -1;
  if (statusCounts["Done"] > 0) activeStageIndex = 4;
  else if (statusCounts["QA"] > 0) activeStageIndex = 3;
  else if (statusCounts["In Review"] > 0) activeStageIndex = 2;
  else if (statusCounts["In Progress"] > 0) activeStageIndex = 1;
  else if (statusCounts["To Do"] > 0 || statusCounts["Blocked"] > 0) activeStageIndex = 0; // Consider Blocked as starting point

  // Determine completed stages - a stage is completed if *any* task has moved beyond it.
   const completedStages: boolean[] = statuses.map((_, index) => {
       // The 'Done' stage is only completed if ALL tasks are Done.
       if (index === 4) {
           return statusCounts['Done'] === totalTasks;
       }
       // A stage is considered "completed" if at least one task has reached ANY stage AFTER it.
       for (let i = index + 1; i < statuses.length; i++) {
           if (statusCounts[statuses[i]] > 0) {
               return true;
           }
       }
       return false;
   });

  return (
    <div className="flex items-start justify-between w-full px-4 py-2 space-x-2">
      {statuses.map((status, index) => {
        const isCompleted = completedStages[index];
        // Active stage is the *furthest* non-completed stage that has tasks.
        // Or the first stage if nothing is done. Or the last if all are done.
        const isActive = (activeStageIndex === index && !isCompleted) || (index === 0 && activeStageIndex === 0) || (index === 4 && isCompleted);
        const isLast = index === statuses.length - 1;

        return (
          <React.Fragment key={status}>
            <div className="flex flex-col items-center flex-1 min-w-0"> {/* Use flex-1 for equal spacing */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground" // Completed: Filled blue with check
                    : isActive
                    ? "border-primary text-primary ring-2 ring-primary/30 bg-background" // Active: Blue border, ring, white background
                    : "border-muted-foreground text-muted-foreground bg-background" // Pending: Gray border
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : index + 1}
              </div>
              {/* Display index number instead of status name */}
              <span className={cn(
                    "text-xs mt-1 text-center break-words w-[60px]",
                    isActive ? "text-primary font-medium" : "text-muted-foreground"
               )}>
                 {index + 1}
              </span>
               {/* Decorative lines below node - keep simple */}
              <div className="mt-1 space-y-0.5">
                 <div className={cn("h-1 w-6 rounded-full", isActive || isCompleted ? "bg-primary" : "bg-muted")}></div>
                 <div className={cn("h-1 w-4 rounded-full mx-auto", isActive || isCompleted ? "bg-primary/70" : "bg-muted/70")}></div>
              </div>
            </div>

            {!isLast && (
              <div className={cn(
                  "flex-1 h-0.5 mt-4", // Adjust vertical alignment if needed
                   isCompleted ? "bg-primary" : "bg-muted" // Line color: blue if the stage *before* it is completed
                   )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
