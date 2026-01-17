/**
 * VOD Card Component - Netflix-style poster card
 */
import { memo, useState } from 'react';
import { Play, Star, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VodItem, Movie, Series } from '@/types/vod';
import { useTVMode } from '@/contexts/TVModeContext';

interface VodCardProps {
  item: VodItem | Movie | Series;
  onClick?: () => void;
  onPlay?: () => void;
  onInfo?: () => void;
  onToggleFavorite?: () => void;
  showProgress?: boolean;
  className?: string;
}

export const VodCard = memo(function VodCard({
  item,
  onClick,
  onPlay,
  onInfo,
  onToggleFavorite,
  showProgress = true,
  className,
}: VodCardProps) {
  const { isTVMode } = useTVMode();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const progress = item.watchProgress?.progress || 0;
  const hasProgress = showProgress && progress > 0 && progress < 95;
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      onPlay?.();
    }
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      onInfo?.();
    }
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      onToggleFavorite?.();
    }
  };
  
  return (
    <div
      tabIndex={0}
      data-focusable
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative cursor-pointer transition-all duration-200",
        "focus:outline-none",
        isTVMode 
          ? "focus:ring-4 focus:ring-primary focus:scale-105 focus:z-10"
          : "focus:ring-2 focus:ring-primary hover:scale-105",
        className
      )}
    >
      {/* Poster Image */}
      <div className={cn(
        "relative aspect-[2/3] rounded-lg overflow-hidden bg-muted",
        isTVMode ? "rounded-xl" : "rounded-lg"
      )}>
        {/* Placeholder / Loading */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-b from-muted to-muted-foreground/20 animate-pulse" />
        )}
        
        {/* Error fallback - generated poster */}
        {(imageError || !item.posterUrl) && (
          <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-background flex flex-col items-center justify-center p-4">
            <div className={cn(
              "text-center font-bold line-clamp-3",
              isTVMode ? "text-lg" : "text-sm"
            )}>
              {item.title}
            </div>
            {item.year && (
              <div className="text-muted-foreground text-sm mt-2">
                {item.year}
              </div>
            )}
          </div>
        )}
        
        {/* Actual image */}
        {item.posterUrl && !imageError && (
          <img
            src={item.posterUrl}
            alt={item.title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-300",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        )}
        
        {/* Hover overlay */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent",
          "opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200",
          "flex flex-col justify-end p-3"
        )}>
          {/* Quick actions */}
          <div className="flex items-center gap-2 mb-2">
            {onPlay && (
              <button
                onClick={(e) => { e.stopPropagation(); onPlay(); }}
                className={cn(
                  "flex items-center justify-center rounded-full bg-primary text-primary-foreground",
                  "hover:bg-primary/90 transition-colors",
                  isTVMode ? "w-12 h-12" : "w-10 h-10"
                )}
              >
                <Play className={cn(isTVMode ? "w-6 h-6" : "w-5 h-5")} fill="currentColor" />
              </button>
            )}
            {onInfo && (
              <button
                onClick={(e) => { e.stopPropagation(); onInfo(); }}
                className={cn(
                  "flex items-center justify-center rounded-full bg-muted/80 text-foreground",
                  "hover:bg-muted transition-colors",
                  isTVMode ? "w-10 h-10" : "w-8 h-8"
                )}
              >
                <Info className={cn(isTVMode ? "w-5 h-5" : "w-4 h-4")} />
              </button>
            )}
          </div>
          
          {/* Title */}
          <h3 className={cn(
            "font-semibold text-white line-clamp-2",
            isTVMode ? "text-lg" : "text-sm"
          )}>
            {item.title}
          </h3>
          
          {/* Meta info */}
          <div className="flex items-center gap-2 text-white/70 text-xs mt-1">
            {item.year && <span>{item.year}</span>}
            {item.duration && (
              <>
                <span>•</span>
                <span>{item.duration} min</span>
              </>
            )}
            {item.type === 'series' && 'totalSeasons' in item && (
              <>
                <span>•</span>
                <span>{(item as Series).totalSeasons} säsonger</span>
              </>
            )}
          </div>
        </div>
        
        {/* Favorite badge */}
        {item.isFavorite && (
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50">
            <Star className="w-4 h-4 text-warning fill-warning" />
          </div>
        )}
        
        {/* HD badge */}
        {item.type === 'movie' && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-primary/90 text-primary-foreground text-xs font-bold">
            HD
          </div>
        )}
        
        {/* Progress bar */}
        {hasProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
      
      {/* Title below card (optional for larger cards) */}
      {isTVMode && (
        <div className="mt-2 px-1">
          <h3 className="font-medium text-base line-clamp-1">{item.title}</h3>
          <p className="text-sm text-muted-foreground">
            {item.year}{item.genres?.[0] && ` • ${item.genres[0]}`}
          </p>
        </div>
      )}
    </div>
  );
});
