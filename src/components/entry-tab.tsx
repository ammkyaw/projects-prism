
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx'; // Keep for potential future re-introduction or export? Seems unused now.
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Keep if ManualInputForm uses it internally
import { Label } from '@/components/ui/label'; // Keep if ManualInputForm uses it internally
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, ClipboardPaste } from 'lucide-react'; // Use Edit/Paste icons
import ManualInputForm from '@/components/manual-input-form';
import type { SprintData } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface EntryTabProps {
  key?: number; // Add key prop for resetting
  onSaveSprints: (data: SprintData) => void; // Callback to save parsed/manual legacy data
  initialSprintData: SprintData | null; // Add prop for initial data (to populate form)
  parseSprintData: (jsonData: any[]) => SprintData; // Keep parser for paste functionality
  projectName: string; // Add project name prop
}

export default function EntryTab({ key, onSaveSprints, initialSprintData, parseSprintData, projectName }: EntryTabProps) {
  const { toast } = useToast();

  // Handler for manual data submission (passed to ManualInputForm)
  const handleManualDataSubmit = (data: SprintData) => {
    onSaveSprints(data); // Use the specific save callback
    // Toast is now handled in the parent component (page.tsx) after successful save
  };

  return (
    <div className="space-y-6">
       <Card>
          <CardHeader>
             {/* Display Project Name */}
             <CardTitle>Legacy Data Entry for Project: {projectName}</CardTitle>
             <CardDescription>
                Use this tab to enter or paste historical sprint data (Sprint #, Start Date, Duration, Commitment, Delivered).
                For planning and creating <span className="font-semibold">new</span> sprints, use the 'Planning' tab.
                Required columns for paste: SprintNumber, StartDate (YYYY-MM-DD), Duration (e.g., '2 Weeks'), TotalCommitment, TotalDelivered.
             </CardDescription>
          </CardHeader>
          <CardContent>
             {/* Pass initial data, the submit handler, and the key */}
             <ManualInputForm
                key={key} // Pass the key here
                onSubmit={handleManualDataSubmit}
                initialData={initialSprintData?.sprints ?? []}
                parseSprintData={parseSprintData} // Pass parser for paste functionality
             />
          </CardContent>
           {/* <CardFooter>
               <p className="text-sm text-muted-foreground">
                   Remember to click 'Save' at the bottom of the form to persist your changes.
               </p>
           </CardFooter> */}
       </Card>
    </div>
  );
}
