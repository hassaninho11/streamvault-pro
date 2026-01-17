import { memo } from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Channel, EpgProgram } from '@/types/iptv';
import { useTVMode } from '@/contexts/TVModeContext';
import { format } from 'date-fns';

interface TVNowNextPanelProps {
  channel: Channel | null;
  currentProgram?: EpgProgram | null;
  nextProgram?: EpgProgram | null;
  className?: string;
}

const ProgramCard = memo(({ 
  program, 
  label, 
  isCurrent,
  isTVMode 
}: { 
  program: EpgProgram | null | undefined;
  label: string;
  isCurrent?: boolean;
  isTVMode: boolean;
}) => {
  if (!program) {
    return (
      <div className={cn(
        "rounded-xl bg-muted/50 border border-border p-4",
        isTVMode && "p-6"
      )}>
        <span className={cn(
          "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
          isTVMode && "text-sm"
        )}>
          {label}
        </span>
        <p className={cn(
          "text-muted-foreground mt-2",
          isTVMode ? "text-lg" : "text-sm"
        )}>
          No program information
        </p>
      </div>
    );
  }

  const startTime = format(new Date(program.start), 'HH:mm');
  const endTime = format(new Date(program.end), 'HH:mm');
  
  // Calculate progress for current program
  let progress = 0;
  if (isCurrent) {
    const now = Date.now();
    const start = new Date(program.start).getTime();
    const end = new Date(program.end).getTime();
    progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  }

  return (
    <div className={cn(
      "rounded-xl border transition-all",
      isCurrent 
        ? "bg-primary/10 border-primary/30" 
        : "bg-muted/30 border-border",
      isTVMode ? "p-6" : "p-4"
    )}>
      {/* Label */}
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          "font-semibold uppercase tracking-wider",
          isCurrent ? "text-primary" : "text-muted-foreground",
          isTVMode ? "text-sm" : "text-xs"
        )}>
          {label}
        </span>
        {isCurrent && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className={cn(
        "font-bold line-clamp-2 mb-2",
        isTVMode ? "text-xl" : "text-base"
      )}>
        {program.title}
      </h3>

      {/* Description */}
      {program.description && (
        <p className={cn(
          "text-muted-foreground line-clamp-2 mb-3",
          isTVMode ? "text-base" : "text-sm"
        )}>
          {program.description}
        </p>
      )}

      {/* Time */}
      <div className={cn(
        "flex items-center gap-2 text-muted-foreground",
        isTVMode ? "text-base" : "text-sm"
      )}>
        <Clock className={cn(isTVMode ? "w-5 h-5" : "w-4 h-4")} />
        <span>{startTime} - {endTime}</span>
      </div>

      {/* Progress bar for current program */}
      {isCurrent && (
        <div className="mt-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

ProgramCard.displayName = 'ProgramCard';

export function TVNowNextPanel({ 
  channel, 
  currentProgram, 
  nextProgram,
  className 
}: TVNowNextPanelProps) {
  const { isTVMode } = useTVMode();

  if (!channel) {
    return (
      <div className={cn(
        "flex items-center justify-center h-full",
        className
      )}>
        <p className="text-muted-foreground text-center">
          Select a channel to see program info
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col gap-4 h-full p-4",
      isTVMode && "gap-6 p-6",
      className
    )}>
      {/* Channel Header */}
      <div className={cn(
        "pb-4 border-b border-border",
        isTVMode && "pb-6"
      )}>
        <h2 className={cn(
          "font-bold text-foreground",
          isTVMode ? "text-2xl" : "text-lg"
        )}>
          {channel.name}
        </h2>
        <p className={cn(
          "text-muted-foreground",
          isTVMode ? "text-lg" : "text-sm"
        )}>
          {channel.group}
        </p>
      </div>

      {/* Now Playing */}
      <ProgramCard 
        program={currentProgram} 
        label="Now Playing" 
        isCurrent 
        isTVMode={isTVMode}
      />

      {/* Up Next */}
      <div className={cn(
        "flex items-center gap-2 text-muted-foreground",
        isTVMode ? "text-base" : "text-sm"
      )}>
        <ChevronRight className={cn(isTVMode ? "w-5 h-5" : "w-4 h-4")} />
        <span>Up Next</span>
      </div>
      
      <ProgramCard 
        program={nextProgram} 
        label="Up Next" 
        isTVMode={isTVMode}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Hint */}
      <div className={cn(
        "text-center text-muted-foreground py-3 border-t border-border",
        isTVMode ? "text-sm" : "text-xs"
      )}>
        Press <kbd className="px-2 py-1 bg-muted rounded text-foreground font-mono">G</kbd> for full guide
      </div>
    </div>
  );
}
