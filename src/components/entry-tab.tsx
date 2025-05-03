
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
  onDataProcessed: (data: SprintData) => void;
  parseSprintData: (jsonData: any[]) => SprintData; // Keep parser for paste functionality in ManualInputForm
}

export default function EntryTab({ onDataProcessed, parseSprintData }: EntryTabProps) {
  // Removed file upload state: fileName, inputMode, isProcessing
  const { toast } = useToast();

  // Handler for manual data submission (passed to ManualInputForm)
  const handleManualData = (data: SprintData) => {
    onDataProcessed(data); // Use callback to lift state up
    // Don't clear form here, ManualInputForm handles its state
    toast({ title: "Success", description: "Manual data submitted." });
  };

  return (
    <div className="space-y-6">
       {/* Directly show the manual input form */}
       <ManualInputForm onSubmit={handleManualData} />
       {/* Optionally keep a way to switch back or provide context */}
        {/* <Card>
            <CardHeader>
                <CardTitle>Data Entry</CardTitle>
                 <CardDescription>
                    Enter sprint data manually row by row, or paste tab-separated data from a spreadsheet.
                 </CardDescription>
            </CardHeader>
            <CardContent>
                 <p className="text-sm text-muted-foreground">
                    Required columns: SprintNumber, StartDate (YYYY-MM-DD), Duration (e.g., '2 Weeks'), TotalCommitment, TotalDelivered. Optional: Details.
                 </p>
            </CardContent>
        </Card> */}

    </div>
  );
}
