// src/components/help/floating-help-button.tsx
'use client';

import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

interface FloatingHelpButtonProps {
  onOpen: () => void;
}

export default function FloatingHelpButton({
  onOpen,
}: FloatingHelpButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg"
      onClick={onOpen}
      aria-label="Open help modal"
    >
      <HelpCircle className="h-6 w-6" />
    </Button>
  );
}
