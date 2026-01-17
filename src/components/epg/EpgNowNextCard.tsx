/**
 * EPG Now/Next Card - Shows current and next program with progress
 */

import { useMemo } from "react";
import { Clock, Bell, BellOff, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CoreEpgProgram } from "@/core/types";
import { epgAlertsService } from "@/services/EpgAlertsService";

// Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  'sports': 'bg-green-500/20 text-green-400 border-green-500/30',
  'sport': 'bg-green-500/20 text-green-400 border-green-500/30',
  'news': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'movie': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'movies': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'film': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'kids': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'children': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'documentary': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'music': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'series': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'entertainment': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const getCategoryColor = (category?: string): string => {
  if (!category) return 'bg-muted text-muted-foreground';
  const key = category.toLowerCase();
  return CATEGORY_COLORS[key] || 'bg-muted text-muted-foreground';
};

interface EpgNowNextCardProps {
  channelId: string;
  channelName: string;
  now?: CoreEpgProgram;
  next?: CoreEpgProgram;
  onProgramClick?: (program: CoreEpgProgram) => void;
  compact?: boolean;
  className?: string;
}

export function EpgNowNextCard({
  channelId,
  channelName,
  now,
  next,
  onProgramClick,
  compact = false,
  className,
}: EpgNowNextCardProps) {
  const currentTime = Date.now();

  const nowProgress = useMemo(() => {
    if (!now) return 0;
    const elapsed = currentTime - now.start;
    const duration = now.end - now.start;
    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
  }, [now, currentTime]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: number, end: number) => {
    const mins = Math.round((end - start) / 60000);
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m}m`;
    }
    return `${mins}m`;
  };

  const toggleAlert = (program: CoreEpgProgram) => {
    if (epgAlertsService.hasAlert(program.id)) {
      epgAlertsService.removeAlertByProgram(program.id);
    } else {
      epgAlertsService.addAlert(
        channelId,
        program.id,
        program.title,
        program.start
      );
    }
  };

  if (!now && !next) {
    return (
      <div className={cn(
        "p-3 rounded-lg bg-muted/30 text-center text-sm text-muted-foreground",
        className
      )}>
        No program information available
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("space-y-1", className)}>
        {now && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground w-12">NOW</span>
            <span className="truncate flex-1">{now.title}</span>
            <Progress value={nowProgress} className="w-16 h-1" />
          </div>
        )}
        {next && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-xs w-12">{formatTime(next.start)}</span>
            <span className="truncate flex-1">{next.title}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Now Playing */}
      {now && (
        <div 
          className="p-3 rounded-lg bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/15 transition-colors"
          onClick={() => onProgramClick?.(now)}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs bg-primary/20 text-primary border-primary/30">
                  LIVE
                </Badge>
                {now.category && (
                  <Badge variant="outline" className={cn("text-xs", getCategoryColor(now.category))}>
                    {now.category}
                  </Badge>
                )}
              </div>
              <h4 className="font-semibold truncate">{now.title}</h4>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{formatDuration(now.start, now.end)}</span>
            </div>
          </div>
          
          {now.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {now.description}
            </p>
          )}
          
          <div className="flex items-center gap-3">
            <Progress value={nowProgress} className="flex-1 h-1.5" />
            <span className="text-xs text-muted-foreground">
              {formatTime(now.start)} - {formatTime(now.end)}
            </span>
          </div>
        </div>
      )}

      {/* Up Next */}
      {next && (
        <div 
          className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
          onClick={() => onProgramClick?.(next)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">
                  {formatTime(next.start)}
                </span>
                {next.category && (
                  <Badge variant="outline" className={cn("text-xs", getCategoryColor(next.category))}>
                    {next.category}
                  </Badge>
                )}
              </div>
              <h4 className="font-medium truncate">{next.title}</h4>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAlert(next);
                }}
                title={epgAlertsService.hasAlert(next.id) ? "Remove reminder" : "Set reminder"}
              >
                {epgAlertsService.hasAlert(next.id) ? (
                  <BellOff className="w-4 h-4 text-primary" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
              </Button>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EpgNowNextCard;
