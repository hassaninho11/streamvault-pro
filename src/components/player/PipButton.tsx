/**
 * PiP Button - Trigger Picture-in-Picture for current video
 */

import { PictureInPicture2, PictureInPictureIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePip } from '@/services/PipService';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PipButtonProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'player' | 'ghost' | 'outline';
}

export function PipButton({ 
  videoRef, 
  className,
  size = 'icon',
  variant = 'player',
}: PipButtonProps) {
  const { isActive, isSupported, togglePip } = usePip(videoRef);
  
  if (!isSupported) return null;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={togglePip}
          className={cn(
            isActive && 'text-primary',
            className
          )}
        >
          {isActive ? (
            <PictureInPictureIcon className="w-5 h-5" />
          ) : (
            <PictureInPicture2 className="w-5 h-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isActive ? 'Avsluta bild-i-bild' : 'Bild-i-bild'}
      </TooltipContent>
    </Tooltip>
  );
}
