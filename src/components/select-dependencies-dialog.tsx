'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LinkIcon } from 'lucide-react';

interface PotentialDependency {
  id: string;
  title: string;
}

interface SelectDependenciesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentDependencies: string[]; // IDs of currently selected dependencies
  potentialDependencies: PotentialDependency[]; // List of available backlog items { id, title }
  onSave: (selectedDependencyIds: string[]) => void; // Callback with array of selected dependency IDs
  currentTaskName?: string; // Optional: Name of the task being edited
  currentTaskId?: string; // Optional: ID of the task being edited
}

export default function SelectDependenciesDialog({
  isOpen,
  onOpenChange,
  currentDependencies,
  potentialDependencies,
  onSave,
  currentTaskName,
  currentTaskId,
}: SelectDependenciesDialogProps) {
  const [selectedDeps, setSelectedDeps] = useState<Set<string>>(new Set());

  // Initialize selection when dialog opens based on current dependencies
  useEffect(() => {
    if (isOpen) {
      setSelectedDeps(new Set(currentDependencies));
    }
  }, [isOpen, currentDependencies]);

  const handleDependencyToggle = (depId: string, isChecked: boolean) => {
    setSelectedDeps((prev) => {
      const newSelection = new Set(prev);
      if (isChecked) {
        newSelection.add(depId);
      } else {
        newSelection.delete(depId);
      }
      return newSelection;
    });
  };

  const handleSaveClick = () => {
    onSave(Array.from(selectedDeps));
    onOpenChange(false); // Close the dialog after saving
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" /> Select Dependencies
          </DialogTitle>
          <DialogDescription>
            Select the backlog items that{' '}
            {currentTaskName
              ? `task '${currentTaskName} (${currentTaskId || ''})'`
              : 'this task'}{' '}
            depends on.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {potentialDependencies.length === 0 ? (
            <p className="py-4 text-center text-sm italic text-muted-foreground">
              No other backlog items available to select as dependencies.
            </p>
          ) : (
            <ScrollArea className="h-64 w-full rounded-md border p-4">
              <div className="space-y-2">
                {potentialDependencies.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between"
                  >
                    <Label
                      htmlFor={`dep-${dep.id}`}
                      className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                    >
                      <Checkbox
                        id={`dep-${dep.id}`}
                        checked={selectedDeps.has(dep.id)}
                        onCheckedChange={(checked) =>
                          handleDependencyToggle(dep.id, !!checked)
                        }
                        aria-label={`Select dependency ${dep.title} (${dep.id})`}
                      />
                      {dep.title}{' '}
                      <span className="text-xs text-muted-foreground">
                        ({dep.id})
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSaveClick}
            disabled={potentialDependencies.length === 0}
          >
            Save Dependencies ({selectedDeps.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
