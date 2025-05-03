export interface Sprint {
  sprintNumber: number;
  committedPoints: number;
  completedPoints: number;
  dailyBurndown: number[]; // Array representing remaining points for each day (index 0 = day 0)
  totalDays: number;
}

export interface DeveloperDailyPoints {
  [developer: string]: {
    [date: string]: number; // date format 'YYYY-MM-DD' or similar
  };
}

export interface SprintData {
  sprints: Sprint[]; // For velocity and potentially historical burndowns
  developerPoints: DeveloperDailyPoints; // For developer contribution chart
  totalStoryPoints: number; // Overall total, maybe less useful
  daysInSprint: number; // Max days in any sprint, useful for axis scaling
}
