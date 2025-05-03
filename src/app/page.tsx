
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Keep Input if needed for other parts, maybe header
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Upload, Edit, HomeIcon, BarChart, ListPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import HomeTab from '@/components/home-tab'; // Import Home tab component
import EntryTab from '@/components/entry-tab'; // Import Entry tab component
import ReportsTab from '@/components/reports-tab'; // Import Reports tab component

import type { SprintData, Sprint, DeveloperDailyPoints } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Home() {
  const [sprintData, setSprintData] = useState<SprintData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("home"); // Default to home tab
  const { toast } = useToast();

   // Effect to load data from localStorage on mount
   useEffect(() => {
    const savedData = localStorage.getItem('sprintData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        // Basic validation of parsed data structure
        if (parsedData && Array.isArray(parsedData.sprints) && typeof parsedData.developerPoints === 'object') {
          setSprintData(parsedData);
           toast({ title: "Data Loaded", description: "Loaded previously saved sprint data." });
        } else {
          console.warn("Invalid data found in localStorage.");
          localStorage.removeItem('sprintData'); // Clear invalid data
        }
      } catch (error) {
        console.error("Failed to parse sprint data from localStorage:", error);
        localStorage.removeItem('sprintData'); // Clear corrupted data
      }
    }
  }, [toast]); // Add toast to dependency array

  // Effect to save data to localStorage whenever it changes
  useEffect(() => {
    if (sprintData) {
      try {
        const dataToSave = JSON.stringify(sprintData);
        localStorage.setItem('sprintData', dataToSave);
      } catch (error) {
         console.error("Failed to save sprint data to localStorage:", error);
         toast({
           variant: "destructive",
           title: "Save Error",
           description: "Could not save sprint data locally. Data might be too large or storage is unavailable.",
         });
      }

    } else {
       localStorage.removeItem('sprintData'); // Clear storage if data is null
    }
  }, [sprintData, toast]); // Add toast to dependency array


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
    let minDate: string | null = null;
    let maxDate: string | null = null;

    jsonData.forEach((row, rowIndex) => {
      const sprintNumber = parseInt(row.SprintNumber, 10);
      let dateValue = row.Date; // Can be Excel date number or string
      const developer = row.Developer?.toString().trim();
      const points = parseInt(row.StoryPointsCompleted, 10);
      const day = parseInt(row.DayOfSprint, 10);
      const totalPointsInSprint = parseInt(row.TotalSprintPoints, 10);
      const totalDays = parseInt(row.TotalDaysInSprint, 10);

      // Validate essential data for each row
      if (isNaN(sprintNumber) || !dateValue || !developer || isNaN(points) || isNaN(day) || isNaN(totalPointsInSprint) || isNaN(totalDays)) {
        console.warn(`Skipping invalid row ${rowIndex + 2}:`, row); // +2 because of header and 0-indexing
        return; // Skip rows with missing or invalid essential data
      }
       if (day < 0 || day > totalDays) {
          console.warn(`Skipping row ${rowIndex + 2}: DayOfSprint (${day}) is outside the valid range (0-${totalDays}).`);
          return;
       }

      // Format date consistently (handle Excel date numbers)
       let dateStr: string;
       if (typeof dateValue === 'number') {
         // Check if it's a valid Excel date number (greater than 0)
         if (dateValue > 0) {
           try {
              // Use XLSX utility function to format the date number
             dateStr = XLSX.SSF.format('yyyy-mm-dd', dateValue);
           } catch (e) {
              console.warn(`Skipping row ${rowIndex + 2}: Invalid date format for value ${dateValue}. Using original value.`);
              dateStr = dateValue.toString(); // Fallback to string
           }
         } else {
             console.warn(`Skipping row ${rowIndex + 2}: Invalid Excel date number ${dateValue}.`);
             return; // Skip if date number is not positive
         }
       } else if (typeof dateValue === 'string') {
         // Attempt to parse common date string formats if needed, otherwise assume 'yyyy-mm-dd'
         // For simplicity, we assume it's already in a usable format or 'yyyy-mm-dd'
         const potentialDate = new Date(dateValue);
         if (!isNaN(potentialDate.getTime())) {
             dateStr = potentialDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
         } else {
            console.warn(`Skipping row ${rowIndex + 2}: Invalid date string format ${dateValue}.`);
            return;
         }
       } else {
          console.warn(`Skipping row ${rowIndex + 2}: Unrecognized date type ${typeof dateValue}.`);
         return; // Skip if date type is not recognized
       }

       // Update overall min/max dates
       if (minDate === null || dateStr < minDate) minDate = dateStr;
       if (maxDate === null || dateStr > maxDate) maxDate = dateStr;


      if (!sprintsMap.has(sprintNumber)) {
        sprintsMap.set(sprintNumber, {
          sprintNumber: sprintNumber,
          committedPoints: totalPointsInSprint,
          completedPoints: 0,
          dailyBurndown: Array(totalDays + 1).fill(totalPointsInSprint), // Initialize burndown
          totalDays: totalDays,
          startDate: dateStr, // Initialize with first date encountered
          endDate: dateStr, // Initialize with first date encountered
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

        // Update sprint start/end dates
        if (dateStr < currentSprint.startDate) currentSprint.startDate = dateStr;
        if (dateStr > currentSprint.endDate) currentSprint.endDate = dateStr;

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

  const handleDataProcessed = (data: SprintData) => {
    setSprintData(data);
    toast({ title: "Success", description: "Sprint data processed." });
    setActiveTab("reports"); // Switch to reports tab after processing
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

      // Sheet 1: Sprint Summary (including dates)
       const summaryData = sprintData.sprints.map(s => ({
         'Sprint Number': s.sprintNumber,
         'Start Date': s.startDate,
         'End Date': s.endDate,
         'Committed Points': s.committedPoints,
         'Completed Points': s.completedPoints,
       }));
       const wsSummary = XLSX.utils.json_to_sheet(summaryData);
       XLSX.utils.book_append_sheet(wb, wsSummary, 'Sprint Summary');


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
          {/* Add other header controls if needed */}
        </div>
      </header>

      <main className="flex-1 p-6">
         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="home"><HomeIcon className="mr-2 h-4 w-4" />Home</TabsTrigger>
            <TabsTrigger value="entry"><ListPlus className="mr-2 h-4 w-4" />Entry</TabsTrigger>
            <TabsTrigger value="reports"><BarChart className="mr-2 h-4 w-4" />Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="home">
            <HomeTab sprintData={sprintData} />
          </TabsContent>

          <TabsContent value="entry">
            <EntryTab onDataProcessed={handleDataProcessed} parseSprintData={parseSprintData}/>
          </TabsContent>

          <TabsContent value="reports">
             <ReportsTab sprintData={sprintData} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="text-center p-4 text-xs text-muted-foreground border-t">
         Sprint Stats - Agile Reporting Made Easy
      </footer>
    </div>
  );
}
```]></content>
  </change>
  <change>
    <file>src/components/home-tab.tsx</file>
    <description>Create a new component for the Home tab content, displaying an introduction and sprint summary table.</description>
    <content><![CDATA[
import type { SprintData } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Info } from 'lucide-react';

interface HomeTabProps {
  sprintData: SprintData | null;
}

export default function HomeTab({ sprintData }: HomeTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to Sprint Stats!</CardTitle>
        <CardDescription>
          This tool helps you visualize your team's agile sprint performance.
          Use the 'Entry' tab to input your data either by uploading a file or entering it manually.
          View the generated charts and reports in the 'Reports' tab.
          This Home tab provides a summary of the loaded sprint data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sprintData && sprintData.sprints.length > 0 ? (
          <>
            <h3 className="text-lg font-semibold mb-4">Sprint Summary</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Sprint #</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Commitment</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sprintData.sprints.map((sprint) => (
                    <TableRow key={sprint.sprintNumber}>
                      <TableCell className="font-medium">{sprint.sprintNumber}</TableCell>
                      <TableCell>{sprint.startDate || 'N/A'}</TableCell>
                      <TableCell>{sprint.endDate || 'N/A'}</TableCell>
                      <TableCell className="text-right">{sprint.committedPoints}</TableCell>
                      <TableCell className="text-right">{sprint.completedPoints}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center text-muted-foreground p-8 border border-dashed rounded-md">
            <Info className="mr-2 h-5 w-5" />
            No sprint data loaded. Go to the 'Entry' tab to add data.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```