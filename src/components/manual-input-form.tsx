
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" // Import Select component
import type { SprintData, Sprint } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2 } from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns'; // For date calculations
import { cn } from "@/lib/utils";


interface ManualInputFormProps {
  onSubmit: (data: SprintData) => void;
}

// Updated row structure for manual entry
interface ManualEntryRow {
  id: number;
  sprintNumber: string;
  startDate: string;
  duration: string; // e.g., "1 Week", "2 Weeks"
  totalCommitment: string;
  totalDelivered: string;
  details: string;
}

const DURATION_OPTIONS = ["1 Week", "2 Weeks", "3 Weeks", "4 Weeks"];

// Helper to calculate working days and end date from duration string
const calculateSprintMetrics = (startDateStr: string, duration: string): { totalDays: number, endDate: string } => {
    let totalDays = 0;
    let calendarDaysToAdd = 0;

    switch (duration) {
        case "1 Week":
            totalDays = 5;
            calendarDaysToAdd = 6; // Saturday
            break;
        case "2 Weeks":
            totalDays = 10;
            calendarDaysToAdd = 13; // Following Saturday
            break;
        case "3 Weeks":
            totalDays = 15;
            calendarDaysToAdd = 20; // Following Saturday
            break;
        case "4 Weeks":
            totalDays = 20;
            calendarDaysToAdd = 27; // Following Saturday
            break;
        default:
            totalDays = 0;
            calendarDaysToAdd = -1; // Indicate invalid duration
    }

    if (!startDateStr || calendarDaysToAdd < 0) {
        return { totalDays: 0, endDate: 'N/A' };
    }

    try {
        const startDate = parseISO(startDateStr); // Handles YYYY-MM-DD
        const endDate = addDays(startDate, calendarDaysToAdd);
        return { totalDays, endDate: format(endDate, 'yyyy-MM-dd') };
    } catch (e) {
        console.error("Error calculating end date:", e);
        return { totalDays: 0, endDate: 'N/A' };
    }
};


