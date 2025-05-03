"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react'; // Import useState
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, BarChart, LineChart, Users } from 'lucide-react';
import VelocityChart from '@/components/charts/velocity-chart';
import BurndownChart from '@/components/charts/burndown-chart';
import DeveloperPointsChart from '@/components/charts/developer-points-chart';
import type { SprintData, DeveloperDailyPoints, Sprint } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast"


export default function Home() {
  const [sprintData, setSprintData] = useState<SprintData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const { toast } = useToast()

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        // Basic validation and parsing (adapt based on actual CSV structure)
        const parsedData = parseSprintData(jsonData);
        setSprintData(parsedData);
        toast({ title: "Success", description: "CSV file uploaded and processed." });
      } catch (error) {
        console.error("Error parsing CSV:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to parse CSV file. Please ensure it's in the correct format.",
        })
        setFileName(''); // Reset filename on error
        setSprintData(null); // Reset data on error
      }
    };

    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to read the file.",
      })
      setFileName(''); // Reset filename on error
    }

    reader.readAsBinaryString(file);
  };


  // Placeholder parse function - needs implementation based on CSV structure
  const parseSprintData = (jsonData: any[]): SprintData => {
    // Example parsing logic - Adjust based on your CSV columns
    const sprints: Sprint[] = [];
    const developerPoints: DeveloperDailyPoints = {};
    let totalStoryPoints = 0;
    let daysInSprint = 0;

    // Assuming CSV columns like: SprintNumber, Date, Developer, StoryPointsCompleted, Task, DayOfSprint, TotalSprintPoints, TotalDaysInSprint

    const sprintsMap = new Map<number, Sprint>();
    const developerDatePoints: { [dev: string]: { [date: string]: number } } = {};

    jsonData.forEach(row => {
      const sprintNumber = parseInt(row.SprintNumber, 10);
      const date = row.Date; // Assuming date format is compatible or parse it
      const developer = row.Developer;
      const points = parseInt(row.StoryPointsCompleted, 10) || 0; // Handle NaN
      const day = parseInt(row.DayOfSprint, 10);
      const totalPointsInSprint = parseInt(row.TotalSprintPoints, 10); // Total points committed for this sprint
      const totalDays = parseInt(row.TotalDaysInSprint, 10); // Total days in this sprint

      if (isNaN(sprintNumber) || !date || !developer || isNaN(points) || isNaN(day) || isNaN(totalPointsInSprint) || isNaN(totalDays)) {
        console.warn("Skipping invalid row:", row);
        return; // Skip rows with missing or invalid essential data
      }

      if (!sprintsMap.has(sprintNumber)) {
        sprintsMap.set(sprintNumber, {
          sprintNumber: sprintNumber,
          committedPoints: totalPointsInSprint,
          completedPoints: 0, // Will be summed up later
          dailyBurndown: Array(totalDays + 1).fill(totalPointsInSprint), // Initialize burndown with total points
          totalDays: totalDays,
        });
        if (totalDays > daysInSprint) daysInSprint = totalDays; // Get max days for chart axes
      }

      const currentSprint = sprintsMap.get(sprintNumber)!;
      currentSprint.completedPoints += points; // Add points completed in this row to the sprint total

      // Update Burndown: Subtract points completed *on or before* this day
      if (day >= 0 && day <= totalDays) {
          // Iterate from current day to the end of the sprint and subtract the completed points
          for (let i = day; i <= totalDays; i++) {
             if(currentSprint.dailyBurndown[i] !== undefined) { // Check if index exists
               currentSprint.dailyBurndown[i] -= points;
             }
          }
          // Ensure burndown doesn't go below zero
          for (let i = 0; i <= totalDays; i++) {
            if(currentSprint.dailyBurndown[i] < 0) currentSprint.dailyBurndown[i] = 0;
          }
      }


      // Aggregate Developer Points per Day
      if (!developerPoints[developer]) {
        developerPoints[developer] = {};
      }
      const dateStr = typeof date === 'number' ? XLSX.SSF.format('yyyy-mm-dd', date) : date.toString().split('T')[0]; // Format date consistently
       if (!developerPoints[developer][dateStr]) {
        developerPoints[developer][dateStr] = 0;
      }
      developerPoints[developer][dateStr] += points;

      // Sum total story points across all sprints (if needed, otherwise use per-sprint total)
      totalStoryPoints += points;
    });

     // Fill remaining points for days with no activity in burndown
    sprintsMap.forEach(sprint => {
        for (let i = 1; i <= sprint.totalDays; i++) {
            // If the current day's points weren't explicitly set (meaning 0 points completed),
            // it should carry over the remaining points from the previous day.
            if (sprint.dailyBurndown[i] === sprint.committedPoints && sprint.dailyBurndown[i-1] !== undefined) {
                 sprint.dailyBurndown[i] = sprint.dailyBurndown[i-1];
            }
        }
        // Ensure the first day (day 0) starts with the total committed points
        sprint.dailyBurndown[0] = sprint.committedPoints;
        sprints.push(sprint);
    });


    // Sort sprints by number for Velocity Chart
    sprints.sort((a, b) => a.sprintNumber - b.sprintNumber);


    return {
      sprints,
      developerPoints,
      totalStoryPoints, // This might be less relevant than per-sprint totals
      daysInSprint, // Max days found across sprints
    };
  };


  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: Implement manual data entry logic
    // 1. Get data from form fields
    // 2. Structure it into the SprintData format
    // 3. setSprintData(parsedManualData);
    toast({
      title: "Info",
      description: "Manual data entry is not yet implemented.",
    });
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
      const wsDeveloper = XLSX.utils.json_to_sheet(developerExportData);
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
             <Button onClick={handleExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          )}
          <Label htmlFor="csv-upload" className={buttonVariants({ variant: "default" })}>
              <Upload className="mr-2 h-4 w-4" />
              Upload CSV
           </Label>
           <Input
            id="csv-upload"
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileUpload}
            className="hidden" // Hide the default input, use Label for styling
          />

        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Section - Can be expanded later */}
        {/*
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Data Input</CardTitle>
            <CardDescription>Enter sprint details manually (feature coming soon).</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualSubmit}>
              {/* Add form fields here }
              <p className="text-muted-foreground text-sm">Manual input form will be added here.</p>
            </form>
             <p className="text-center text-muted-foreground my-4">OR</p>
             <div className="flex flex-col items-center gap-2">
                 <Label htmlFor="csv-upload-visible" className={buttonVariants({ variant: "outline" })}>
                     <Upload className="mr-2 h-4 w-4" />
                     {fileName ? `Selected: ${fileName}` : 'Upload CSV File'}
                  </Label>
                  <Input
                   id="csv-upload-visible"
                   type="file"
                   accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                   onChange={handleFileUpload}
                   className="hidden" // Hide the default input, use Label for styling
                 />
                  <p className="text-xs text-muted-foreground">Upload a CSV or Excel file with sprint data.</p>
             </div>
          </CardContent>
           <CardFooter>
             <Button type="submit" disabled>Submit Manual Data</Button>
           </CardFooter>
        </Card>
        */}

         {!sprintData && (
          <Card className="lg:col-span-3 flex flex-col items-center justify-center min-h-[400px] border-dashed border-2">
              <CardHeader className="text-center">
                  <CardTitle>Upload Sprint Data</CardTitle>
                  <CardDescription>Upload a CSV or Excel file to generate reports.</CardDescription>
              </CardHeader>
              <CardContent>
                  <Label htmlFor="csv-upload-empty" className={buttonVariants({ variant: "default", size: "lg" })}>
                     <Upload className="mr-2 h-5 w-5" />
                     {fileName ? `Processing: ${fileName}` : 'Select File'}
                  </Label>
                  <Input
                   id="csv-upload-empty"
                   type="file"
                   accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                   onChange={handleFileUpload}
                   className="hidden" // Hide the default input, use Label for styling
                 />
              </CardContent>
               <CardFooter>
                    <p className="text-xs text-muted-foreground">Example columns: SprintNumber, Date, Developer, StoryPointsCompleted, DayOfSprint, TotalSprintPoints, TotalDaysInSprint</p>
               </CardFooter>
          </Card>
        )}


        {/* Chart Section */}
        {sprintData && (
          <>
            <Card className="lg:col-span-1 h-[400px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-primary" /> Velocity Chart
                </CardTitle>
                <CardDescription>Team's capacity over past sprints.</CardDescription>
              </CardHeader>
              <CardContent className="h-[calc(100%-100px)] pl-2"> {/* Adjust height calculation */}
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
          </>
        )}
      </main>
       <footer className="text-center p-4 text-xs text-muted-foreground border-t">
         Sprint Stats - Agile Reporting Made Easy
      </footer>
    </div>
  );
}


// Helper function needed by Button component with Label
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}