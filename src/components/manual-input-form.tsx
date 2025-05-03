
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SprintData, Sprint, SprintStatus } from '@/types/sprint-data'; // Import SprintStatus
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2 } from 'lucide-react';
import { addDays, format, parseISO, isPast } from 'date-fns'; // Import isPast
import { cn } from "@/lib/utils";

interface ManualInputFormProps {
  key?: number; // Accept key prop
  onSubmit: (data: SprintData) => void;
  initialData?: Sprint[]; // Optional initial sprint data
}

// Updated row structure for manual entry
interface ManualEntryRow {
  id: number; // Use for React key, persistent across renders
  sprintNumber: string;
  startDate: string;
  duration: string; // e.g., "1 Week", "2 Weeks"
  totalCommitment: string;
  totalDelivered: string;
  status: SprintStatus; // Keep track of status internally if needed, though likely overwritten on submit
}

const DURATION_OPTIONS = ["1 Week", "2 Weeks", "3 Weeks", "4 Weeks"];

// Helper to calculate working days and end date from duration string (remains the same)
const calculateSprintMetrics = (startDateStr: string, duration: string): { totalDays: number, endDate: string } => {
    let totalDays = 0;
    let calendarDaysToAdd = 0;

    switch (duration) {
        case "1 Week": totalDays = 5; calendarDaysToAdd = 6; break;
        case "2 Weeks": totalDays = 10; calendarDaysToAdd = 13; break;
        case "3 Weeks": totalDays = 15; calendarDaysToAdd = 20; break;
        case "4 Weeks": totalDays = 20; calendarDaysToAdd = 27; break;
        default: totalDays = 0; calendarDaysToAdd = -1;
    }

    if (!startDateStr || calendarDaysToAdd < 0) {
        return { totalDays: 0, endDate: 'N/A' };
    }

    try {
        const startDate = parseISO(startDateStr);
        const endDate = addDays(startDate, calendarDaysToAdd);
        return { totalDays, endDate: format(endDate, 'yyyy-MM-dd') };
    } catch (e) {
        console.error("Error calculating end date:", e);
        return { totalDays: 0, endDate: 'N/A' };
    }
};

// Helper to convert Sprint to ManualEntryRow
const sprintToRow = (sprint: Sprint, index: number): ManualEntryRow => ({
  id: Date.now() + index, // Assign a unique ID for the row
  sprintNumber: sprint.sprintNumber.toString(),
  startDate: sprint.startDate,
  duration: sprint.duration,
  totalCommitment: sprint.committedPoints.toString(),
  totalDelivered: sprint.completedPoints.toString(),
  status: sprint.status ?? 'Planned', // Include status
});

// Helper to create an empty row
const createEmptyRow = (): ManualEntryRow => ({
    id: Date.now(),
    sprintNumber: '',
    startDate: '',
    duration: '',
    totalCommitment: '',
    totalDelivered: '',
    status: 'Planned', // Default status for new rows
});