export default function ManualInputForm({ onSubmit }: ManualInputFormProps) {
  const [rows, setRows] = useState<ManualEntryRow[]>([
    { id: Date.now(), sprintNumber: '', startDate: '', duration: '', totalCommitment: '', totalDelivered: '', details: '' }
  ]);
  const [pasteData, setPasteData] = useState<string>('');
  const { toast } = useToast();


  const handleAddRow = () => {
     setRows([...rows, { id: Date.now(), sprintNumber: '', startDate: '', duration: '', totalCommitment: '', totalDelivered: '', details: '' }]);
  };

  const handleRemoveRow = (id: number) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleInputChange = (id: number, field: keyof Omit<ManualEntryRow, 'id'>, value: string) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

   // Specific handler for Select component
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
    // Update expected headers for simplified format
    const expectedHeaders = ['SprintNumber', 'StartDate', 'Duration', 'TotalCommitment', 'TotalDelivered', 'Details'];
    const requiredHeaders = ['SprintNumber', 'StartDate', 'Duration', 'TotalCommitment', 'TotalDelivered']; // Core required
    const newRows: ManualEntryRow[] = [];
    let headerLine = '';
    let dataLines: string[] = [];

    // Check if the first line looks like a header
    const firstLineCols = lines[0].split('\t'); // Assuming TSV
     if (requiredHeaders.every(header => firstLineCols.some(col => col.trim().toLowerCase() === header.toLowerCase()))) {
         headerLine = lines[0];
         dataLines = lines.slice(1);
     } else {
         // Assume no header provided, use required headers implicitly
         dataLines = lines;
         // Verify if the number of columns matches required headers count if no header detected
         if (firstLineCols.length < requiredHeaders.length) {
              toast({ variant: "destructive", title: "Error", description: `Pasted data seems to be missing columns. Expected at least ${requiredHeaders.length}.` });
              return;
         }
     }

     const headers = headerLine ? headerLine.split('\t').map(h => h.trim()) : requiredHeaders;
     const headerMap: { [key: string]: number } = {};
     headers.forEach((h, i) => {
        // Find the canonical header name (case-insensitive) from the broader expected set
        const canonicalHeader = expectedHeaders.find(eh => eh.toLowerCase() === h.toLowerCase());
        if (canonicalHeader) {
            headerMap[canonicalHeader] = i;
        } else if (!headerLine && i < expectedHeaders.length) {
            // If no header, map based on order up to expected headers count
            headerMap[expectedHeaders[i]] = i;
        }
     });

     // Check if all REQUIRED headers are mapped
     const missingRequiredHeaders = requiredHeaders.filter(rh => !(rh in headerMap));
      if (missingRequiredHeaders.length > 0) {
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
             // Only add if the header was found or it's an implicit required one
             if (colIndex !== undefined || requiredHeaders.includes(header)) {
                // Map spreadsheet header names to ManualEntryRow field names
                switch(header) {
                    case 'SprintNumber': newRow.sprintNumber = value; break;
                    case 'StartDate': newRow.startDate = value; break;
                    case 'Duration': newRow.duration = value; break;
                    case 'TotalCommitment': newRow.totalCommitment = value; break;
                    case 'TotalDelivered': newRow.totalDelivered = value; break;
                    case 'Details': newRow.details = value; break;
                }
             }
         });

        // Basic check if essential fields might be empty after mapping
        if (!newRow.sprintNumber || !newRow.startDate || !newRow.duration || !newRow.totalCommitment || !newRow.totalDelivered) {
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

    const sprints: Sprint[] = [];
    let hasErrors = false;
    let maxTotalDays = 0; // Track max days for SprintData

    rows.forEach((row, index) => {
        // Validate and parse each field
        const sprintNumber = parseInt(row.sprintNumber, 10);
        const startDateStr = row.startDate.trim(); // Validate YYYY-MM-DD format
        const duration = row.duration.trim();
        const commitment = parseInt(row.totalCommitment, 10);
        const delivered = parseInt(row.totalDelivered, 10);
        const details = row.details?.trim();

        // --- Validation ---
        let rowErrors: string[] = [];
        if (isNaN(sprintNumber) || sprintNumber <= 0) rowErrors.push("Invalid Sprint #");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) rowErrors.push("Invalid Start Date (use YYYY-MM-DD)");
         if (!duration || !DURATION_OPTIONS.includes(duration)) rowErrors.push("Invalid Duration");
        if (isNaN(commitment) || commitment < 0) rowErrors.push("Invalid Total Commitment");
        if (isNaN(delivered) || delivered < 0) rowErrors.push("Invalid Total Delivered");
        if (!isNaN(delivered) && !isNaN(commitment) && delivered > commitment) rowErrors.push("Delivered cannot exceed Commitment");


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

         // Calculate derived fields
         const { totalDays, endDate } = calculateSprintMetrics(startDateStr, duration);
         if (totalDays <= 0 || endDate === 'N/A') {
             toast({ variant: "destructive", title: `Error in Row ${index + 1}`, description: "Could not calculate sprint metrics from Start Date and Duration." });
             hasErrors = true;
             return;
         }

         // Track maximum total days
         if (totalDays > maxTotalDays) {
             maxTotalDays = totalDays;
         }


        // Create Sprint object
        sprints.push({
            sprintNumber,
            startDate: startDateStr,
            duration,
            committedPoints: commitment,
            completedPoints: delivered,
            details,
            totalDays,
            endDate
        });
    });


    if (hasErrors) {
        return; // Don't submit if there were validation errors
    }

    if (sprints.length === 0) {
        toast({ variant: "destructive", title: "Error", description: "No valid sprint data entered." });
        return;
    }

    // Sort sprints by number
    sprints.sort((a, b) => a.sprintNumber - b.sprintNumber);


    const finalData: SprintData = {
        sprints,
        totalStoryPoints: sprints.reduce((sum, s) => sum + s.completedPoints, 0),
        daysInSprint: maxTotalDays, // Use the calculated max total days
    };

    onSubmit(finalData);
     // Optionally clear the form after successful submission
     // setRows([{ id: Date.now(), sprintNumber: '', startDate: '', duration: '', totalCommitment: '', totalDelivered: '', details: '' }]);
  };


  return (
    <div className="space-y-6">
       {/* Paste Area */}
       <Card>
          <CardHeader>
              <CardTitle>Paste Data (Optional)</CardTitle>
               <CardDescription>Paste tab-separated data. Columns: SprintNumber, StartDate (YYYY-MM-DD), Duration (e.g., '2 Weeks'), TotalCommitment, TotalDelivered, Details (optional).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <Textarea
               placeholder="SprintNumber	StartDate	Duration	TotalCommitment	TotalDelivered	Details..."
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
                Enter sprint data row by row. Required fields are marked. Dates must be YYYY-MM-DD.
           </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
             {/* Table Header */}
              <div className="hidden md:grid grid-cols-[80px_1fr_1fr_1fr_1fr_2fr_auto] gap-2 items-center pb-2 border-b">
                 <Label className="text-xs font-medium text-muted-foreground">Sprint #*</Label>
                 <Label className="text-xs font-medium text-muted-foreground">Start Date*</Label>
                 <Label className="text-xs font-medium text-muted-foreground">Duration*</Label>
                 <Label className="text-xs font-medium text-muted-foreground text-right">Commitment*</Label>
                 <Label className="text-xs font-medium text-muted-foreground text-right">Delivered*</Label>
                 <Label className="text-xs font-medium text-muted-foreground">Details</Label>
                 <div /> {/* Placeholder for delete button */}
             </div>

            {/* Input Rows */}
            <div className="space-y-3">
              {rows.map((row, index) => (
                 <div key={row.id} className="grid grid-cols-1 md:grid-cols-[80px_1fr_1fr_1fr_1fr_2fr_auto] gap-2 items-start">
                   {/* Sprint Number */}
                   <div>
                     <Label htmlFor={`sprintNumber-${row.id}`} className="md:hidden text-xs font-medium">Sprint #*</Label>
                     <Input id={`sprintNumber-${row.id}`} type="number" placeholder="#" value={row.sprintNumber} onChange={e => handleInputChange(row.id, 'sprintNumber', e.target.value)} required className="h-9 w-full"/> {/* Adjusted width */}
                   </div>
                   {/* Start Date */}
                   <div>
                     <Label htmlFor={`startDate-${row.id}`} className="md:hidden text-xs font-medium">Start Date*</Label>
                     <Input id={`startDate-${row.id}`} type="date" value={row.startDate} onChange={e => handleInputChange(row.id, 'startDate', e.target.value)} required className="h-9"/>
                   </div>
                   {/* Duration */}
                    <div>
                         <Label htmlFor={`duration-${row.id}`} className="md:hidden text-xs font-medium">Duration*</Label>
                        <Select value={row.duration} onValueChange={(value) => handleDurationChange(row.id, value)} required>
                          <SelectTrigger id={`duration-${row.id}`} className="h-9">
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
                   <div>
                     <Label htmlFor={`commitment-${row.id}`} className="md:hidden text-xs font-medium">Commitment*</Label>
                     <Input id={`commitment-${row.id}`} type="number" placeholder="Points" value={row.totalCommitment} onChange={e => handleInputChange(row.id, 'totalCommitment', e.target.value)} required className="h-9 text-right"/>
                   </div>
                   {/* Delivered */}
                   <div>
                     <Label htmlFor={`delivered-${row.id}`} className="md:hidden text-xs font-medium">Delivered*</Label>
                     <Input id={`delivered-${row.id}`} type="number" placeholder="Points" value={row.totalDelivered} onChange={e => handleInputChange(row.id, 'totalDelivered', e.target.value)} required className="h-9 text-right"/>
                   </div>
                   {/* Details */}
                   <div>
                     <Label htmlFor={`details-${row.id}`} className="md:hidden text-xs font-medium">Details</Label>
                     <Input id={`details-${row.id}`} placeholder="Optional notes..." value={row.details} onChange={e => handleInputChange(row.id, 'details', e.target.value)} className="h-9"/>
                   </div>


                   {/* Delete Button */}
                   <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveRow(row.id)} className="h-9 w-9 text-muted-foreground hover:text-destructive self-center mt-1 md:mt-0" aria-label="Remove row">
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
