'use client';

import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import type { SprintData, Member, Sprint, Task } from '@/types/sprint-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Download,
  FileSpreadsheet,
  Info,
  ListPlus,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsReportsTabProps {
  sprintData: SprintData | null;
  projectName: string;
  members: Member[];
  backlog: Task[];
}

interface ReportOption {
  id: string;
  label: string;
  description: string;
  chartId?: string;
  type: 'chart' | 'data';
}

const reportOptions: ReportOption[] = [
  {
    id: 'velocity',
    label: 'Velocity Report',
    description: 'Committed vs. Completed points for the last 10 sprints.',
    chartId: 'velocity-chart-card',
    type: 'chart',
  },
  {
    id: 'burndown',
    label: 'Burndown Report',
    description: 'Ideal vs. Actual burndown data for the active sprint.',
    chartId: 'burndown-chart-card',
    type: 'chart',
  },
  {
    id: 'contribution',
    label: 'Developer Contribution',
    description: 'Points completed per developer in the active sprint.',
    chartId: 'dev-contribution-chart-card',
    type: 'chart',
  },
  {
    id: 'bugs',
    label: 'Bugs & Hotfixes',
    description: 'Analysis of bug counts and hotfixes across sprints.',
    chartId: 'bug-count-chart-card',
    type: 'chart',
  },
  {
    id: 'severity',
    label: 'Bug Severity Distribution',
    description: 'Breakdown of bug severity for the active sprint.',
    chartId: 'bug-severity-chart-card',
    type: 'chart',
  },
  {
    id: 'backlog',
    label: 'Full Backlog Export',
    description: 'Comprehensive list of all items in the product backlog.',
    type: 'data',
  },
];

export default function AnalyticsReportsTab({
  sprintData,
  projectName,
  members,
  backlog,
}: AnalyticsReportsTabProps) {
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [isExporting, setIsLoading] = useState(false);
  const { toast } = useToast();

  const toggleReport = (id: string) => {
    setSelectedReports((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const captureElementAsImage = async (elementId: string): Promise<string | null> => {
    const element = document.getElementById(elementId);
    if (!element) return null;

    const { width, height } = element.getBoundingClientRect();
    if (width === 0 || height === 0) {
      toast({
        title: 'Chart not visible',
        description: 'Ensure the chart is visible on screen before exporting to include images.',
      });
      return null;
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error capturing chart:', error);
      return null;
    }
  };

  const handleExportSelectedReports = async () => {
    if (selectedReports.size === 0) {
      toast({ title: 'No Reports Selected', description: 'Select at least one report to export.' });
      return;
    }

    setIsLoading(true);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Projects Prism';
    workbook.lastModifiedBy = 'Projects Prism';
    workbook.created = new Date();

    try {
      for (const reportId of selectedReports) {
        const option = reportOptions.find((o) => o.id === reportId);
        if (!option) continue;

        const sheet = workbook.addWorksheet(option.label.slice(0, 31));
        sheet.columns = [{ header: option.label, key: 'info', width: 40 }];
        sheet.addRow([option.description]);
        sheet.addRow([]);

        if (option.type === 'chart' && option.chartId) {
          const imageData = await captureElementAsImage(option.chartId);
          if (imageData) {
            const imageId = workbook.addImage({
              base64: imageData,
              extension: 'png',
            });
            sheet.addImage(imageId, {
              tl: { col: 0, row: 3 },
              ext: { width: 600, height: 350 },
            });
            for (let i = 0; i < 20; i++) sheet.addRow([]);
          }
        }

        // Data population logic per report type
        switch (reportId) {
          case 'velocity':
            sheet.addRow(['Sprint Name', 'Committed Points', 'Completed Points']);
            (sprintData?.sprints || []).forEach((s) => {
              const committed = s.planning?.newTasks.reduce((sum, t) => sum + (Number(t.storyPoints) || 0), 0) || 0;
              const completed = s.status === 'Completed' || s.status === 'Active' 
                ? s.planning?.newTasks.filter(t => t.status === 'Done').reduce((sum, t) => sum + (Number(t.storyPoints) || 0), 0) || 0
                : 0;
              sheet.addRow([`Sprint ${s.sprintNumber}`, committed, completed]);
            });
            break;
          case 'backlog':
            sheet.addRow(['ID', 'Title', 'Type', 'Priority', 'Status', 'Points']);
            (backlog || []).forEach((t) => {
              sheet.addRow([t.backlogId, t.title, t.taskType, t.priority, t.historyStatus || 'Active', t.storyPoints]);
            });
            break;
          // ... Add other data rows for contribution, bugs, severity etc.
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `${projectName.replace(/\s+/g, '_')}_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(new Blob([buffer]), fileName);
      
      toast({ title: 'Export Successful', description: 'Your analytic reports have been downloaded.' });
    } catch (error) {
      console.error('Export error:', error);
      toast({ variant: 'destructive', title: 'Export Failed', description: 'An error occurred while generating the Excel file.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Available Reports
          </CardTitle>
          <CardDescription>Select the reports you want to compile into a single Excel workbook.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {reportOptions.map((option) => (
            <div
              key={option.id}
              className={cn(
                'flex cursor-pointer items-start space-x-3 rounded-lg border p-4 transition-all hover:bg-muted/50',
                selectedReports.has(option.id) ? 'border-primary bg-primary/5' : 'bg-card'
              )}
              onClick={() => toggleReport(option.id)}
            >
              <Checkbox
                id={option.id}
                checked={selectedReports.has(option.id)}
                onCheckedChange={() => toggleReport(option.id)}
                className="mt-1"
              />
              <div className="space-y-1">
                <Label htmlFor={option.id} className="font-semibold">{option.label}</Label>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Configuration</CardTitle>
          <CardDescription>Summary of your current selection.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Selected Reports:</span>
              <span className="font-bold text-primary">{selectedReports.size}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>Include Images:</span>
              <span className="text-green-600 font-medium">Yes (Automatic)</span>
            </div>
          </div>
          
          {selectedReports.size > 0 ? (
            <ul className="space-y-2">
              {Array.from(selectedReports).map((id) => (
                <li key={id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  {reportOptions.find((o) => o.id === id)?.label}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center py-6 text-center text-muted-foreground">
              <Info className="mb-2 h-8 w-8 opacity-20" />
              <p className="text-sm">No reports selected for compile.</p>
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleExportSelectedReports}
            disabled={selectedReports.size === 0 || isExporting}
          >
            {isExporting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Compiling...</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Export to Excel</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
