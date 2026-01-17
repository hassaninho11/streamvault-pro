/**
 * MultiScreenButton - Toggle multi-screen mode
 */

import { Grid2X2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMultiScreen } from '@/contexts/MultiScreenContext';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MultiScreenButtonProps {
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'player' | 'ghost' | 'outline';
}

export function MultiScreenButton({ 
  className,
  size = 'icon',
  variant = 'player',
}: MultiScreenButtonProps) {
  const { isMultiScreenMode, enterMultiScreen, exitMultiScreen } = useMultiScreen();
  
  const handleClick = () => {
    if (isMultiScreenMode) {
      exitMultiScreen();
    } else {
      enterMultiScreen();
    }
  };
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={handleClick}
          className={cn(
            isMultiScreenMode && 'text-primary bg-primary/20',
            className
          )}
        >
          {isMultiScreenMode ? (
            <X className="w-5 h-5" />
          ) : (
            <Grid2X2 className="w-5 h-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isMultiScreenMode ? 'Stäng multi-screen' : 'Multi-screen'}
      </TooltipContent>
    </Tooltip>
  );
}
