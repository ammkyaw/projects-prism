
"use client";

import React, { useState, useMemo } from 'react'; // Added React import
import type { Task } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Info, Filter, ArrowUpDown } from 'lucide-react';
import { taskPriorities } from '@/types/sprint-data';
import { format, parseISO, isValid } from 'date-fns';

interface BacklogPrioritizationTabProps {
  projectId: string;
  projectName: string;
  backlog: Task[]; // Pass backlog data for prioritization
}

type SortKey = 'priority' | 'title' | 'taskType' | 'createdDate';
type SortDirection = 'asc' | 'desc';

export default function BacklogPrioritizationTab({ projectId, projectName, backlog }: BacklogPrioritizationTabProps) {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: SortDirection } | null>(null);

  const sortedBacklog = useMemo(() => {
    let sortableItems = [...backlog];
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
                // Handle potentially invalid dates during sorting
                 const dateA = a.createdDate && isValid(parseISO(a.createdDate)) ? parseISO(a.createdDate) : new Date(0); // Fallback for invalid/missing
                 const dateB = b.createdDate && isValid(parseISO(b.createdDate)) ? parseISO(b.createdDate) : new Date(0);
                 aValue = dateA.getTime();
                 bValue = dateB.getTime();
                break;
            case 'title':
                 aValue = a.title?.toLowerCase() || '';
                 bValue = b.title?.toLowerCase() || '';
                 break;
            default:
                 aValue = a[sortConfig.key]?.toString().toLowerCase() || '';
                 bValue = b[sortConfig.key]?.toString().toLowerCase() || '';
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
        // Default sort by priority if no specific sort is selected
        sortableItems.sort((a, b) => taskPriorities.indexOf(a.priority || 'Medium') - taskPriorities.indexOf(b.priority || 'Medium'));
    }
    return sortableItems;
  }, [backlog, sortConfig]);

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
        <CardTitle className="flex items-center justify-center gap-2"><Filter className="h-5 w-5 text-primary" /> Backlog Prioritization</CardTitle>
        <CardDescription>Prioritize backlog items for project '{projectName}' based on value, effort, or other criteria. Click headers to sort.</CardDescription>
      </CardHeader>
      <CardContent>
        {backlog.length === 0 ? (
             <div className="flex flex-col items-center justify-center min-h-[200px] border-dashed border-2 rounded-md p-6">
                <Info className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No backlog items to prioritize.</p>
                <p className="text-sm text-muted-foreground">Add items in the 'Management' tab.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                  {sortedBacklog.map(task => (
                    <TableRow key={task.id}>
                      <TableCell>{task.priority}</TableCell>
                      <TableCell className="font-medium">{task.backlogId}</TableCell>
                      <TableCell>{task.title}</TableCell>
                      <TableCell>{task.taskType}</TableCell>
                      <TableCell>{task.createdDate ? format(parseISO(task.createdDate), 'MMM d, yyyy') : 'N/A'}</TableCell>
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
