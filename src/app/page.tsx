
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Removed Input as it's not directly used here
import { Download, HomeIcon, BarChart, ListPlus } from 'lucide-react'; // Removed Upload, Edit as icons are in child components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import HomeTab from '@/components/home-tab'; // Import Home tab component
import EntryTab from '@/components/entry-tab'; // Import Entry tab component
import ReportsTab from '@/components/reports-tab'; // Import Reports tab component

import type { SprintData, Sprint } from '@/types/sprint-data'; // Removed DeveloperDailyPoints type
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { addDays, format, parseISO } from 'date-fns'; // For date calculations

// Helper function (can be moved to utils if needed)
const calculateSprintMetrics = (startDateStr: string, duration: string): { totalDays: number, endDate: string } => {
    let totalDays = 0;
    let calendarDaysToAdd = 0;

    switch (duration) {
        case "1 Week": totalDays = 5; calendarDaysToAdd = 6; break;
        case "2 Weeks": totalDays = 10; calendarDaysToAdd = 13; break;
        case "3 Weeks": totalDays = 15; calendarDaysToAdd = 20; break;
        case "4 Weeks": totalDays = 20; calendarDaysToAdd = 27; break;
        default: return { totalDays: 0, endDate: 'N/A' };
    }

    if (!startDateStr) return { totalDays: 0, endDate: 'N/A' };

    try {
        const startDate = parseISO(startDateStr);
        const endDate = addDays(startDate, calendarDaysToAdd);
        return { totalDays, endDate: format(endDate, 'yyyy-MM-dd') };
    } catch (e) {
        console.error("Error calculating end date:", e);
        return { totalDays: 0, endDate: 'N/A' };
    }
};


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
        // Updated validation for simplified data structure
        if (parsedData && Array.isArray(parsedData.sprints) && typeof parsedData.totalStoryPoints === 'number') {
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


   // Updated parser for the new simplified CSV format
   const parseSprintData = (jsonData: any[]): SprintData => {
     // Updated required columns based on simplified format
     const requiredColumns = ['SprintNumber', 'StartDate', 'Duration', 'TotalCommitment', 'TotalDelivered'];
    if (!jsonData || jsonData.length === 0) {
        throw new Error("No data found in the file.");
    }
    // Check for required headers in the first row object keys
    const firstRowKeys = Object.keys(jsonData[0]);
    const missingColumns = requiredColumns.filter(col => !firstRowKeys.includes(col));
    if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    const sprints: Sprint[] = [];
    let maxTotalDays = 0; // Track maximum derived total days

    jsonData.forEach((row, rowIndex) => {
        const sprintNumber = parseInt(row.SprintNumber, 10);
        let startDateValue = row.StartDate; // Can be Excel date number or string YYYY-MM-DD
        const duration = row.Duration?.toString().trim();
        const commitment = parseInt(row.TotalCommitment, 10);
        const delivered = parseInt(row.TotalDelivered, 10);
        const details = row.Details?.toString().trim(); // Optional

        // Basic validation
        if (isNaN(sprintNumber) || !startDateValue || !duration || isNaN(commitment) || isNaN(delivered)) {
            console.warn(`Skipping invalid row ${rowIndex + 2}: Missing essential data.`, row);
            return;
        }
         // Validate duration against expected values (adjust as needed)
         const validDurations = ["1 Week", "2 Weeks", "3 Weeks", "4 Weeks"];
         if (!validDurations.includes(duration)) {
            console.warn(`Skipping row ${rowIndex + 2}: Invalid duration value "${duration}". Expected one of: ${validDurations.join(', ')}.`);
            return;
         }

         // Format date consistently (handle Excel date numbers)
         let startDateStr: string;
         if (typeof startDateValue === 'number') {
             if (startDateValue > 0) {
                 try {
                     startDateStr = XLSX.SSF.format('yyyy-mm-dd', startDateValue);
                 } catch (e) {
                     console.warn(`Skipping row ${rowIndex + 2}: Invalid date format for value ${startDateValue}.`);
                     return;
                 }
             } else {
                 console.warn(`Skipping row ${rowIndex + 2}: Invalid Excel date number ${startDateValue}.`);
                 return;
             }
         } else if (typeof startDateValue === 'string') {
            // Attempt to parse common date string formats if needed, otherwise assume 'yyyy-mm-dd'
            const potentialDate = new Date(startDateValue);
             if (!isNaN(potentialDate.getTime())) {
                 startDateStr = potentialDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
             } else {
                 console.warn(`Skipping row ${rowIndex + 2}: Invalid date string format ${startDateValue}. Expected YYYY-MM-DD.`);
                 return;
             }
         } else {
             console.warn(`Skipping row ${rowIndex + 2}: Unrecognized date type ${typeof startDateValue}.`);
             return;
         }

         // Calculate totalDays and endDate
          const { totalDays, endDate } = calculateSprintMetrics(startDateStr, duration);
         if (totalDays <= 0 || endDate === 'N/A') {
             console.warn(`Skipping row ${rowIndex + 2}: Could not calculate metrics for start date ${startDateStr} and duration ${duration}.`);
             return;
         }

         if (totalDays > maxTotalDays) {
             maxTotalDays = totalDays;
         }

        sprints.push({
            sprintNumber,
            startDate: startDateStr,
            endDate,
            duration,
            committedPoints: commitment,
            completedPoints: delivered,
            details,
            totalDays,
        });
    });

     if (sprints.length === 0) {
        throw new Error("No valid sprint data could be parsed from the file.");
    }

     // Sort sprints by number
    sprints.sort((a, b) => a.sprintNumber - b.sprintNumber);

    return {
      sprints,
      // developerPoints removed
      totalStoryPoints: sprints.reduce((sum, s) => sum + s.completedPoints, 0),
      daysInSprint: maxTotalDays,
    };
  };

  const handleDataProcessed = (data: SprintData) => {
    setSprintData(data);
    toast({ title: "Success", description: "Sprint data processed." });
    setActiveTab("reports"); // Switch to reports tab after processing
  };


  // Updated Export function for simplified data
  const handleExport = () => {
    if (!sprintData || !sprintData.sprints || sprintData.sprints.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No data available to export.",
      });
      return;
    }
     try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Sprint Data (Combined Summary)
       const summaryData = sprintData.sprints.map(s => ({
         'SprintNumber': s.sprintNumber,
         'StartDate': s.startDate,
         'EndDate': s.endDate,
         'Duration': s.duration,
         'TotalCommitment': s.committedPoints,
         'TotalDelivered': s.completedPoints,
         'Details': s.details || '', // Include details, default to empty string if undefined
       }));
       const wsSummary = XLSX.utils.json_to_sheet(summaryData);
       XLSX.utils.book_append_sheet(wb, wsSummary, 'Sprint Data');


       // Note: Burndown and Developer Points sheets are removed as the data is no longer collected in this format.

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
          {sprintData && sprintData.sprints.length > 0 && ( // Check if sprints array has data
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          )}
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
             {/* Pass the simplified parser function */}
            <EntryTab onDataProcessed={handleDataProcessed} parseSprintData={parseSprintData}/>
          </TabsContent>

          <TabsContent value="reports">
             {/* ReportsTab needs update if it relies on removed data */}
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
