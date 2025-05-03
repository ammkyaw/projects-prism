
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { SprintData, Sprint, DeveloperDailyPoints } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2 } from 'lucide-react';

interface ManualInputFormProps {
  onSubmit: (data: SprintData) => void;
}

// Add optional start/end date fields to the manual row
interface ManualEntryRow {
  id: number;
  sprintNumber: string;
  date: string;
  developer: string;
  storyPointsCompleted: string;
  dayOfSprint: string;
  totalSprintPoints: string;
  totalDaysInSprint: string;
  // Optional for direct entry, will be derived if possible
  startDate?: string;
  endDate?: string;
}


export default function ManualInputForm({ onSubmit }: ManualInputFormProps) {
  const [rows, setRows] = useState<ManualEntryRow[]>([
    { id: Date.now(), sprintNumber: '', date: '', developer: '', storyPointsCompleted: '', dayOfSprint: '', totalSprintPoints: '', totalDaysInSprint: '' }
  ]);
  const [pasteData, setPasteData] = useState<string>('');
  const { toast } = useToast();


  const handleAddRow = () => {
    setRows([...rows, { id: Date.now(), sprintNumber: '', date: '', developer: '', storyPointsCompleted: '', dayOfSprint: '', totalSprintPoints: '', totalDaysInSprint: '' }]);
  };

  const handleRemoveRow = (id: number) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: number, field: keyof Omit<ManualEntryRow, 'id'>, value: string) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
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
    // Include optional StartDate and EndDate in expected/possible headers
    const expectedHeaders = ['SprintNumber', 'Date', 'Developer', 'StoryPointsCompleted', 'DayOfSprint', 'TotalSprintPoints', 'TotalDaysInSprint', 'StartDate', 'EndDate'];
    const requiredHeaders = ['SprintNumber', 'Date', 'Developer', 'StoryPointsCompleted', 'DayOfSprint', 'TotalSprintPoints', 'TotalDaysInSprint']; // Core required
    const newRows: ManualEntryRow[] = [];
    let headerLine = '';
    let dataLines: string[] = [];

    // Check if the first line looks like a header (check against required headers)
    const firstLineCols = lines[0].split('\t'); // Assuming TSV
     if (requiredHeaders.every(header => firstLineCols.some(col => col.trim().toLowerCase() === header.toLowerCase()))) {
         headerLine = lines[0];
         dataLines = lines.slice(1);
     } else {
         // Assume no header provided, use required headers implicitly
         dataLines = lines;
     }

     const headers = headerLine ? headerLine.split('\t').map(h => h.trim()) : requiredHeaders;
     const headerMap: { [key: string]: number } = {};
     headers.forEach((h, i) => {
        // Find the canonical header name (case-insensitive) from the broader expected set
        const canonicalHeader = expectedHeaders.find(eh => eh.toLowerCase() === h.toLowerCase());
        if (canonicalHeader) {
            headerMap[canonicalHeader] = i;
        }
     });

     // Check if all REQUIRED headers are present
     const missingRequiredHeaders = requiredHeaders.filter(rh => !(rh in headerMap));
     if (missingRequiredHeaders.length > 0 && headerLine) { // Only throw error if headers were provided but are incomplete for required fields
          toast({ variant: "destructive", title: "Error", description: `Missing required columns in pasted data: ${missingRequiredHeaders.join(', ')}` });
         return;
     }


    dataLines.forEach((line, index) => {
        if (!line.trim()) return; // Skip empty lines

        const values = line.split('\t'); // Assuming TSV
         if (values.length < requiredHeaders.length && !headerLine) {
             console.warn(`Skipping pasted line ${index + (headerLine ? 2 : 1)}: Not enough columns for required data.`);
             return; // Skip if not enough columns and no headers were provided
         }

        const newRow: Partial<ManualEntryRow> = { id: Date.now() + index };

         expectedHeaders.forEach(header => { // Iterate through all possible headers
            const colIndex = headerMap[header];
             const value = colIndex !== undefined ? (values[colIndex] || '').trim() : '';
             // Only add if the header was found or it's a required one (even if implicit)
             if (colIndex !== undefined || requiredHeaders.includes(header)) {
                (newRow as any)[header] = value;
             }
         });


        // Basic check if essential fields might be empty
        if (!newRow.sprintNumber || !newRow.date || !newRow.developer || !newRow.storyPointsCompleted || !newRow.dayOfSprint || !newRow.totalSprintPoints || !newRow.totalDaysInSprint) {
           console.warn(`Skipping pasted line ${index + (headerLine ? 2 : 1)}: Contains potentially empty required fields.`, newRow);
           // Optionally skip the row or allow it and let validation handle it later
        }

        newRows.push(newRow as ManualEntryRow);
    });

    if (newRows.length === 0) {
       toast({ variant: "destructive", title: "Error", description: "No valid data rows found in the pasted text." });
       return;
    }

    setRows(newRows);
    setPasteData(''); // Clear paste area
    toast({ title: "Success", description: "Pasted data processed." });
  };


 const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sprintsMap = new Map<number, Sprint>();
    const developerPoints: DeveloperDailyPoints = {};
    let maxDaysInSprint = 0;
    let hasErrors = false;
    const sprintDateRanges = new Map<number, { min: string, max: string }>(); // Track min/max dates per sprint

    rows.forEach((row, index) => {
        // Validate and parse each field
        const sprintNumber = parseInt(row.sprintNumber, 10);
        const dateStr = row.date.trim(); // Validate YYYY-MM-DD format
        const developer = row.developer.trim();
        const points = parseInt(row.storyPointsCompleted, 10);
        const day = parseInt(row.dayOfSprint, 10);
        const totalPointsInSprint = parseInt(row.totalSprintPoints, 10);
        const totalDays = parseInt(row.totalDaysInSprint, 10);
        const startDate = row.startDate?.trim(); // Optional start date
        const endDate = row.endDate?.trim(); // Optional end date

        // --- Validation ---
        let rowErrors: string[] = [];
        if (isNaN(sprintNumber) || sprintNumber <= 0) rowErrors.push("Invalid SprintNumber");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) rowErrors.push("Invalid Date (use YYYY-MM-DD)");
        if (!developer) rowErrors.push("Developer cannot be empty");
        if (isNaN(points) || points < 0) rowErrors.push("Invalid StoryPointsCompleted");
        if (isNaN(day) || day < 0) rowErrors.push("Invalid DayOfSprint (must be >= 0)");
        if (isNaN(totalPointsInSprint) || totalPointsInSprint < 0) rowErrors.push("Invalid TotalSprintPoints");
        if (isNaN(totalDays) || totalDays < 0) rowErrors.push("Invalid TotalDaysInSprint");
        if (!isNaN(day) && !isNaN(totalDays) && day > totalDays) rowErrors.push("DayOfSprint cannot be greater than TotalDaysInSprint");
        if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) rowErrors.push("Invalid StartDate (use YYYY-MM-DD)");
        if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) rowErrors.push("Invalid EndDate (use YYYY-MM-DD)");
        if (startDate && endDate && startDate > endDate) rowErrors.push("StartDate cannot be after EndDate");


        if (rowErrors.length > 0) {
            toast({
                variant: "destructive",
                title: `Error in Row ${index + 1}`,
                description: rowErrors.join(', ')
            });
            hasErrors = true;
            return; // Stop processing this row
        }
        // --- End Validation ---

         // Update min/max date tracking for the sprint
         if (!sprintDateRanges.has(sprintNumber)) {
             sprintDateRanges.set(sprintNumber, { min: dateStr, max: dateStr });
         } else {
             const currentRange = sprintDateRanges.get(sprintNumber)!;
             if (dateStr < currentRange.min) currentRange.min = dateStr;
             if (dateStr > currentRange.max) currentRange.max = dateStr;
         }

        if (!sprintsMap.has(sprintNumber)) {
            sprintsMap.set(sprintNumber, {
                sprintNumber: sprintNumber,
                committedPoints: totalPointsInSprint,
                completedPoints: 0,
                dailyBurndown: Array(totalDays + 1).fill(totalPointsInSprint),
                totalDays: totalDays,
                 // Use provided dates if valid, otherwise they'll be derived later
                startDate: startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : undefined,
                endDate: endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : undefined,
            });
            if (totalDays > maxDaysInSprint) maxDaysInSprint = totalDays;
        }


        const currentSprint = sprintsMap.get(sprintNumber)!;
        // Consistency check for core sprint properties
         if (currentSprint.committedPoints !== totalPointsInSprint || currentSprint.totalDays !== totalDays) {
            toast({
                variant: "destructive",
                title: `Error in Row ${index + 1}`,
                description: `Inconsistent TotalSprintPoints or TotalDaysInSprint for Sprint ${sprintNumber}. Please ensure these values are the same for all entries of the same sprint.`
            });
            hasErrors = true;
            return;
         }
          // Consistency check for provided start/end dates
         if (startDate && currentSprint.startDate && startDate !== currentSprint.startDate) {
              toast({ variant: "destructive", title: `Error in Row ${index + 1}`, description: `Inconsistent StartDate for Sprint ${sprintNumber}.`});
              hasErrors = true; return;
         }
         if (endDate && currentSprint.endDate && endDate !== currentSprint.endDate) {
             toast({ variant: "destructive", title: `Error in Row ${index + 1}`, description: `Inconsistent EndDate for Sprint ${sprintNumber}.`});
             hasErrors = true; return;
         }
         // Update if dates were initially undefined
         if (startDate && !currentSprint.startDate) currentSprint.startDate = startDate;
         if (endDate && !currentSprint.endDate) currentSprint.endDate = endDate;


        currentSprint.completedPoints += points;

        // Update Burndown
        if (day >= 0 && day <= currentSprint.totalDays) {
           for (let i = day; i <= currentSprint.totalDays; i++) {
              if (currentSprint.dailyBurndown[i] !== undefined) {
                 currentSprint.dailyBurndown[i] -= points;
              }
           }
           // Ensure non-negative
            for (let i = 0; i <= currentSprint.totalDays; i++) {
               if (currentSprint.dailyBurndown[i] < 0) currentSprint.dailyBurndown[i] = 0;
            }
        }


        // Aggregate Developer Points
        if (!developerPoints[developer]) developerPoints[developer] = {};
        if (!developerPoints[developer][dateStr]) developerPoints[developer][dateStr] = 0;
        developerPoints[developer][dateStr] += points;
    });


    if (hasErrors) {
        return; // Don't submit if there were validation errors
    }


    if (sprintsMap.size === 0) {
        toast({ variant: "destructive", title: "Error", description: "No valid sprint data entered." });
        return;
    }


    // Finalize burndown calculations and derive start/end dates if not provided
     sprintsMap.forEach(sprint => {
         // Derive start/end dates from actual data if not explicitly provided or invalid
         const dateRange = sprintDateRanges.get(sprint.sprintNumber);
         if (dateRange) {
             if (!sprint.startDate) sprint.startDate = dateRange.min;
             if (!sprint.endDate) sprint.endDate = dateRange.max;
         } else {
             // Fallback if no dates were recorded for the sprint (shouldn't happen with validation)
             sprint.startDate = sprint.startDate || 'N/A';
             sprint.endDate = sprint.endDate || 'N/A';
         }


         sprint.dailyBurndown[0] = sprint.committedPoints; // Set day 0 correctly
         for (let i = 1; i <= sprint.totalDays; i++) {
             if (sprint.dailyBurndown[i] === sprint.committedPoints && sprint.dailyBurndown[i-1] !== undefined) {
                 sprint.dailyBurndown[i] = sprint.dailyBurndown[i-1];
             }
              if (sprint.dailyBurndown[i] > sprint.committedPoints) sprint.dailyBurndown[i] = sprint.committedPoints; // Cap at committed
              if (sprint.dailyBurndown[i] < 0) sprint.dailyBurndown[i] = 0; // Ensure non-negative
         }
    });

    const sprints = Array.from(sprintsMap.values()).sort((a, b) => a.sprintNumber - b.sprintNumber);


    const finalData: SprintData = {
        sprints,
        developerPoints,
        totalStoryPoints: sprints.reduce((sum, s) => sum + s.completedPoints, 0),
        daysInSprint: maxDaysInSprint,
    };

    onSubmit(finalData);
     // Optionally clear the form after successful submission
     // setRows([{ id: Date.now(), sprintNumber: '', date: '', developer: '', storyPointsCompleted: '', dayOfSprint: '', totalSprintPoints: '', totalDaysInSprint: '' }]);
  };


  return (
    <div className="space-y-6">
       {/* Paste Area */}
       <Card>
          <CardHeader>
              <CardTitle>Paste Data (Optional)</CardTitle>
               <CardDescription>Paste tab-separated data. Required columns: SprintNumber, Date (YYYY-MM-DD), Developer, StoryPointsCompleted, DayOfSprint, TotalSprintPoints, TotalDaysInSprint. Optional: StartDate, EndDate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Textarea
               placeholder="SprintNumber	Date	Developer	StoryPointsCompleted	DayOfSprint	TotalSprintPoints	TotalDaysInSprint..."
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
                Enter sprint task completion data row by row. Required fields are marked. Ensure consistency for TotalSprintPoints and TotalDaysInSprint within the same sprint. Dates must be YYYY-MM-DD.
           </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
             {/* Table Header */}
              <div className="hidden md:grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center pb-2 border-b">
                 <Label className="text-xs font-medium text-muted-foreground">Sprint*</Label>
                 <Label className="text-xs font-medium text-muted-foreground">Date*</Label>
                 <Label className="text-xs font-medium text-muted-foreground">Developer*</Label>
                 <Label className="text-xs font-medium text-muted-foreground text-right">Points*</Label>
                 <Label className="text-xs font-medium text-muted-foreground text-right">Day*</Label>
                 <Label className="text-xs font-medium text-muted-foreground text-right">Total Pts*</Label>
                 <Label className="text-xs font-medium text-muted-foreground text-right">Total Days*</Label>
                 <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
                 <Label className="text-xs font-medium text-muted-foreground">End Date</Label>
                 <div /> {/* Placeholder */}
             </div>

            {/* Input Rows */}
            <div className="space-y-3">
              {rows.map((row, index) => (
                 <div key={row.id} className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-start">
                   {/* Required Fields */}
                   <div>
                     <Label htmlFor={`sprintNumber-${row.id}`} className="md:hidden text-xs font-medium">Sprint*</Label>
                     <Input id={`sprintNumber-${row.id}`} type="number" placeholder="Sprint #" value={row.sprintNumber} onChange={e => handleInputChange(row.id, 'sprintNumber', e.target.value)} required className="h-9"/>
                   </div>
                   <div>
                     <Label htmlFor={`date-${row.id}`} className="md:hidden text-xs font-medium">Date*</Label>
                     <Input id={`date-${row.id}`} type="date" value={row.date} onChange={e => handleInputChange(row.id, 'date', e.target.value)} required className="h-9"/>
                   </div>
                   <div>
                     <Label htmlFor={`developer-${row.id}`} className="md:hidden text-xs font-medium">Developer*</Label>
                     <Input id={`developer-${row.id}`} placeholder="Developer" value={row.developer} onChange={e => handleInputChange(row.id, 'developer', e.target.value)} required className="h-9"/>
                   </div>
                   <div>
                     <Label htmlFor={`points-${row.id}`} className="md:hidden text-xs font-medium">Points*</Label>
                     <Input id={`points-${row.id}`} type="number" placeholder="Points" value={row.storyPointsCompleted} onChange={e => handleInputChange(row.id, 'storyPointsCompleted', e.target.value)} required className="h-9 text-right"/>
                   </div>
                   <div>
                     <Label htmlFor={`day-${row.id}`} className="md:hidden text-xs font-medium">Day*</Label>
                     <Input id={`day-${row.id}`} type="number" placeholder="Day" value={row.dayOfSprint} onChange={e => handleInputChange(row.id, 'dayOfSprint', e.target.value)} required className="h-9 text-right"/>
                   </div>
                   <div>
                      <Label htmlFor={`totalPoints-${row.id}`} className="md:hidden text-xs font-medium">Total Pts*</Label>
                     <Input id={`totalPoints-${row.id}`} type="number" placeholder="Total Pts" value={row.totalSprintPoints} onChange={e => handleInputChange(row.id, 'totalSprintPoints', e.target.value)} required className="h-9 text-right"/>
                   </div>
                   <div>
                      <Label htmlFor={`totalDays-${row.id}`} className="md:hidden text-xs font-medium">Total Days*</Label>
                     <Input id={`totalDays-${row.id}`} type="number" placeholder="Total Days" value={row.totalDaysInSprint} onChange={e => handleInputChange(row.id, 'totalDaysInSprint', e.target.value)} required className="h-9 text-right"/>
                   </div>
                    {/* Optional Date Fields */}
                   <div>
                     <Label htmlFor={`startDate-${row.id}`} className="md:hidden text-xs font-medium">Start Date</Label>
                     <Input id={`startDate-${row.id}`} type="date" value={row.startDate || ''} onChange={e => handleInputChange(row.id, 'startDate', e.target.value)} className="h-9"/>
                   </div>
                   <div>
                     <Label htmlFor={`endDate-${row.id}`} className="md:hidden text-xs font-medium">End Date</Label>
                     <Input id={`endDate-${row.id}`} type="date" value={row.endDate || ''} onChange={e => handleInputChange(row.id, 'endDate', e.target.value)} className="h-9"/>
                   </div>


                   {/* Delete Button */}
                   <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveRow(row.id)} className="h-9 w-9 text-muted-foreground hover:text-destructive self-center" aria-label="Remove row">
                     <Trash2 className="h-4 w-4" />
                   </Button>
                 </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4">
               <Button type="button" onClick={handleAddRow} variant="outline" size="sm">
                 <PlusCircle className="mr-2 h-4 w-4" />
                 Add Row
               </Button>
               <Button type="submit">Generate Reports</Button>
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
