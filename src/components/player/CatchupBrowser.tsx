/**
 * CatchupBrowser - Browse and play archived programs
 * Shows EPG history with catch-up availability
 */

import { useState, useMemo } from 'react';
import { format, subDays, startOfDay, endOfDay, isToday, isYesterday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { 
  History, 
  Play, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Calendar,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useEpgStore } from '@/data/stores/epgStore';
import { CatchupService, useCatchup } from '@/services/CatchupService';
import type { CoreEpgProgram } from '@/core/types';

interface CatchupBrowserProps {
  channelId: string;
  channelName: string;
  onPlayCatchup: (url: string, program: CoreEpgProgram) => void;
  onClose: () => void;
  className?: string;
}

export function CatchupBrowser({
  channelId,
  channelName,
  onPlayCatchup,
  onClose,
  className,
}: CatchupBrowserProps) {
  const [selectedDay, setSelectedDay] = useState(0); // 0 = today, -1 = yesterday, etc.
  const { catchupSource, availablePrograms, playCatchup } = useCatchup({ channelId });
  
  // Get all programs for the channel
  const allPrograms = useEpgStore((s) => s.byChannelId.get(channelId) || []);
  
  // Generate available days
  const availableDays = useMemo(() => {
    const days = [];
    const maxDays = catchupSource?.catchupDays || 7;
    
    for (let i = 0; i < maxDays; i++) {
      const date = subDays(new Date(), i);
      days.push({
        offset: -i,
        date,
        label: i === 0 ? 'Idag' : i === 1 ? 'Igår' : format(date, 'EEEE d/M', { locale: sv }),
      });
    }
    return days;
  }, [catchupSource]);
  
  // Filter programs for selected day
  const dayPrograms = useMemo(() => {
    const targetDate = subDays(new Date(), Math.abs(selectedDay));
    const dayStart = startOfDay(targetDate).getTime();
    const dayEnd = endOfDay(targetDate).getTime();
    const now = Date.now();
    
    return allPrograms
      .filter(p => {
        // Program overlaps with selected day
        return p.start < dayEnd && p.end > dayStart;
      })
      .filter(p => {
        // Must have ended for catch-up
        return p.end < now;
      })
      .sort((a, b) => b.start - a.start); // Newest first
  }, [allPrograms, selectedDay]);
  
  const handlePlayProgram = (program: CoreEpgProgram) => {
    const url = playCatchup(program);
    if (url) {
      onPlayCatchup(url, program);
    }
  };
  
  const navigateDay = (direction: number) => {
    const newDay = selectedDay + direction;
    const maxDays = -(catchupSource?.catchupDays || 7) + 1;
    setSelectedDay(Math.min(0, Math.max(maxDays, newDay)));
  };
  
  if (!catchupSource?.supportsCatchup) {
    return (
      <div className={cn('p-6 text-center', className)}>
        <History className="w-12 h-12 mx-auto text-muted-foreground opacity-50 mb-3" />
        <p className="text-muted-foreground">
          Catch-up är inte tillgängligt för denna kanal
        </p>
      </div>
    );
  }
  
  return (
    <div className={cn('flex flex-col h-full bg-card rounded-lg border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold">Catch-up</h3>
            <p className="text-sm text-muted-foreground">{channelName}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Day navigation */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateDay(-1)}
          disabled={selectedDay <= -(catchupSource?.catchupDays || 7) + 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <div className="flex-1 flex items-center justify-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">
            {availableDays.find(d => d.offset === selectedDay)?.label}
          </span>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateDay(1)}
          disabled={selectedDay >= 0}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Program list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {dayPrograms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Inga program tillgängliga</p>
            </div>
          ) : (
            dayPrograms.map((program) => (
              <CatchupProgramCard
                key={program.id}
                program={program}
                onPlay={() => handlePlayProgram(program)}
              />
            ))
          )}
        </div>
      </ScrollArea>
      
      {/* Footer info */}
      <div className="p-3 border-t text-xs text-muted-foreground text-center">
        {catchupSource.catchupDays} dagars arkiv tillgängligt
      </div>
    </div>
  );
}

interface CatchupProgramCardProps {
  program: CoreEpgProgram;
  onPlay: () => void;
}

function CatchupProgramCard({ program, onPlay }: CatchupProgramCardProps) {
  const startTime = new Date(program.start);
  const endTime = new Date(program.end);
  const durationMinutes = Math.round((program.end - program.start) / 60000);
  
  return (
    <div className="group flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors">
      {/* Time */}
      <div className="text-center min-w-[50px]">
        <div className="text-sm font-medium">
          {format(startTime, 'HH:mm')}
        </div>
        <div className="text-xs text-muted-foreground">
          {durationMinutes}m
        </div>
      </div>
      
      {/* Program info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{program.title}</div>
        {program.description && (
          <div className="text-sm text-muted-foreground truncate">
            {program.description}
          </div>
        )}
        {program.category && (
          <Badge variant="secondary" className="mt-1 text-xs">
            {program.category}
          </Badge>
        )}
      </div>
      
      {/* Play button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onPlay}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Play className="w-5 h-5" />
      </Button>
    </div>
  );
}
