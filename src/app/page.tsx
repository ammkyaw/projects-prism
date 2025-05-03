
"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState, useEffect } from 'react'; // Import useState and useEffect
import * as XLSX from 'xlsx';
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants explicitly
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, BarChart, LineChart, Users, Edit } from 'lucide-react';
import VelocityChart from '@/components/charts/velocity-chart';
import BurndownChart from '@/components/charts/burndown-chart';
import DeveloperPointsChart from '@/components/charts/developer-points-chart';
import ManualInputForm from '@/components/manual-input-form'; // Import the new form component
import type { SprintData, DeveloperDailyPoints, Sprint } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils"; // Import cn utility function

export default function Home() {
  const [sprintData, setSprintData] = useState<SprintData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [inputMode, setInputMode] = useState<'upload' | 'manual' | null>(null); // Track input mode
  const { toast } = useToast();

  // Clear data when switching input modes
  useEffect(() => {
    setSprintData(null);
    setFileName('');
  }, [inputMode]);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setInputMode('upload'); // Set mode on new upload
    setFileName(file.name);
    setSprintData(null); // Clear previous data

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // Ensure header option includes empty strings for potentially missing headers
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (jsonData.length < 2) {
            throw new Error("CSV file must contain headers and at least one data row.");
        }

        // Extract headers from the first row
        const headers: string[] = jsonData[0].map(String);
        // Convert subsequent rows to objects using headers
        const dataRows = jsonData.slice(1).map(rowArray => {
            let rowObject: { [key: string]: any } = {};
            headers.forEach((header, index) => {
                // Use header only if it's not empty
                if(header?.trim()) {
                    rowObject[header.trim()] = rowArray[index];
                }
            });
            return rowObject;
        });

        // Basic validation and parsing (adapt based on actual CSV structure)
        const parsedData = parseSprintData(dataRows);
        setSprintData(parsedData);
        toast({ title: "Success", description: "File uploaded and processed." });
      } catch (error: any) {
        console.error("Error parsing file:", error);
        toast({
          variant: "destructive",
          title: "Error Parsing File",
          description: error.message || "Failed to parse file. Please ensure it's in the correct format with required headers.",
        })
        setFileName(''); // Reset filename on error
        setSprintData(null); // Reset data on error
        setInputMode(null); // Reset mode
      }
    };

    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      toast({
        variant: "destructive",
        title: "Error Reading File",
        description: "Failed to read the file.",
      })
      setFileName(''); // Reset filename on error
      setInputMode(null); // Reset mode
    }

    reader.readAsBinaryString(file);
  };


  // Parsing function for uploaded file data
  const parseSprintData = (jsonData: any[]): SprintData => {
     const requiredColumns = ['SprintNumber', 'Date', 'Developer', 'StoryPointsCompleted', 'DayOfSprint', 'TotalSprintPoints', 'TotalDaysInSprint'];
    // Check if jsonData is valid and has at least one row
    if (!jsonData || jsonData.length === 0) {
        throw new Error("No data found in the file.");
    }
     // Check for required headers in the first row object keys
    const firstRowKeys = Object.keys(jsonData[0]);
    const missingColumns = requiredColumns.filter(col => !firstRowKeys.includes(col));
    if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    const sprintsMap = new Map<number, Sprint>();
    const developerPoints: DeveloperDailyPoints = {};
    let maxDaysInSprint = 0;

    jsonData.forEach((row, rowIndex) => {
      const sprintNumber = parseInt(row.SprintNumber, 10);
      let date = row.Date; // Can be Excel date number or string
      const developer = row.Developer?.toString().trim();
      const points = parseInt(row.StoryPointsCompleted, 10);
      const day = parseInt(row.DayOfSprint, 10);
      const totalPointsInSprint = parseInt(row.TotalSprintPoints, 10);
      const totalDays = parseInt(row.TotalDaysInSprint, 10);

      // Validate essential data for each row
      if (isNaN(sprintNumber) || !date || !developer || isNaN(points) || isNaN(day) || isNaN(totalPointsInSprint) || isNaN(totalDays)) {
        console.warn(`Skipping invalid row ${rowIndex + 2}:`, row); // +2 because of header and 0-indexing
        return; // Skip rows with missing or invalid essential data
      }
       if (day < 0 || day > totalDays) {
          console.warn(`Skipping row ${rowIndex + 2}: DayOfSprint (${day}) is outside the valid range (0-${totalDays}).`);
          return;
       }

      // Format date consistently (handle Excel date numbers)
       let dateStr: string;
       if (typeof date === 'number') {
         // Check if it's a valid Excel date number (greater than 0)
         if (date > 0) {
           try {
              // Use XLSX utility function to format the date number
             dateStr = XLSX.SSF.format('yyyy-mm-dd', date);
           } catch (e) {
              console.warn(`Skipping row ${rowIndex + 2}: Invalid date format for value ${date}. Using original value.`);
              dateStr = date.toString(); // Fallback to string
           }
         } else {
             console.warn(`Skipping row ${rowIndex + 2}: Invalid Excel date number ${date}.`);
             return; // Skip if date number is not positive
         }
       } else if (typeof date === 'string') {
         // Attempt to parse common date string formats if needed, otherwise assume 'yyyy-mm-dd'
         // For simplicity, we assume it's already in a usable format or 'yyyy-mm-dd'
         dateStr = date.split('T')[0]; // Basic handling for ISO strings
       } else {
          console.warn(`Skipping row ${rowIndex + 2}: Unrecognized date type ${typeof date}.`);
         return; // Skip if date type is not recognized
       }


      if (!sprintsMap.has(sprintNumber)) {
        sprintsMap.set(sprintNumber, {
          sprintNumber: sprintNumber,
          committedPoints: totalPointsInSprint,
          completedPoints: 0,
          dailyBurndown: Array(totalDays + 1).fill(totalPointsInSprint), // Initialize burndown
          totalDays: totalDays,
        });
        if (totalDays > maxDaysInSprint) maxDaysInSprint = totalDays;
      }

      const currentSprint = sprintsMap.get(sprintNumber)!;
      // Ensure the TotalSprintPoints and TotalDaysInSprint are consistent for the same sprint number
       if (currentSprint.committedPoints !== totalPointsInSprint || currentSprint.totalDays !== totalDays) {
          console.warn(`Inconsistent TotalSprintPoints or TotalDaysInSprint for Sprint ${sprintNumber} at row ${rowIndex + 2}. Using the first encountered values.`);
          // Optionally throw an error or use the first value encountered
          // For now, we'll just warn and continue with the first value set.
       }

      currentSprint.completedPoints += points;

      // Update Burndown: Subtract points completed *on or before* this day
      if (day >= 0 && day <= currentSprint.totalDays) {
          for (let i = day; i <= currentSprint.totalDays; i++) {
             if(currentSprint.dailyBurndown[i] !== undefined) {
               currentSprint.dailyBurndown[i] -= points;
             }
          }
          // Ensure burndown doesn't go below zero
          for (let i = 0; i <= currentSprint.totalDays; i++) {
            if(currentSprint.dailyBurndown[i] < 0) currentSprint.dailyBurndown[i] = 0;
          }
      }

      // Aggregate Developer Points per Day
      if (!developerPoints[developer]) {
        developerPoints[developer] = {};
      }
       if (!developerPoints[developer][dateStr]) {
        developerPoints[developer][dateStr] = 0;
      }
      developerPoints[developer][dateStr] += points;
    });

     // Fill remaining points for days with no activity in burndown & ensure day 0 starts correctly
    sprintsMap.forEach(sprint => {
        sprint.dailyBurndown[0] = sprint.committedPoints; // Ensure day 0 is set correctly
        for (let i = 1; i <= sprint.totalDays; i++) {
             // If the current day's value is still the initial committed value, it means no points were completed *on* this day.
             // Carry over the value from the previous day.
             if (sprint.dailyBurndown[i] === sprint.committedPoints && sprint.dailyBurndown[i-1] !== undefined) {
                 sprint.dailyBurndown[i] = sprint.dailyBurndown[i-1];
             }
             // Final check to ensure no value exceeds committed points (can happen if initial fill logic runs after updates)
             if (sprint.dailyBurndown[i] > sprint.committedPoints) {
                 sprint.dailyBurndown[i] = sprint.committedPoints;
             }
             // Ensure non-negative
             if (sprint.dailyBurndown[i] < 0) sprint.dailyBurndown[i] = 0;
        }
    });


    const sprints = Array.from(sprintsMap.values()).sort((a, b) => a.sprintNumber - b.sprintNumber);

     if (sprints.length === 0) {
        throw new Error("No valid sprint data could be parsed from the file.");
    }

    return {
      sprints,
      developerPoints,
      totalStoryPoints: sprints.reduce((sum, s) => sum + s.completedPoints, 0), // Sum completed points across parsed sprints
      daysInSprint: maxDaysInSprint,
    };
  };

  // Handler for manual data submission
  const handleManualData = (data: SprintData) => {
    setSprintData(data);
    setInputMode('manual'); // Keep track that data came from manual input
    setFileName(''); // Clear file name
    toast({ title: "Success", description: "Manual data submitted." });
  };

  const handleExport = () => {
    if (!sprintData) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No data available to export.",
      });
      return;
    }
    // ... rest of the export logic remains the same
     try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Velocity Data
      const velocityData = sprintData.sprints.map(s => ({
        'Sprint Number': s.sprintNumber,
        'Committed Points': s.committedPoints,
        'Completed Points': s.completedPoints,
      }));
      const wsVelocity = XLSX.utils.json_to_sheet(velocityData);
      XLSX.utils.book_append_sheet(wb, wsVelocity, 'Velocity');

       // Sheet 2: Burndown Data (Assuming the *last* sprint's burndown for export)
      const lastSprint = sprintData.sprints[sprintData.sprints.length - 1];
       if (lastSprint) {
           const burndownData = lastSprint.dailyBurndown.map((points, day) => ({
               'Day': day,
               'Remaining Points': points,
               'Ideal Burn': Math.max(0, lastSprint.committedPoints * (1 - day / lastSprint.totalDays)).toFixed(2) // Calculate ideal line
           }));
           const wsBurndown = XLSX.utils.json_to_sheet(burndownData);
           XLSX.utils.book_append_sheet(wb, wsBurndown, 'Burndown (Last Sprint)');
       }


      // Sheet 3: Developer Points per Day
      const developerExportData: any[] = [];
      Object.entries(sprintData.developerPoints).forEach(([developer, dailyData]) => {
        Object.entries(dailyData).forEach(([date, points]) => {
          developerExportData.push({ Developer: developer, Date: date, 'Story Points Completed': points });
        });
      });
      // Add headers explicitly if developerExportData is empty
      const wsDeveloper = XLSX.utils.json_to_sheet(developerExportData.length > 0 ? developerExportData : [{}], {
          header: ['Developer', 'Date', 'Story Points Completed']
      });

      XLSX.utils.book_append_sheet(wb, wsDeveloper, 'Developer Points');

      XLSX.writeFile(wb, 'sprint_stats_report.xlsx');
      toast({ title: "Success", description: "Data exported to Excel." });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to export data.",
      });
    }
  };

  // Determine which sprint's burndown to show (e.g., the last one)
  const activeBurndownSprint = sprintData?.sprints[sprintData.sprints.length - 1];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-card border-b shadow-sm">
        <h1 className="text-2xl font-semibold text-primary">Sprint Stats</h1>
        <div className="flex items-center gap-4">
          {sprintData && (
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          )}
          {/* Button to activate Upload mode */}
           <Button
             onClick={() => setInputMode(inputMode !== 'upload' ? 'upload' : null)}
             variant={inputMode === 'upload' ? 'default' : 'outline'}
             size="sm"
             className="hidden md:inline-flex" // Hide on small screens where Label is used
           >
             <Upload className="mr-2 h-4 w-4" />
             {fileName && inputMode === 'upload' ? `File: ${fileName.substring(0,15)}...` : 'Upload File'}
           </Button>
           {/* Hidden input for file upload */}
           <Input
              id="csv-upload"
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileUpload}
              className="hidden"
              ref={input => input && (input.value = "")} // Reset file input value to allow re-uploading same file
            />
            {/* Styled Label acting as a button for file upload */}
            <Label
              htmlFor="csv-upload"
              className={cn(buttonVariants({ variant: inputMode === 'upload' ? 'default' : 'outline', size: 'sm' }), 'cursor-pointer inline-flex items-center')}
             >
                 <Upload className="mr-2 h-4 w-4" />
                 <span className="truncate max-w-[100px] sm:max-w-[150px]">
                    {fileName && inputMode === 'upload' ? `File: ${fileName}` : 'Upload File'}
                 </span>

            </Label>


          <Button onClick={() => setInputMode(inputMode !== 'manual' ? 'manual' : null)} variant={inputMode === 'manual' ? 'default' : 'outline'} size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Manual Entry
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6">
        {/* Conditional Rendering based on inputMode */}
        {!inputMode && !sprintData && (
            <Card className="lg:col-span-3 flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
              <CardHeader className="text-center">
                <CardTitle>Choose Input Method</CardTitle>
                <CardDescription>Select how you want to provide sprint data.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-4">
                 <Label htmlFor="csv-upload-initial" className={cn(buttonVariants({ variant: "default", size: "lg" }), "cursor-pointer inline-flex items-center justify-center")}>
                   <Upload className="mr-2 h-5 w-5" /> Select File
                 </Label>
                 <Input
                   id="csv-upload-initial"
                   type="file"
                   accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                   onChange={handleFileUpload}
                   className="hidden" // Hide the default input, use Label for styling
                    ref={input => input && (input.value = "")} // Reset file input value
                 />
                 <Button onClick={() => setInputMode('manual')} variant="outline" size="lg" className="inline-flex items-center justify-center">
                   <Edit className="mr-2 h-5 w-5" /> Manual Entry
                 </Button>
              </CardContent>
              <CardFooter className="text-center px-4">
                   <p className="text-xs text-muted-foreground mt-4">
                      Upload a CSV/Excel file with columns: SprintNumber, Date, Developer, StoryPointsCompleted, DayOfSprint, TotalSprintPoints, TotalDaysInSprint.<br/>
                      Or enter the data manually using the form.
                   </p>
              </CardFooter>
            </Card>
        )}

        {inputMode === 'upload' && !sprintData && (
            <Card className="lg:col-span-3 flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
              <CardHeader className="text-center">
                  <CardTitle>Upload Sprint Data</CardTitle>
                  <CardDescription>Upload a CSV or Excel file to generate reports.</CardDescription>
              </CardHeader>
              <CardContent>
                  <Label htmlFor="csv-upload-active" className={cn(buttonVariants({ variant: "default", size: "lg" }), "cursor-pointer inline-flex items-center justify-center")}>
                     <Upload className="mr-2 h-5 w-5" />
                     {fileName ? `Processing: ${fileName}` : 'Select File'}
                  </Label>
                  <Input
                   id="csv-upload-active"
                   type="file"
                   accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                   onChange={handleFileUpload}
                   className="hidden" // Hide the default input, use Label for styling
                   ref={input => input && (input.value = "")} // Reset file input value
                 />
              </CardContent>
               <CardFooter className="text-center px-4">
                    <p className="text-xs text-muted-foreground">Example columns: SprintNumber, Date, Developer, StoryPointsCompleted, DayOfSprint, TotalSprintPoints, TotalDaysInSprint</p>
               </CardFooter>
          </Card>
        )}

        {inputMode === 'manual' && !sprintData && (
          <ManualInputForm onSubmit={handleManualData} />
        )}


        {/* Chart Section - Displayed when data is available */}
         {sprintData && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 h-[400px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-primary" /> Velocity Chart
                </CardTitle>
                <CardDescription>Team's capacity over past sprints.</CardDescription>
              </CardHeader>
              <CardContent className="h-[calc(100%-100px)] pl-2">
                 <VelocityChart data={sprintData.sprints} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-1 h-[400px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
                  Burndown Chart
                  </CardTitle>
                  <CardDescription>
                    {activeBurndownSprint ? `Progress for Sprint ${activeBurndownSprint.sprintNumber}` : 'Sprint progress tracking.'}
                  </CardDescription>

              </CardHeader>
              <CardContent className="h-[calc(100%-100px)] pl-2">
                 {activeBurndownSprint ? (
                  <BurndownChart
                      data={activeBurndownSprint.dailyBurndown}
                      totalDays={activeBurndownSprint.totalDays}
                      committedPoints={activeBurndownSprint.committedPoints} />
                 ) : (
                     <p className="text-muted-foreground text-center pt-10">No sprint data for burndown.</p>
                 )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-1 h-[400px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Developer Points
                </CardTitle>
                <CardDescription>Story points completed per developer per day.</CardDescription>
              </CardHeader>
              <CardContent className="h-[calc(100%-100px)] pl-2">
                 <DeveloperPointsChart data={sprintData.developerPoints} />
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <footer className="text-center p-4 text-xs text-muted-foreground border-t">
         Sprint Stats - Agile Reporting Made Easy
      </footer>
    </div>
  );
}

