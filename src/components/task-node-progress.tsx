"use client";

import { cn } from "@/lib/utils";
import { Check } from 'lucide-react';
import type { TaskStatus } from '@/types/sprint-data'; // Assuming TaskStatus type is defined here

interface TaskNodeProgressProps {
  tasks: { status?: TaskStatus | null }[]; // Array of tasks to calculate progress from
}

const statuses: TaskStatus[] = ["To Do", "In Progress", "In Review", "QA", "Done"];

const getStatusCounts = (tasks: { status?: TaskStatus | null }[]) => {
  const counts: { [key in TaskStatus]: number } = {
    "To Do": 0,
    "In Progress": 0,
    "In Review": 0,
    "QA": 0,
    "Done": 0,
    "Blocked": 0, // Include Blocked if needed, though not typically a sequential step
  };
  tasks.forEach(task => {
    if (task.status && counts.hasOwnProperty(task.status)) {
      counts[task.status]++;
    } else if (task.status === 'Blocked') {
        // Handle blocked? Maybe indicate separately
    } else {
        counts["To Do"]++; // Default to To Do if status is missing or invalid
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

  let activeStageIndex = -1;
  if (statusCounts["In Progress"] > 0) activeStageIndex = 1;
  else if (statusCounts["In Review"] > 0) activeStageIndex = 2;
  else if (statusCounts["QA"] > 0) activeStageIndex = 3;
  else if (statusCounts["Done"] === totalTasks && totalTasks > 0) activeStageIndex = 4; // All done
  else if (statusCounts["To Do"] === totalTasks) activeStageIndex = 0; // All To Do

  // Determine completed stages based on task distribution
  const completedStages: boolean[] = [
     false, // To Do is never 'completed' in this sense
     statusCounts["In Review"] > 0 || statusCounts["QA"] > 0 || statusCounts["Done"] > 0, // In Progress completed if next stages started
     statusCounts["QA"] > 0 || statusCounts["Done"] > 0, // In Review completed if QA or Done started
     statusCounts["Done"] > 0, // QA completed if Done started
     statusCounts["Done"] === totalTasks // Done is completed if all tasks are Done
  ];


  return (
    <div className="flex items-center justify-between w-full px-4 py-2 space-x-2">
      {statuses.map((status, index) => {
        const isCompleted = completedStages[index];
        const isActive = activeStageIndex === index;
        const isLast = index === statuses.length - 1;

        return (
          <React.Fragment key={status}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isActive
                    ? "border-primary text-primary ring-2 ring-primary/30" // Active state highlight
                    : "border-muted-foreground text-muted-foreground bg-background"
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : index + 1}
              </div>
              <span className={cn("text-xs mt-1 text-center", isActive ? "text-primary font-medium" : "text-muted-foreground")}>
                {status}
              </span>
               {/* Description lines (can be dynamic later) */}
              <div className="mt-1 space-y-0.5">
                 <div className={cn("h-1 w-6 rounded-full", isActive || isCompleted ? "bg-primary" : "bg-muted")}></div>
                 <div className={cn("h-1 w-4 rounded-full mx-auto", isActive || isCompleted ? "bg-primary/70" : "bg-muted/70")}></div>
              </div>
            </div>

            {!isLast && (
              <div className={cn(
                  "flex-1 h-0.5",
                   (isCompleted || isActive) && index < activeStageIndex ? "bg-primary" : "bg-muted" // Line color based on completion up to active
                   )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}