export default function ManualInputForm({ onSubmit, initialData = [] }: ManualInputFormProps) {
  const [rows, setRows] = useState<ManualEntryRow[]>([]);
  const [pasteData, setPasteData] = useState<string>('');
  const { toast } = useToast();
   const [clientNow, setClientNow] = useState<Date | null>(null); // For client-side date comparison

   // Get current date on client mount
   useEffect(() => {
     setClientNow(new Date());
   }, []);


  // Effect to initialize or update rows based on initialData prop
  useEffect(() => {
    if (initialData.length > 0) {
      setRows(initialData.map(sprintToRow));
    } else {
      // Initialize with one empty row if initialData is empty or becomes empty
      setRows([createEmptyRow()]);
    }
  }, [initialData]); // Re-run effect if initialData changes


  const handleAddRow = () => {
     setRows([...rows, createEmptyRow()]);
  };

  const handleRemoveRow = (id: number) => {
    setRows(prevRows => {
       const newRows = prevRows.filter(row => row.id !== id);
       // If removing the last row, add a new empty one back
       return newRows.length > 0 ? newRows : [createEmptyRow()];
    });
  };

  const handleInputChange = (id: number, field: keyof Omit<ManualEntryRow, 'id'>, value: string) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleDurationChange = (id: number, value: string) => {
     handleInputChange(id, 'duration', value);
  };

  const handlePasteChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setPasteData(event.target.value);
  };

 const processPastedData = () => {
    if (!pasteData.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Paste area is empty." });
      return;
    }

    const lines = pasteData.trim().split('\n');
    // Required columns for basic functionality
    const requiredHeaders = ['SprintNumber', 'StartDate', 'Duration', 'TotalCommitment', 'TotalDelivered'];
    // Optional columns (status might be provided)
    const optionalHeaders = ['Status'];
    const expectedHeaders = [...requiredHeaders, ...optionalHeaders];

    const newRows: ManualEntryRow[] = [];
    let headerLine = '';
    let dataLines: string[] = [];

    const firstLineCols = lines[0].split('\t').map(h => h.trim().toLowerCase());
     // Check if the first line looks like a header row containing all required columns
     if (requiredHeaders.every(header => firstLineCols.includes(header.toLowerCase()))) {
         headerLine = lines[0];
         dataLines = lines.slice(1);
     } else {
         dataLines = lines;
         // Basic check if enough columns exist if no header detected
         if (lines[0].split('\t').length < requiredHeaders.length) {
              toast({ variant: "destructive", title: "Error", description: `Pasted data seems to be missing columns. Expected at least ${requiredHeaders.length}.` });
              return;
         }
     }

     const headers = headerLine ? headerLine.split('\t').map(h => h.trim()) : requiredHeaders; // Use required if no header detected
     const headerMap: { [key: string]: number } = {};
     headers.forEach((h, i) => {
        const canonicalHeader = expectedHeaders.find(eh => eh.toLowerCase() === h.toLowerCase());
        if (canonicalHeader) {
            headerMap[canonicalHeader] = i;
        }
     });

     const missingRequiredHeaders = requiredHeaders.filter(rh => !(rh in headerMap));
      if (missingRequiredHeaders.length > 0) {
            toast({ variant: "destructive", title: "Error", description: `Missing required columns in pasted data: ${missingRequiredHeaders.join(', ')}` });
           return;
       }

    dataLines.forEach((line, index) => {
        if (!line.trim()) return;

        const values = line.split('\t');

        const newRow: Partial<ManualEntryRow> = { id: Date.now() + index };

         requiredHeaders.forEach(header => {
            const colIndex = headerMap[header];
            const value = colIndex !== undefined ? (values[colIndex] || '').trim() : '';
            if (value || colIndex !== undefined) { // Only assign if value exists or column was present
                switch(header) {
                    case 'SprintNumber': newRow.sprintNumber = value; break;
                    case 'StartDate': newRow.startDate = value; break;
                    case 'Duration': newRow.duration = value; break;
                    case 'TotalCommitment': newRow.totalCommitment = value; break;
                    case 'TotalDelivered': newRow.totalDelivered = value; break;
                }
             }
         });

          // Handle optional Status column
          const statusIndex = headerMap['Status'];
          let statusValue = 'Planned'; // Default
          if (statusIndex !== undefined && values[statusIndex]) {
               const pastedStatus = values[statusIndex].trim();
               if (['Planned', 'Active', 'Completed'].includes(pastedStatus)) {
                   statusValue = pastedStatus as SprintStatus;
               } else {
                  console.warn(`Ignoring invalid status "${pastedStatus}" in pasted row ${index + (headerLine ? 2 : 1)}. Defaulting to 'Planned'.`);
               }
          }
          newRow.status = statusValue as SprintStatus;


        // Basic validation for required fields before adding
        if (!newRow.sprintNumber || !newRow.startDate || !newRow.duration || !newRow.totalCommitment || !newRow.totalDelivered) {
           console.warn(`Skipping pasted line ${index + (headerLine ? 2 : 1)}: Missing one or more required fields (SprintNumber, StartDate, Duration, TotalCommitment, TotalDelivered).`, newRow);
           return; // Skip this row
        }


        newRows.push(newRow as ManualEntryRow);
    });

    if (newRows.length === 0) {
       toast({ variant: "destructive", title: "Error", description: "No valid data rows found in the pasted text." });
       return;
    }

    // Replace existing rows with pasted data
    setRows(newRows);
    setPasteData('');
    toast({ title: "Success", description: "Pasted data processed. Review and click Save." });
  };


 const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sprints: Sprint[] = [];
    let hasErrors = false;
    let maxTotalDays = 0;
    const sprintNumbers = new Set<number>(); // To check for duplicate sprint numbers

    rows.forEach((row, index) => {
        // Skip completely empty rows silently
        if (!row.sprintNumber && !row.startDate && !row.duration && !row.totalCommitment && !row.totalDelivered) {
            return;
        }

        const sprintNumber = parseInt(row.sprintNumber, 10);
        const startDateStr = row.startDate.trim();
        const duration = row.duration.trim();
        const commitment = parseInt(row.totalCommitment, 10);
        const delivered = parseInt(row.totalDelivered, 10);

        let rowErrors: string[] = [];
        if (isNaN(sprintNumber) || sprintNumber <= 0) rowErrors.push("Invalid Sprint #");
        if (sprintNumbers.has(sprintNumber)) rowErrors.push(`Duplicate Sprint #${sprintNumber}`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) rowErrors.push("Invalid Start Date (use YYYY-MM-DD)");
         if (!duration || !DURATION_OPTIONS.includes(duration)) rowErrors.push("Invalid Duration");
        if (isNaN(commitment) || commitment < 0) rowErrors.push("Invalid Total Commitment");
        if (isNaN(delivered) || delivered < 0) rowErrors.push("Invalid Total Delivered");


        if (rowErrors.length > 0) {
            toast({
                variant: "destructive",
                title: `Error in Row ${index + 1}`,
                description: rowErrors.join(', ')
            });
            hasErrors = true;
            return; // Stop processing this row
        }

        sprintNumbers.add(sprintNumber); // Add valid number to set

         const { totalDays, endDate } = calculateSprintMetrics(startDateStr, duration);
         if (totalDays <= 0 || endDate === 'N/A') {
             toast({ variant: "destructive", title: `Error in Row ${index + 1}`, description: "Could not calculate sprint metrics from Start Date and Duration." });
             hasErrors = true;
             return;
         }

         if (totalDays > maxTotalDays) {
             maxTotalDays = totalDays;
         }

          // Determine initial status based on date (on client side for consistency)
          let initialStatus: SprintStatus = 'Planned';
          if (clientNow) {
              try {
                 const start = parseISO(startDateStr);
                 const end = parseISO(endDate);
                 if (isPast(end)) {
                     initialStatus = 'Completed';
                 } // Otherwise remains 'Planned', active status is set manually.
              } catch (e) {
                 console.error("Error parsing date for status check", e);
                  toast({ variant: "destructive", title: `Error in Row ${index + 1}`, description: "Invalid date format encountered during status check." });
                  hasErrors = true;
                  return;
              }
          }

        sprints.push({
            sprintNumber,
            startDate: startDateStr,
            duration,
            committedPoints: commitment,
            completedPoints: delivered,
            status: initialStatus, // Assign calculated initial status
            details: [], // Initialize details array when submitting
            planning: undefined, // Initialize planning as undefined
            totalDays,
            endDate
        });
    });


    if (hasErrors) {
        return;
    }

    sprints.sort((a, b) => a.sprintNumber - b.sprintNumber);

    const finalData: SprintData = {
        sprints,
        totalStoryPoints: sprints.reduce((sum, s) => sum + s.completedPoints, 0),
        daysInSprint: maxTotalDays,
    };

    onSubmit(finalData);
    // Form reset is handled by the parent component via the key prop
  };


  return (
    <div className="space-y-6">
       {/* Paste Area */}
       <Card>
          <CardHeader>
              <CardTitle>Paste Data (Optional)</CardTitle>
               <CardDescription>Paste tab-separated data to replace current entries. Required columns: SprintNumber, StartDate (YYYY-MM-DD), Duration ('1 Week', '2 Weeks', etc.), TotalCommitment, TotalDelivered. Optional: Status ('Planned', 'Active', 'Completed').</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Textarea
               placeholder="SprintNumber	StartDate	Duration	TotalCommitment	TotalDelivered	Status"
               value={pasteData}
               onChange={handlePasteChange}
               rows={5}
               className="text-sm font-mono"
             />
             <Button onClick={processPastedData} variant="secondary" size="sm">Process Pasted Data</Button>
          </CardContent>
       </Card>

       {/* Manual Entry Form */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Sprint Data Entry</CardTitle>
           <CardDescription>
                Enter or edit sprint data row by row. Required fields are marked. Dates must be YYYY-MM-DD. Sprints are initially 'Planned' or 'Completed' based on end date. Activate sprints in the 'Planning' tab.
           </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
               {/* Updated Grid for better alignment */}
              <div className="hidden md:grid grid-cols-[80px_140px_140px_100px_100px_40px] gap-x-3 items-center pb-2 border-b">
                 <Label className="text-xs font-medium text-muted-foreground">Sprint #*</Label>
                 <Label className="text-xs font-medium text-muted-foreground">Start Date*</Label>
                 <Label className="text-xs font-medium text-muted-foreground">Duration*</Label>
                 <Label className="text-xs font-medium text-muted-foreground text-right">Commitment*</Label>
                 <Label className="text-xs font-medium text-muted-foreground text-right">Delivered*</Label>
                 <div /> {/* Placeholder for delete button column */}
             </div>

            {/* Input Rows */}
            <div className="space-y-4 md:space-y-2">
              {rows.map((row, index) => (
                 <div key={row.id} className="grid grid-cols-2 md:grid-cols-[80px_140px_140px_100px_100px_40px] gap-x-3 gap-y-2 items-start">
                   {/* Sprint Number */}
                   <div className="md:col-span-1 col-span-1">
                     <Label htmlFor={`sprintNumber-${row.id}`} className="md:hidden text-xs font-medium">Sprint #*</Label>
                     <Input id={`sprintNumber-${row.id}`} type="number" placeholder="#" value={row.sprintNumber} onChange={e => handleInputChange(row.id, 'sprintNumber', e.target.value)} required className="h-9 w-full"/>
                   </div>
                   {/* Start Date */}
                   <div className="md:col-span-1 col-span-1">
                     <Label htmlFor={`startDate-${row.id}`} className="md:hidden text-xs font-medium">Start Date*</Label>
                     <Input id={`startDate-${row.id}`} type="date" value={row.startDate} onChange={e => handleInputChange(row.id, 'startDate', e.target.value)} required className="h-9 w-full"/>
                   </div>
                   {/* Duration */}
                    <div className="md:col-span-1 col-span-2">
                         <Label htmlFor={`duration-${row.id}`} className="md:hidden text-xs font-medium">Duration*</Label>
                        <Select value={row.duration} onValueChange={(value) => handleDurationChange(row.id, value)} required>
                          <SelectTrigger id={`duration-${row.id}`} className="h-9 w-full">
                            <SelectValue placeholder="Select Duration" />
                          </SelectTrigger>
                          <SelectContent>
                             {DURATION_OPTIONS.map(option => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                             ))}
                          </SelectContent>
                        </Select>
                    </div>
                   {/* Commitment */}
                   <div className="md:col-span-1 col-span-1">
                     <Label htmlFor={`commitment-${row.id}`} className="md:hidden text-xs font-medium">Commitment*</Label>
                     <Input id={`commitment-${row.id}`} type="number" placeholder="Points" value={row.totalCommitment} onChange={e => handleInputChange(row.id, 'totalCommitment', e.target.value)} required className="h-9 text-right w-full"/>
                   </div>
                   {/* Delivered */}
                   <div className="md:col-span-1 col-span-1">
                     <Label htmlFor={`delivered-${row.id}`} className="md:hidden text-xs font-medium">Delivered*</Label>
                     <Input id={`delivered-${row.id}`} type="number" placeholder="Points" value={row.totalDelivered} onChange={e => handleInputChange(row.id, 'totalDelivered', e.target.value)} required className="h-9 text-right w-full"/>
                   </div>

                   {/* Delete Button */}
                   <div className="flex items-center justify-end md:col-span-1 col-span-2 md:self-center md:mt-0 mt-1">
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveRow(row.id)} className="h-9 w-9 text-muted-foreground hover:text-destructive" aria-label="Remove row">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                   </div>
                 </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4">
               <Button type="button" onClick={handleAddRow} variant="outline" size="sm">
                 <PlusCircle className="mr-2 h-4 w-4" />
                 Add Row
               </Button>
               <Button type="submit">Save</Button>
            </div>
          </form>
        </CardContent>
         <CardFooter>
            <p className="text-xs text-muted-foreground">* Required field.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
