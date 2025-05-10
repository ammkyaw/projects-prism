// src/components/help/help-modal.tsx
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { HelpCircle, Search } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const glossaryItems = [
  {
    term: 'Story Points',
    definition:
      'A relative unit of measure used in Agile development to estimate the effort required to complete a user story or task. It considers complexity, uncertainty, and effort.',
  },
  {
    term: 'Velocity Chart',
    definition:
      'A chart that shows the amount of value delivered in each sprint, enabling teams to measure their rate of progress and forecast future work.',
  },
  {
    term: 'Burndown Chart',
    definition:
      'A graphical representation of work left to do versus time. It shows the total effort against the amount of work for each iteration.',
  },
  {
    term: 'Definition of Done (DoD)',
    definition:
      'A shared understanding within the team about what it means for a piece of work to be considered complete. It ensures consistency and quality.',
  },
  {
    term: 'Definition of Ready (DoR)',
    definition:
      'A set of criteria that a user story or task must meet before it can be considered ready for inclusion in a sprint. This ensures work is well-understood and actionable.',
  },
  {
    term: 'Sprint',
    definition:
      'A time-boxed period during which a specific amount of work is completed and made ready for review. Typically lasts 1-4 weeks.',
  },
  {
    term: 'Backlog',
    definition:
      'An ordered list of everything that is known to be needed in the product. It is the single source of requirements for any changes to be made to the product.',
  },
  {
    term: 'Backlog Grooming (Refinement)',
    definition:
      'An ongoing process in which the product owner and the development team review items on the backlog to ensure they are appropriately prioritized, detailed, and estimated.',
  },
  {
    term: 'Task Type',
    definition:
      'Categorization of work items, such as New Feature, Improvement, Bug, Hotfix, Refactoring, etc., to help in planning and tracking.',
  },
  {
    term: 'Severity (for Bugs)',
    definition:
      'Indicates the impact of a bug on the system, ranging from Low (minor issue) to Critical (system failure).',
  },
  {
    term: 'Sprint Planning',
    definition: 'A meeting where the team plans the work to be performed during the upcoming sprint.',
  },
  {
    term: 'Sprint Retrospective',
    definition: 'A meeting held at the end of a sprint for the team to reflect on what went well, what could be improved, and how to make those improvements.',
  },
    {
    term: 'Spillover Task',
    definition: 'A task that was planned for a previous sprint but was not completed and is carried over to the current or a future sprint.',
  },
];

export default function HelpModal({ isOpen, onOpenChange }: HelpModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGlossary = glossaryItems.filter(
    (item) =>
      item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Help & Glossary
          </DialogTitle>
          <DialogDescription>
            Find explanations for common Agile and project management terms used
            in Projects Prism.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search glossary..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="mt-4 h-80 w-full rounded-md border p-4">
          {filteredGlossary.length > 0 ? (
            <ul className="space-y-4">
              {filteredGlossary.map((item) => (
                <li key={item.term}>
                  <h3 className="font-semibold text-primary">{item.term}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.definition}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              No terms found matching your search.
            </p>
          )}
        </ScrollArea>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
