/**
 * EpisodeListDrawer - In-player episode selection drawer
 */

import { useState, useEffect } from 'react';
import { X, Play, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Series, Season, Episode } from '@/types/vod';
import { useVodStore } from '@/data/stores/vodStore';
import { useTVMode } from '@/contexts/TVModeContext';

interface EpisodeListDrawerProps {
  series: Series;
  currentEpisodeId: string;
  onSelectEpisode: (episode: Episode) => void;
  onClose: () => void;
}

export function EpisodeListDrawer({
  series,
  currentEpisodeId,
  onSelectEpisode,
  onClose,
}: EpisodeListDrawerProps) {
  const { isTVMode } = useTVMode();
  const { getWatchProgress } = useVodStore();
  
  // Find current season
  const [selectedSeason, setSelectedSeason] = useState<number>(() => {
    for (const season of series.seasons || []) {
      const hasCurrentEpisode = season.episodes?.some(e => e.id === currentEpisodeId);
      if (hasCurrentEpisode) {
        return season.seasonNumber;
      }
    }
    return series.seasons?.[0]?.seasonNumber || 1;
  });
  
  const currentSeason = series.seasons?.find(s => s.seasonNumber === selectedSeason);
  
  return (
    <div 
      className="absolute inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50"
      onClick={onClose}
    >
      <div 
        className={cn(
          "bg-background h-full shadow-2xl animate-in slide-in-from-right duration-300",
          isTVMode ? "w-[500px]" : "w-[350px]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <h2 className={cn(
              "font-semibold truncate",
              isTVMode ? "text-xl" : "text-lg"
            )}>
              {series.title}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Season tabs */}
        {series.seasons && series.seasons.length > 1 && (
          <Tabs
            value={String(selectedSeason)}
            onValueChange={(v) => setSelectedSeason(Number(v))}
            className="w-full"
          >
            <div className="px-4 pt-2">
              <TabsList className="w-full justify-start overflow-x-auto">
                {series.seasons.map(season => (
                  <TabsTrigger
                    key={season.seasonNumber}
                    value={String(season.seasonNumber)}
                  >
                    Säsong {season.seasonNumber}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        )}
        
        {/* Episode list */}
        <ScrollArea className="flex-1 h-[calc(100%-120px)]">
          <div className="p-4 space-y-1">
            {currentSeason?.episodes?.map(episode => {
              const progress = getWatchProgress(episode.id);
              const isCurrent = episode.id === currentEpisodeId;
              const isWatched = progress?.completed;
              
              return (
                <button
                  key={episode.id}
                  onClick={() => onSelectEpisode(episode)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                    "hover:bg-muted focus:bg-muted focus:outline-none",
                    isCurrent && "bg-primary/10 border border-primary/20",
                    isTVMode && "p-4"
                  )}
                >
                  {/* Episode number */}
                  <div className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0",
                    isCurrent ? "bg-primary text-primary-foreground" : "bg-muted",
                    isTVMode && "w-12 h-12"
                  )}>
                    {isCurrent ? (
                      <Play className="w-4 h-4" fill="currentColor" />
                    ) : isWatched ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span className="font-medium">{episode.episodeNumber}</span>
                    )}
                  </div>
                  
                  {/* Episode info */}
                  <div className="flex-1 min-w-0">
                    <h4 className={cn(
                      "font-medium truncate",
                      isCurrent && "text-primary",
                      isTVMode && "text-lg"
                    )}>
                      {episode.episodeTitle || episode.title || `Avsnitt ${episode.episodeNumber}`}
                    </h4>
                    
                    <div className="flex items-center gap-2 mt-1">
                      {episode.duration && (
                        <span className="text-xs text-muted-foreground">
                          {episode.duration} min
                        </span>
                      )}
                      
                      {/* Progress bar */}
                      {progress && !progress.completed && progress.progress > 0 && (
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-20">
                          <div 
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${progress.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            
            {(!currentSeason?.episodes || currentSeason.episodes.length === 0) && (
              <p className="text-center text-muted-foreground py-4">
                Inga avsnitt tillgängliga
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
