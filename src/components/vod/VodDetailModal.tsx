/**
 * VOD Detail Modal - Movie/Series detail view
 */
import { useState, useEffect } from 'react';
import { 
  Play, 
  Star, 
  Clock, 
  Calendar, 
  Subtitles, 
  ChevronDown,
  Plus,
  Check,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VodItem, Movie, Series, Season, Episode, Subtitle } from '@/types/vod';
import { useTVMode } from '@/contexts/TVModeContext';
import { useVodStore } from '@/data/stores/vodStore';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface VodDetailModalProps {
  item: VodItem | Movie | Series | null;
  open: boolean;
  onClose: () => void;
  onPlay: (item: VodItem | Episode) => void;
  onGenerateSubtitle?: (item: VodItem | Episode) => void;
}

export function VodDetailModal({
  item,
  open,
  onClose,
  onPlay,
  onGenerateSubtitle,
}: VodDetailModalProps) {
  const { isTVMode } = useTVMode();
  const { canAccessFeature } = useEntitlements();
  const { toggleFavorite, getSubtitles, getWatchProgress } = useVodStore();
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const isSeries = item?.type === 'series';
  const series = isSeries ? (item as Series) : null;
  const movie = !isSeries ? (item as Movie) : null;
  const subtitles = item ? getSubtitles(item.id) : [];
  const progress = item ? getWatchProgress(item.id) : null;
  
  const canGenerateSubtitles = canAccessFeature('ai_subtitles');
  
  useEffect(() => {
    setImageLoaded(false);
  }, [item?.id]);
  
  if (!item) return null;
  
  const currentSeason = series?.seasons.find(s => s.seasonNumber === selectedSeason);
  
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(
        "max-w-4xl p-0 overflow-hidden",
        isTVMode && "max-w-6xl"
      )}>
        <DialogTitle className="sr-only">{item.title}</DialogTitle>
        
        {/* Backdrop */}
        <div className="relative h-64 sm:h-80 overflow-hidden">
          {item.backdropUrl ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-muted animate-pulse" />
              )}
              <img
                src={item.backdropUrl}
                alt=""
                onLoad={() => setImageLoaded(true)}
                className={cn(
                  "w-full h-full object-cover transition-opacity",
                  imageLoaded ? "opacity-100" : "opacity-0"
                )}
              />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-primary/20 to-background" />
          )}
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          
          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-end gap-6">
              {/* Poster */}
              <div className="hidden sm:block w-32 h-48 rounded-lg overflow-hidden shadow-2xl flex-shrink-0">
                {item.posterUrl ? (
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <span className="text-xs text-center p-2">{item.title}</span>
                  </div>
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h2 className={cn(
                  "font-bold text-foreground",
                  isTVMode ? "text-4xl" : "text-2xl sm:text-3xl"
                )}>
                  {item.title}
                </h2>
                
                <div className="flex flex-wrap items-center gap-3 mt-2 text-muted-foreground">
                  {item.year && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {item.year}
                    </span>
                  )}
                  {item.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {item.duration} min
                    </span>
                  )}
                  {item.rating && (
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-warning" />
                      {item.rating.toFixed(1)}
                    </span>
                  )}
                  {series && (
                    <span>{series.totalSeasons} säsonger • {series.totalEpisodes} avsnitt</span>
                  )}
                </div>
                
                {/* Genres */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {item.genres.slice(0, 4).map(genre => (
                    <Badge key={genre} variant="secondary">
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions & Content */}
        <div className="p-6 space-y-6">
          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size={isTVMode ? "lg" : "default"}
              onClick={() => onPlay(movie || (currentSeason?.episodes[0] as Episode))}
              className="gap-2"
            >
              <Play className="w-5 h-5" fill="currentColor" />
              {progress && !progress.completed ? 'Fortsätt titta' : 'Spela'}
            </Button>
            
            <Button
              variant="outline"
              size={isTVMode ? "lg" : "default"}
              onClick={() => toggleFavorite(item.id)}
              className="gap-2"
            >
              {item.isFavorite ? (
                <>
                  <Check className="w-5 h-5" />
                  I min lista
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Min lista
                </>
              )}
            </Button>
            
            {/* Subtitle options */}
            {subtitles.length > 0 ? (
              <Button
                variant="ghost"
                size={isTVMode ? "lg" : "default"}
                className="gap-2"
              >
                <Subtitles className="w-5 h-5" />
                {subtitles.length} undertext{subtitles.length > 1 ? 'er' : ''}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size={isTVMode ? "lg" : "default"}
                onClick={() => onGenerateSubtitle?.(item)}
                disabled={!canGenerateSubtitles}
                className="gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Skapa undertext
                {!canGenerateSubtitles && (
                  <Badge variant="secondary" className="ml-1">Premium</Badge>
                )}
              </Button>
            )}
          </div>
          
          {/* Progress bar if watching */}
          {progress && !progress.completed && (
            <div className="space-y-1">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.floor(progress.currentTime / 60)} min av {Math.floor(progress.duration / 60)} min
              </p>
            </div>
          )}
          
          {/* Description */}
          {item.description && (
            <p className={cn(
              "text-muted-foreground leading-relaxed",
              isTVMode ? "text-lg" : "text-sm sm:text-base"
            )}>
              {item.description}
            </p>
          )}
          
          {/* Series: Season/Episode selector */}
          {series && series.seasons.length > 0 && (
            <div className="space-y-4">
              <Tabs
                value={String(selectedSeason)}
                onValueChange={(v) => setSelectedSeason(Number(v))}
              >
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
                
                {series.seasons.map(season => (
                  <TabsContent
                    key={season.seasonNumber}
                    value={String(season.seasonNumber)}
                    className="mt-4"
                  >
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {season.episodes.map(episode => {
                          const epProgress = getWatchProgress(episode.id);
                          
                          return (
                            <button
                              key={episode.id}
                              onClick={() => onPlay(episode)}
                              className={cn(
                                "w-full flex items-center gap-4 p-3 rounded-lg transition-colors",
                                "hover:bg-muted focus:bg-muted focus:outline-none",
                                "text-left"
                              )}
                            >
                              <div className="w-8 text-center text-muted-foreground font-medium">
                                {episode.episodeNumber}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">
                                  {episode.episodeTitle || episode.title}
                                </h4>
                                {episode.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">
                                    {episode.description}
                                  </p>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-3 text-muted-foreground text-sm">
                                {episode.duration && (
                                  <span>{episode.duration} min</span>
                                )}
                                {epProgress && !epProgress.completed && (
                                  <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary rounded-full"
                                      style={{ width: `${epProgress.progress}%` }}
                                    />
                                  </div>
                                )}
                                <Play className="w-5 h-5" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
          
          {/* AI Subtitle disclaimer */}
          {subtitles.some(s => s.aiGenerated) && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                AI-genererad undertext – kan innehålla fel. Undertexten skapades automatiskt 
                från ljudspåret i din egen videoström.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
