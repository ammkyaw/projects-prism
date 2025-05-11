// src/components/settings/config-tab.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Trash2, Save, Settings2, Scaling } from 'lucide-react';
import type { StoryPointScale } from '@/types/sprint-data';
import {
  storyPointScaleOptions,
  taskTypes as predefinedTaskTypes,
  taskStatuses as predefinedTicketStatuses,
} from '@/types/sprint-data';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ConfigTabProps {
  projectId: string;
  projectName: string;
  initialStoryPointScale: StoryPointScale | undefined;
  initialCustomTaskTypes: string[] | undefined;
  initialCustomTicketStatuses: string[] | undefined;
  onSaveConfigurations: (
    scale: StoryPointScale,
    customTaskTypes: string[],
    customTicketStatuses: string[]
  ) => void;
}

export default function ConfigTab({
  projectId,
  projectName,
  initialStoryPointScale,
  initialCustomTaskTypes,
  initialCustomTicketStatuses,
  onSaveConfigurations,
}: ConfigTabProps) {
  const [selectedScale, setSelectedScale] = useState<StoryPointScale>(
    initialStoryPointScale || 'Fibonacci'
  );
  const [customTaskTypes, setCustomTaskTypes] = useState<string[]>(
    initialCustomTaskTypes || []
  );
  const [newCustomTaskType, setNewCustomTaskType] = useState('');
  const [customTicketStatuses, setCustomTicketStatuses] = useState<string[]>(
    initialCustomTicketStatuses || []
  );
  const [newCustomTicketStatus, setNewCustomTicketStatus] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSelectedScale(initialStoryPointScale || 'Fibonacci');
    setCustomTaskTypes(initialCustomTaskTypes || []);
    setCustomTicketStatuses(initialCustomTicketStatuses || []);
    setHasUnsavedChanges(false);
  }, [
    initialStoryPointScale,
    initialCustomTaskTypes,
    initialCustomTicketStatuses,
    projectId, // Reset when project changes
  ]);

  useEffect(() => {
    const originalScale = initialStoryPointScale || 'Fibonacci';
    const originalTaskTypes = JSON.stringify(initialCustomTaskTypes || []);
    const originalTicketStatuses = JSON.stringify(
      initialCustomTicketStatuses || []
    );

    const currentTaskTypes = JSON.stringify(customTaskTypes.sort());
    const currentTicketStatuses = JSON.stringify(customTicketStatuses.sort());

    setHasUnsavedChanges(
      selectedScale !== originalScale ||
        currentTaskTypes !== originalTaskTypes ||
        currentTicketStatuses !== originalTicketStatuses
    );
  }, [
    selectedScale,
    customTaskTypes,
    customTicketStatuses,
    initialStoryPointScale,
    initialCustomTaskTypes,
    initialCustomTicketStatuses,
  ]);

  const handleAddCustomTaskType = () => {
    const trimmedType = newCustomTaskType.trim();
    if (
      trimmedType &&
      !customTaskTypes.includes(trimmedType) &&
      !predefinedTaskTypes.includes(trimmedType as any)
    ) {
      setCustomTaskTypes((prev) => [...prev, trimmedType].sort());
      setNewCustomTaskType('');
    } else if (predefinedTaskTypes.includes(trimmedType as any)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `"${trimmedType}" is a predefined task type.`,
      });
    } else if (customTaskTypes.includes(trimmedType)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Task type "${trimmedType}" already exists.`,
      });
    }
  };

  const handleRemoveCustomTaskType = (typeToRemove: string) => {
    setCustomTaskTypes((prev) => prev.filter((type) => type !== typeToRemove));
  };

  const handleAddCustomTicketStatus = () => {
    const trimmedStatus = newCustomTicketStatus.trim();
    if (
      trimmedStatus &&
      !customTicketStatuses.includes(trimmedStatus) &&
      !predefinedTicketStatuses.includes(trimmedStatus as any)
    ) {
      setCustomTicketStatuses((prev) => [...prev, trimmedStatus].sort());
      setNewCustomTicketStatus('');
    } else if (predefinedTicketStatuses.includes(trimmedStatus as any)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `"${trimmedStatus}" is a predefined ticket status.`,
      });
    } else if (customTicketStatuses.includes(trimmedStatus)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Ticket status "${trimmedStatus}" already exists.`,
      });
    }
  };

  const handleRemoveCustomTicketStatus = (statusToRemove: string) => {
    setCustomTicketStatuses((prev) =>
      prev.filter((status) => status !== statusToRemove)
    );
  };

  const handleSave = () => {
    // Basic validation
    if (customTaskTypes.some((type) => !type.trim())) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Custom task types cannot be empty.',
      });
      return;
    }
    if (customTicketStatuses.some((status) => !status.trim())) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Custom ticket statuses cannot be empty.',
      });
      return;
    }
    onSaveConfigurations(selectedScale, customTaskTypes, customTicketStatuses);
    setHasUnsavedChanges(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" /> Project
              Configurations: {projectName}
            </CardTitle>
            <CardDescription>
              Customize story point scales, task types, and ticket statuses for
              this project.
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
            <Save className="mr-2 h-4 w-4" /> Save Configurations
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Story Point Scales Section */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Scaling className="h-5 w-5 text-muted-foreground" /> Story Point
            Scale
          </h3>
          <div className="max-w-sm space-y-1">
            <Label htmlFor="story-point-scale">Estimation Scale</Label>
            <Select
              value={selectedScale}
              onValueChange={(value) =>
                setSelectedScale(value as StoryPointScale)
              }
            >
              <SelectTrigger id="story-point-scale">
                <SelectValue placeholder="Select Scale" />
              </SelectTrigger>
              <SelectContent>
                {storyPointScaleOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the estimation scale used for story points.
            </p>
          </div>
        </section>

        {/* Custom Task Types Section */}
        <section>
          <h3 className="mb-3 text-lg font-semibold">Custom Task Types</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Predefined types: {predefinedTaskTypes.join(', ')}.
          </p>
          <div className="mb-3 flex items-end gap-2">
            <div className="flex-grow space-y-1">
              <Label htmlFor="new-task-type">Add New Task Type</Label>
              <Input
                id="new-task-type"
                value={newCustomTaskType}
                onChange={(e) => setNewCustomTaskType(e.target.value)}
                placeholder="e.g., Research, Spike"
                onKeyDown={(e) =>
                  e.key === 'Enter' && handleAddCustomTaskType()
                }
              />
            </div>
            <Button
              onClick={handleAddCustomTaskType}
              variant="outline"
              size="icon"
              aria-label="Add Task Type"
            >
              <PlusCircle className="h-5 w-5" />
            </Button>
          </div>
          {customTaskTypes.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Your Custom Task Types:
              </h4>
              <div className="flex flex-wrap gap-2">
                {customTaskTypes.map((type) => (
                  <Badge key={type} variant="secondary" className="text-sm">
                    {type}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCustomTaskType(type)}
                      className="ml-1 h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${type}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Custom Ticket Statuses Section */}
        <section>
          <h3 className="mb-3 text-lg font-semibold">Custom Ticket Statuses</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Predefined statuses:{' '}
            {predefinedTicketStatuses.filter((s) => s !== null).join(', ')}.
          </p>
          <div className="mb-3 flex items-end gap-2">
            <div className="flex-grow space-y-1">
              <Label htmlFor="new-ticket-status">Add New Ticket Status</Label>
              <Input
                id="new-ticket-status"
                value={newCustomTicketStatus}
                onChange={(e) => setNewCustomTicketStatus(e.target.value)}
                placeholder="e.g., Ready for UAT, Deploy"
                onKeyDown={(e) =>
                  e.key === 'Enter' && handleAddCustomTicketStatus()
                }
              />
            </div>
            <Button
              onClick={handleAddCustomTicketStatus}
              variant="outline"
              size="icon"
              aria-label="Add Ticket Status"
            >
              <PlusCircle className="h-5 w-5" />
            </Button>
          </div>
          {customTicketStatuses.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Your Custom Ticket Statuses:
              </h4>
              <div className="flex flex-wrap gap-2">
                {customTicketStatuses.map((status) => (
                  <Badge key={status} variant="secondary" className="text-sm">
                    {status}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCustomTicketStatus(status)}
                      className="ml-1 h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${status}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </section>
      </CardContent>
      <CardFooter className="flex items-center justify-end border-t pt-4">
        <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
          <Save className="mr-2 h-4 w-4" /> Save Configurations
        </Button>
      </CardFooter>
    </Card>
  );
}
