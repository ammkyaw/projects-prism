
"use client";

import React, { useState, useMemo } from 'react'; // Added React import
import type { Task, Sprint } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Info, History, ArrowUpDown } from 'lucide-react';
import { taskPriorities, taskTypes } from '@/types/sprint-data';
import { format, parseISO, isValid } from 'date-fns';

interface HistoryTabProps {
  projectId: string;
  projectName: string;
  historyItems: Task[]; // Pass only items that have been moved (task.movedToSprint is set)
}

type SortKey = 'priority' | 'title' | 'taskType' | 'createdDate' | 'movedToSprint';
type SortDirection = 'asc' | 'desc';

export default function HistoryTab({ projectId, projectName, historyItems }: HistoryTabProps) {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: SortDirection } | null>(null);

  const sortedHistory = useMemo(() => {
    let sortableItems = [...(historyItems || [])]; // Use historyItems
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.key) {
            case 'priority':
                aValue = taskPriorities.indexOf(a.priority || 'Medium');
                bValue = taskPriorities.indexOf(b.priority || 'Medium');
                break;
            case 'createdDate':
                 const dateA = a.createdDate && isValid(parseISO(a.createdDate)) ? parseISO(a.createdDate) : new Date(0);
                 const dateB = b.createdDate && isValid(parseISO(b.createdDate)) ? parseISO(b.createdDate) : new Date(0);
                 aValue = dateA.getTime();
                 bValue = dateB.getTime();
                break;
            case 'title':
                 aValue = a.title?.toLowerCase() || '';
                 bValue = b.title?.toLowerCase() || '';
                 break;
            case 'movedToSprint':
                  aValue = a.movedToSprint ?? Infinity; // Sort undefined/null last
                  bValue = b.movedToSprint ?? Infinity;
                  break;
            default:
                 aValue = (a[sortConfig.key] as any)?.toString().toLowerCase() || '';
                 bValue = (b[sortConfig.key] as any)?.toString().toLowerCase() || '';
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    } else {
        // Default sort by sprint number moved to, then priority
        sortableItems.sort((a, b) => (a.movedToSprint ?? Infinity) - (b.movedToSprint ?? Infinity) || taskPriorities.indexOf(a.priority || 'Medium') - taskPriorities.indexOf(b.priority || 'Medium'));
    }
    return sortableItems;
  }, [historyItems, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2"><History className="h-5 w-5 text-primary" /> Backlog History</CardTitle>
        <CardDescription>View backlog items that have been moved to sprints for project '{projectName}'. Click headers to sort.</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedHistory.length === 0 ? (
             <div className="flex flex-col items-center justify-center min-h-[200px] border-dashed border-2 rounded-md p-6">
                <Info className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No backlog items have been moved to sprints yet.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="w-[100px]">
                        <Button variant="ghost" onClick={() => requestSort('movedToSprint')} className="px-1 h-auto">
                            Sprint # {getSortIndicator('movedToSprint')}
                        </Button>
                    </TableHead>
                    <TableHead className="w-[150px]">
                        <Button variant="ghost" onClick={() => requestSort('priority')} className="px-1 h-auto">
                            Priority {getSortIndicator('priority')}
                        </Button>
                    </TableHead>
                    <TableHead className="w-[150px]">Backlog ID</TableHead>
                    <TableHead>
                         <Button variant="ghost" onClick={() => requestSort('title')} className="px-1 h-auto">
                             Title {getSortIndicator('title')}
                         </Button>
                    </TableHead>
                     <TableHead className="w-[150px]">
                         <Button variant="ghost" onClick={() => requestSort('taskType')} className="px-1 h-auto">
                             Task Type {getSortIndicator('taskType')}
                         </Button>
                     </TableHead>
                     <TableHead className="w-[130px]">
                         <Button variant="ghost" onClick={() => requestSort('createdDate')} className="px-1 h-auto">
                             Created {getSortIndicator('createdDate')}
                         </Button>
                     </TableHead>
                    <TableHead className="w-[100px] text-right">Story Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHistory.map(task => (
                    <TableRow key={task.id}>
                       <TableCell>{task.movedToSprint}</TableCell>
                      <TableCell>{task.priority}</TableCell>
                      <TableCell className="font-medium">{task.backlogId}</TableCell>
                      <TableCell>{task.title}</TableCell>
                      <TableCell>{task.taskType}</TableCell>
                      <TableCell>{task.createdDate && isValid(parseISO(task.createdDate)) ? format(parseISO(task.createdDate), 'MMM d, yyyy') : 'N/A'}</TableCell>
                      <TableCell className="text-right">{task.storyPoints ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
         )}
      </CardContent>
       {/* Footer or additional controls can be added here */}
    </Card>
  );
}
