/**
 * SkipButton - "Skip Intro" / "Skip Recap" button
 */

import { FastForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTVMode } from '@/contexts/TVModeContext';

interface SkipButtonProps {
  type: 'intro' | 'recap';
  onSkip: () => void;
}

export function SkipButton({ type, onSkip }: SkipButtonProps) {
  const { isTVMode } = useTVMode();
  
  return (
    <div className="absolute bottom-32 right-6">
      <Button
        onClick={onSkip}
        className={cn(
          "gap-2 bg-white/90 text-black hover:bg-white shadow-lg",
          "animate-in slide-in-from-right duration-300",
          isTVMode && "h-14 text-lg px-6"
        )}
      >
        <FastForward className={cn("w-5 h-5", isTVMode && "w-6 h-6")} />
        {type === 'intro' ? 'Hoppa intro' : 'Hoppa recap'}
      </Button>
    </div>
  );
}
