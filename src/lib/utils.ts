import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getYear } from 'date-fns'; // Import getYear
import { Task } from '@/types/sprint-data'; // Import Task type

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to generate the next backlog ID based on *all* items (including historical and unsaved)
export const generateNextBacklogIdHelper = (
  allProjectBacklogItems: Task[]
): string => {
  const currentYear = getYear(new Date()).toString().slice(-2); // Get last two digits of the year
  const prefix = `BL-${currentYear}`;
  let maxNum = 0;

  allProjectBacklogItems.forEach((item) => {
    const id = item.backlogId; // Use the actual backlogId
    // Consider only base BL-YYxxxx IDs from the current year
    // Use regex to extract the numeric part more reliably
    const match = id?.match(/^BL-\d{2}(\d{4})(?:-.*)?$/); // Match BL-YYNNNN or BL-YYNNNN-suffix
    if (id && id.startsWith(prefix) && match) {
      const numPart = parseInt(match[1], 10); // Get the NNNN part
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  });

  const nextNum = maxNum + 1;
  const nextNumPadded = nextNum.toString().padStart(4, '0'); // Pad with leading zeros to 4 digits
  return `${prefix}${nextNumPadded}`;
};
