/**
 * UpNextOverlay - Auto-next episode countdown overlay
 */

import { useState, useEffect } from 'react';
import { Play, X, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Episode } from '@/types/vod';
import { useTVMode } from '@/contexts/TVModeContext';

interface UpNextOverlayProps {
  episode: Episode;
  countdown: number; // Starting countdown in seconds
  onPlayNext: () => void;
  onCancel: () => void;
  onShowEpisodeList?: () => void;
}

export function UpNextOverlay({
  episode,
  countdown: initialCountdown,
  onPlayNext,
  onCancel,
  onShowEpisodeList,
}: UpNextOverlayProps) {
  const { isTVMode } = useTVMode();
  const [countdown, setCountdown] = useState(initialCountdown);
  
  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      onPlayNext();
      return;
    }
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [countdown, onPlayNext]);
  
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={cn(
        "bg-background rounded-xl shadow-2xl overflow-hidden",
        isTVMode ? "w-[600px]" : "w-[400px]"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className={cn(
            "font-semibold",
            isTVMode ? "text-xl" : "text-lg"
          )}>
            Nästa avsnitt
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Episode info */}
        <div className="p-4">
          <div className="flex gap-4">
            {/* Poster/thumbnail */}
            <div className={cn(
              "flex-shrink-0 rounded-lg overflow-hidden bg-muted",
              isTVMode ? "w-40 h-24" : "w-32 h-20"
            )}>
              {episode.posterUrl ? (
                <img
                  src={episode.posterUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">
                S{episode.seasonNumber}:E{episode.episodeNumber}
              </p>
              <h3 className={cn(
                "font-semibold truncate",
                isTVMode ? "text-xl" : "text-lg"
              )}>
                {episode.episodeTitle || episode.title || `Avsnitt ${episode.episodeNumber}`}
              </h3>
              {episode.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {episode.description}
                </p>
              )}
            </div>
          </div>
          
          {/* Countdown progress */}
          <div className="mt-4">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-1000"
                style={{ width: `${(countdown / initialCountdown) * 100}%` }}
              />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-2">
              Spelar om {countdown} sekunder
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="p-4 border-t border-border flex items-center gap-3">
          <Button
            onClick={onPlayNext}
            className={cn("flex-1 gap-2", isTVMode && "h-12 text-lg")}
          >
            <Play className="w-5 h-5" fill="currentColor" />
            Spela nu
          </Button>
          
          <Button
            variant="outline"
            onClick={onCancel}
            className={isTVMode ? "h-12 text-lg" : ""}
          >
            Avbryt
          </Button>
          
          {onShowEpisodeList && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowEpisodeList}
              className={isTVMode ? "w-12 h-12" : ""}
            >
              <List className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
