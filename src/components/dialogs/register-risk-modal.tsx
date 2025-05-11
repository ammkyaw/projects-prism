// src/components/dialogs/register-risk-modal.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, AlertTriangle, Save } from 'lucide-react';
import type {
  RiskItem,
  RiskCategory,
  RiskStatus,
  RiskLikelihood,
  RiskImpact,
  Member,
} from '@/types/sprint-data';
import {
  riskCategories,
  riskStatuses,
  riskLikelihoods,
  riskImpacts,
  riskLikelihoodValues,
  riskImpactValues,
  initialRiskItem,
} from '@/types/sprint-data';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

interface RegisterRiskModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveRisk: (riskDetails: Omit<RiskItem, 'id' | 'riskScore'>) => void; // ID and score will be handled by parent
  projectMembers: Member[]; // To populate Owner dropdown
  existingRiskTitles: string[]; // To check for duplicate titles
  initialData?: RiskItem | null; // For editing existing risks
}

export default function RegisterRiskModal({
  isOpen,
  onOpenChange,
  onSaveRisk,
  projectMembers,
  existingRiskTitles,
  initialData,
}: RegisterRiskModalProps) {
  const [riskDetails, setRiskDetails] =
    useState<Omit<RiskItem, 'id' | 'riskScore'>>(initialRiskItem);
  const [identifiedDateObj, setIdentifiedDateObj] = useState<Date | undefined>(
    undefined
  );
  const { toast } = useToast();

  const calculateRiskScore = useCallback((): number => {
    const likelihoodValue = riskLikelihoodValues[riskDetails.likelihood];
    const impactValue = riskImpactValues[riskDetails.impact];
    if (likelihoodValue && impactValue) {
      return likelihoodValue * impactValue;
    }
    return 0; // Return 0 if likelihood or impact is not set
  }, [riskDetails.likelihood, riskDetails.impact]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const { id, riskScore, ...editableData } = initialData; // Exclude id and riskScore
        setRiskDetails(editableData);
        setIdentifiedDateObj(
          initialData.identifiedDate
            ? parseISO(initialData.identifiedDate)
            : undefined
        );
      } else {
        setRiskDetails(initialRiskItem);
        setIdentifiedDateObj(undefined);
      }
    }
  }, [isOpen, initialData]);

  const handleInputChange = (
    field: keyof Omit<RiskItem, 'id' | 'riskScore' | 'identifiedDate'>,
    value: string
  ) => {
    setRiskDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (
    field: 'category' | 'status' | 'likelihood' | 'impact' | 'owner',
    value: string
  ) => {
    setRiskDetails((prev) => ({
      ...prev,
      [field]: value === 'none' ? '' : value,
    }));
  };

  const handleDateChange = (date: Date | undefined) => {
    setIdentifiedDateObj(date);
    setRiskDetails((prev) => ({
      ...prev,
      identifiedDate: date ? format(date, 'yyyy-MM-dd') : '',
    }));
  };

  const handleSave = () => {
    if (!riskDetails.title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Risk title is required.',
      });
      return;
    }
    // Check for duplicates only if it's a new risk or if the title has changed for an existing risk
    if (
      (!initialData ||
        (initialData &&
          initialData.title.toLowerCase() !==
            riskDetails.title.trim().toLowerCase())) &&
      existingRiskTitles.includes(riskDetails.title.trim().toLowerCase())
    ) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'A risk with this title already exists.',
      });
      return;
    }
    if (!riskDetails.identifiedDate) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Identified date is required.',
      });
      return;
    }
    if (!riskDetails.owner) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Owner is required.',
      });
      return;
    }
    // The ID and riskScore will be handled by the parent/hook,
    // or preserved if initialData (editing) is present.
    onSaveRisk(riskDetails);
    onOpenChange(false);
  };

  const riskScoreDisplay = calculateRiskScore(); // Calculate for display

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />{' '}
            {initialData ? 'Edit Risk' : 'Register New Risk'}
          </DialogTitle>
          <DialogDescription>
            Fill in the details for the{' '}
            {initialData ? 'risk item' : 'new risk item'}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="mt-4 max-h-[65vh] w-full rounded-md border p-4">
          <div className="space-y-4">
            {/* Title and Description */}
            <div className="space-y-1">
              <Label htmlFor="risk-title">Title*</Label>
              <Input
                id="risk-title"
                value={riskDetails.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Key Developer Resignation"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="risk-description">Description</Label>
              <Textarea
                id="risk-description"
                value={riskDetails.description}
                onChange={(e) =>
                  handleInputChange('description', e.target.value)
                }
                placeholder="Detailed description of the risk..."
                rows={3}
              />
            </div>

            {/* Date, Owner, Category */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="risk-identified-date">Identified Date*</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !identifiedDateObj && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {identifiedDateObj ? (
                        format(identifiedDateObj, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={identifiedDateObj}
                      onSelect={handleDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label htmlFor="risk-owner">Owner*</Label>
                <Select
                  value={riskDetails.owner || 'none'}
                  onValueChange={(value) => handleSelectChange('owner', value)}
                >
                  <SelectTrigger id="risk-owner">
                    <SelectValue placeholder="Select Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>
                      -- Select Owner --
                    </SelectItem>
                    {projectMembers.map((member) => (
                      <SelectItem key={member.id} value={member.name}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))}
                    {projectMembers.length === 0 && (
                      <SelectItem value="no-members" disabled>
                        No members in project
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="risk-category">Category</Label>
                <Select
                  value={riskDetails.category}
                  onValueChange={(value) =>
                    handleSelectChange('category', value as RiskCategory)
                  }
                >
                  <SelectTrigger id="risk-category">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {riskCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status, Likelihood, Impact, Score */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="risk-status">Status</Label>
                <Select
                  value={riskDetails.status}
                  onValueChange={(value) =>
                    handleSelectChange('status', value as RiskStatus)
                  }
                >
                  <SelectTrigger id="risk-status">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {riskStatuses.map((stat) => (
                      <SelectItem key={stat} value={stat}>
                        {stat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="risk-likelihood">Likelihood</Label>
                <Select
                  value={riskDetails.likelihood}
                  onValueChange={(value) =>
                    handleSelectChange('likelihood', value as RiskLikelihood)
                  }
                >
                  <SelectTrigger id="risk-likelihood">
                    <SelectValue placeholder="Select Likelihood" />
                  </SelectTrigger>
                  <SelectContent>
                    {riskLikelihoods.map((like) => (
                      <SelectItem key={like} value={like}>
                        {like}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="risk-impact">Impact</Label>
                <Select
                  value={riskDetails.impact}
                  onValueChange={(value) =>
                    handleSelectChange('impact', value as RiskImpact)
                  }
                >
                  <SelectTrigger id="risk-impact">
                    <SelectValue placeholder="Select Impact" />
                  </SelectTrigger>
                  <SelectContent>
                    {riskImpacts.map((imp) => (
                      <SelectItem key={imp} value={imp}>
                        {imp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="risk-score">Risk Score</Label>
                <Input
                  id="risk-score"
                  value={riskScoreDisplay}
                  readOnly
                  className="cursor-default bg-muted font-semibold"
                />
              </div>
            </div>

            {/* Mitigation and Contingency */}
            <div className="space-y-1">
              <Label htmlFor="risk-mitigation">Mitigation Strategies</Label>
              <Textarea
                id="risk-mitigation"
                value={riskDetails.mitigationStrategies}
                onChange={(e) =>
                  handleInputChange('mitigationStrategies', e.target.value)
                }
                placeholder="Describe strategies to reduce likelihood or impact..."
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="risk-contingency">Contingency Plan</Label>
              <Textarea
                id="risk-contingency"
                value={riskDetails.contingencyPlan}
                onChange={(e) =>
                  handleInputChange('contingencyPlan', e.target.value)
                }
                placeholder="Describe plan if the risk materializes..."
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">* Required field.</p>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" /> Save Risk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
