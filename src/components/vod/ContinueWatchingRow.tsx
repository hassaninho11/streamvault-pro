/**
 * Continue Watching Row - Shows in-progress VOD content
 */

import { Play, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useFavoritesStore, WatchProgress } from "@/data/stores/favoritesStore";

interface ContinueWatchingRowProps {
  onPlay: (item: WatchProgress) => void;
  className?: string;
}

export function ContinueWatchingRow({ onPlay, className }: ContinueWatchingRowProps) {
  const items = useFavoritesStore(state => state.getContinueWatching(10));
  const clearProgress = useFavoritesStore(state => state.clearProgress);

  if (items.length === 0) return null;

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) {
      return `${h}h ${m}m left`;
    }
    return `${m}m left`;
  };

  const getTimeRemaining = (item: WatchProgress): string => {
    const remaining = item.duration - item.currentTime;
    return formatTime(remaining);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-semibold">Continue Watching</h3>
        <span className="text-sm text-muted-foreground">{items.length} items</span>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative flex-shrink-0 w-64 group"
            >
              {/* Poster/Thumbnail */}
              <div 
                className="relative aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer"
                onClick={() => onPlay(item)}
              >
                {item.posterUrl ? (
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <Play className="w-10 h-10 text-primary/50" />
                  </div>
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="glow" size="lg" className="rounded-full">
                    <Play className="w-6 h-6" />
                  </Button>
                </div>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearProgress(item.itemId);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0">
                  <Progress value={item.progress} className="h-1 rounded-none" />
                </div>
              </div>

              {/* Info */}
              <div className="mt-2 px-1">
                <h4 className="font-medium truncate">{item.title}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  {item.seriesTitle && (
                    <>
                      <span>{item.seriesTitle}</span>
                      <span>•</span>
                      <span>S{item.season} E{item.episode}</span>
                      <span>•</span>
                    </>
                  )}
                  <Clock className="w-3 h-3" />
                  <span>{getTimeRemaining(item)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export default ContinueWatchingRow;
