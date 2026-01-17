/**
 * TimeshiftControls - DVR-like controls for live TV
 * Shows time behind live and provides seek/jump to live functionality
 */

import { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Radio,
  Rewind,
  FastForward,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useCatchup, type TimeshiftState } from '@/services/CatchupService';

interface TimeshiftControlsProps {
  channelId: string;
  videoElement: HTMLVideoElement | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  className?: string;
}

export function TimeshiftControls({
  channelId,
  videoElement,
  isPlaying,
  onTogglePlay,
  onSeek,
  className,
}: TimeshiftControlsProps) {
  const {
    timeshiftState,
    isTimeshifting,
    behindLiveDisplay,
    goToLive,
    seekBack,
    seekForward,
    hasCatchup,
  } = useCatchup({ channelId, videoElement });
  
  const [showSeekPreview, setShowSeekPreview] = useState(false);
  
  // Calculate progress through buffer
  const bufferProgress = timeshiftState ? 
    ((timeshiftState.playbackPosition - timeshiftState.bufferStart) / 
     (timeshiftState.livePosition - timeshiftState.bufferStart)) * 100 : 100;
  
  const handleSliderChange = (value: number[]) => {
    if (!videoElement || !timeshiftState) return;
    
    const progress = value[0] / 100;
    const bufferDuration = (timeshiftState.livePosition - timeshiftState.bufferStart) / 1000;
    const targetTime = progress * bufferDuration;
    
    // Calculate new position relative to buffer start
    onSeek(targetTime);
  };
  
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Timeshift progress bar */}
      <div className="flex items-center gap-2 w-full">
        {/* Time behind indicator */}
        <span className="text-xs text-muted-foreground min-w-[60px]">
          {formatBufferTime(timeshiftState?.bufferStart)}
        </span>
        
        {/* Progress slider */}
        <div className="flex-1 relative">
          <Slider
            value={[bufferProgress]}
            onValueChange={handleSliderChange}
            max={100}
            step={0.1}
            className="w-full"
          />
          
          {/* Live indicator on slider */}
          <div 
            className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500 animate-pulse"
            title="Live"
          />
        </div>
        
        {/* Live / Behind indicator */}
        <Button
          variant={isTimeshifting ? 'outline' : 'default'}
          size="sm"
          onClick={goToLive}
          className={cn(
            'min-w-[80px] gap-1',
            !isTimeshifting && 'bg-red-600 hover:bg-red-700'
          )}
        >
          <Radio className={cn('w-3 h-3', !isTimeshifting && 'animate-pulse')} />
          {behindLiveDisplay}
        </Button>
      </div>
      
      {/* Timeshift controls */}
      <div className="flex items-center justify-center gap-2">
        {/* Rewind 10s */}
        <Button
          variant="player"
          size="icon"
          onClick={() => seekBack(10)}
          disabled={!timeshiftState?.canSeekBack}
          title="Rewind 10 seconds"
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        
        {/* Rewind 30s */}
        <Button
          variant="player"
          size="icon"
          onClick={() => seekBack(30)}
          disabled={!timeshiftState?.canSeekBack}
          title="Rewind 30 seconds"
        >
          <Rewind className="w-4 h-4" />
        </Button>
        
        {/* Play/Pause */}
        <Button
          variant="player"
          size="icon"
          onClick={onTogglePlay}
          className="w-12 h-12"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </Button>
        
        {/* Forward 30s */}
        <Button
          variant="player"
          size="icon"
          onClick={() => seekForward(30)}
          disabled={!timeshiftState?.canSeekForward}
          title="Forward 30 seconds"
        >
          <FastForward className="w-4 h-4" />
        </Button>
        
        {/* Forward 10s */}
        <Button
          variant="player"
          size="icon"
          onClick={() => seekForward(10)}
          disabled={!timeshiftState?.canSeekForward}
          title="Forward 10 seconds"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
        
        {/* Jump to live */}
        {isTimeshifting && (
          <Button
            variant="default"
            size="sm"
            onClick={goToLive}
            className="ml-4 bg-red-600 hover:bg-red-700 gap-1"
          >
            <Radio className="w-3 h-3 animate-pulse" />
            Go Live
          </Button>
        )}
        
        {/* Catch-up indicator */}
        {hasCatchup && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-2 text-muted-foreground"
            title="Catch-up available"
          >
            <History className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function formatBufferTime(timestamp?: number): string {
  if (!timestamp) return '--:--';
  
  const date = new Date(timestamp);
  return date.toLocaleTimeString('sv-SE', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}
