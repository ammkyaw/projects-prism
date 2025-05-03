
"use client";

import type { ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Edit } from 'lucide-react';
import ManualInputForm from '@/components/manual-input-form';
import type { SprintData } from '@/types/sprint-data';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface EntryTabProps {
  onDataProcessed: (data: SprintData) => void;
  parseSprintData: (jsonData: any[]) => SprintData; // Accept parser function as prop
}

export default function EntryTab({ onDataProcessed, parseSprintData }: EntryTabProps) {
  const [fileName, setFileName] = useState<string>('');
  const [inputMode, setInputMode] = useState<'upload' | 'manual' | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false); // Add processing state
  const { toast } = useToast();

  // Clear filename when switching modes away from upload
  useEffect(() => {
    if (inputMode !== 'upload') {
      setFileName('');
    }
  }, [inputMode]);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setInputMode('upload'); // Set mode on new upload
    setFileName(file.name);
    setIsProcessing(true); // Set processing state

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (jsonData.length < 2) {
            throw new Error("File must contain headers and at least one data row.");
        }

        const headers: string[] = jsonData[0].map(String);
        const dataRows = jsonData.slice(1).map(rowArray => {
            let rowObject: { [key: string]: any } = {};
            headers.forEach((header, index) => {
                if(header?.trim()) {
                    rowObject[header.trim()] = rowArray[index];
                }
            });
            return rowObject;
        });

        // Use the passed-in parsing function
        const parsedData = parseSprintData(dataRows);
        onDataProcessed(parsedData); // Use callback to lift state up
        toast({ title: "Success", description: "File uploaded and processed." });
      } catch (error: any) {
        console.error("Error parsing file:", error);
        toast({
          variant: "destructive",
          title: "Error Parsing File",
          description: error.message || "Failed to parse file. Please check format and required columns.",
        });
        setFileName(''); // Reset filename on error
        // Don't reset inputMode here, allow user to retry upload
      } finally {
        setIsProcessing(false); // Reset processing state
      }
    };

    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      toast({
        variant: "destructive",
        title: "Error Reading File",
        description: "Failed to read the file.",
      });
      setFileName(''); // Reset filename on error
      setIsProcessing(false); // Reset processing state
    };

    reader.readAsBinaryString(file);
  };

  // Handler for manual data submission (passed to ManualInputForm)
  const handleManualData = (data: SprintData) => {
    onDataProcessed(data); // Use callback to lift state up
    setInputMode('manual'); // Keep track that data came from manual input
    // Don't clear form here, ManualInputForm handles its state
    toast({ title: "Success", description: "Manual data submitted." });
  };

  return (
    <div className="space-y-6">
      {!inputMode && (
        <Card className="flex flex-col items-center justify-center min-h-[300px] border-dashed border-2">
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
              className="hidden"
              ref={input => input && (input.value = "")}
              disabled={isProcessing} // Disable while processing
            />
            <Button onClick={() => setInputMode('manual')} variant="outline" size="lg" className="inline-flex items-center justify-center">
              <Edit className="mr-2 h-5 w-5" /> Manual Entry
            </Button>
          </CardContent>
           <CardFooter className="text-center px-4">
                <p className="text-xs text-muted-foreground mt-4">
                   Required columns: SprintNumber, Date, Developer, StoryPointsCompleted, DayOfSprint, TotalSprintPoints, TotalDaysInSprint.
                </p>
           </CardFooter>
        </Card>
      )}

      {inputMode === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Sprint Data File</CardTitle>
            <CardDescription>Upload a CSV or Excel file containing sprint details.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Label htmlFor="csv-upload-active" className={cn(buttonVariants({ variant: "default", size: "lg" }), "cursor-pointer inline-flex items-center justify-center", isProcessing && "opacity-50 cursor-not-allowed")}>
              <Upload className="mr-2 h-5 w-5" />
              {isProcessing ? `Processing: ${fileName}` : (fileName ? `Selected: ${fileName.substring(0,25)}...` : 'Select File')}
            </Label>
            <Input
              id="csv-upload-active"
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileUpload}
              className="hidden"
              ref={input => input && (input.value = "")}
              disabled={isProcessing} // Disable while processing
            />
             {isProcessing && <p className="text-sm text-muted-foreground">Processing file, please wait...</p>}
             <Button variant="outline" size="sm" onClick={() => setInputMode(null)} disabled={isProcessing}>
               Choose Different Method
             </Button>
          </CardContent>
          <CardFooter className="text-center px-4">
             <p className="text-xs text-muted-foreground">Required columns: SprintNumber, Date, Developer, StoryPointsCompleted, DayOfSprint, TotalSprintPoints, TotalDaysInSprint.</p>
           </CardFooter>
        </Card>
      )}

      {inputMode === 'manual' && (
         <>
            <ManualInputForm onSubmit={handleManualData} />
             <div className="text-center mt-4">
                 <Button variant="outline" size="sm" onClick={() => setInputMode(null)}>
                   Choose Different Method
                 </Button>
             </div>
         </>
      )}
    </div>
  );
}
