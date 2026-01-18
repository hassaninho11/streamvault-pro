/**
 * PlaybackSpeedSelector - Speed control popup
 */

import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTVMode } from '@/contexts/TVModeContext';

interface PlaybackSpeedSelectorProps {
  currentSpeed: number;
  onSelectSpeed: (speed: number) => void;
  onClose: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function PlaybackSpeedSelector({
  currentSpeed,
  onSelectSpeed,
  onClose,
}: PlaybackSpeedSelectorProps) {
  const { isTVMode } = useTVMode();
  
  return (
    <div 
      className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className={cn(
          "bg-background rounded-xl shadow-2xl overflow-hidden",
          isTVMode ? "w-80" : "w-64"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className={cn(
            "font-semibold",
            isTVMode ? "text-xl" : "text-lg"
          )}>
            Uppspelningshastighet
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Speed options */}
        <div className="p-2">
          {SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              onClick={() => onSelectSpeed(speed)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
                "hover:bg-muted",
                currentSpeed === speed && "bg-primary/10 text-primary"
              )}
            >
              <span className={cn(
                isTVMode && "text-lg",
                speed === 1 && "font-medium"
              )}>
                {speed === 1 ? 'Normal' : `${speed}x`}
              </span>
              {currentSpeed === speed && <Check className="w-5 h-5" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
