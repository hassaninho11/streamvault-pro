/**
 * Series Detail Page - Shows seasons and episodes for a series
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  Star, 
  Calendar,
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { TVLayout } from '@/components/tv/TVLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useVodStore } from '@/data/stores/vodStore';
import { useLocalProviders } from '@/hooks/useLocalProviders';
import { useTVMode } from '@/contexts/TVModeContext';
import { VodService } from '@/services/VodService';
import { Series, Episode, Season } from '@/types/vod';
import { cn } from '@/lib/utils';

export default function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isTVMode } = useTVMode();
  
  const { series, addSeries, getWatchProgress, toggleFavorite } = useVodStore();
  const { providers, getDecryptedXtreamCredentials } = useLocalProviders();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadedSeries, setLoadedSeries] = useState<Series | null>(null);
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(new Set([1]));
  
  // Find series from store
  const baseSeries = useMemo(() => {
    return series.find(s => s.id === id) || null;
  }, [series, id]);
  
  // Use loaded series with episodes if available
  const currentSeries = loadedSeries?.id === id ? loadedSeries : baseSeries;
  
  // Load series episodes
  useEffect(() => {
    if (!baseSeries) return;
    
    // If series already has seasons loaded, use it
    if (baseSeries.seasons && baseSeries.seasons.length > 0 && 
        baseSeries.seasons.some(s => s.episodes && s.episodes.length > 0)) {
      setLoadedSeries(baseSeries);
      return;
    }
    
    // Find the provider to get credentials for API call
    const provider = providers.find(p => p.id === baseSeries.providerId);
    if (!provider || provider.type !== 'xtream') {
      console.log('[SeriesDetail] Cannot load episodes - no valid xtream provider');
      return;
    }
    
    setIsLoading(true);
    
    getDecryptedXtreamCredentials(baseSeries.providerId).then(creds => {
      if (!creds) {
        console.error('[SeriesDetail] Could not decrypt credentials');
        setIsLoading(false);
        return;
      }
      
      return VodService.loadSeriesInfo(
        baseSeries.id,
        creds.host,
        creds.user,
        creds.pass
      );
    }).then(fullSeries => {
      if (fullSeries) {
        setLoadedSeries(fullSeries);
        addSeries([fullSeries]);
        // Open first season by default
        if (fullSeries.seasons.length > 0) {
          setOpenSeasons(new Set([fullSeries.seasons[0].seasonNumber]));
        }
      }
    }).catch(err => {
      console.error('[SeriesDetail] Failed to load series info:', err);
      toast.error('Kunde inte ladda avsnitt');
    }).finally(() => {
      setIsLoading(false);
    });
  }, [baseSeries?.id, providers, addSeries, getDecryptedXtreamCredentials]);
  
  const handleBack = () => {
    navigate('/series');
  };
  
  const handlePlayEpisode = (episode: Episode) => {
    if (!episode.streamUrl) {
      toast.error('Ingen stream-URL hittades för detta avsnitt');
      return;
    }
    
    const params = new URLSearchParams({
      type: 'episode',
      id: episode.id,
      url: episode.streamUrl,
      title: episode.title || `S${episode.seasonNumber}E${episode.episodeNumber}`,
    });
    navigate(`/live?vod=true&${params.toString()}`);
  };
  
  const toggleSeason = (seasonNumber: number) => {
    setOpenSeasons(prev => {
      const next = new Set(prev);
      if (next.has(seasonNumber)) {
        next.delete(seasonNumber);
      } else {
        next.add(seasonNumber);
      }
      return next;
    });
  };
  
  // Loading state
  if (!currentSeries) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }
  
  const content = (
    <div className="flex flex-col h-full">
      {/* Hero Section */}
      <div className="relative">
        {/* Backdrop */}
        <div className="h-64 sm:h-80 relative overflow-hidden">
          {currentSeries.backdropUrl ? (
            <img
              src={currentSeries.backdropUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-primary/20 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>
        
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-background/50 backdrop-blur-sm"
          onClick={handleBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        {/* Series Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-end gap-6">
            {/* Poster */}
            <div className="hidden sm:block w-32 h-48 rounded-lg overflow-hidden shadow-2xl flex-shrink-0">
              {currentSeries.posterUrl ? (
                <img
                  src={currentSeries.posterUrl}
                  alt={currentSeries.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="text-xs text-center p-2">{currentSeries.title}</span>
                </div>
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className={cn(
                "font-bold text-foreground",
                isTVMode ? "text-4xl" : "text-2xl sm:text-3xl"
              )}>
                {currentSeries.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-3 mt-2 text-muted-foreground">
                {currentSeries.year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {currentSeries.year}
                  </span>
                )}
                {currentSeries.rating && (
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    {currentSeries.rating.toFixed(1)}
                  </span>
                )}
                <span>
                  {currentSeries.totalSeasons || currentSeries.seasons?.length || 0} säsonger
                </span>
                <span>
                  {currentSeries.totalEpisodes || 
                    currentSeries.seasons?.reduce((sum, s) => sum + (s.episodes?.length || 0), 0) || 0} avsnitt
                </span>
              </div>
              
              {/* Genres */}
              <div className="flex flex-wrap gap-2 mt-3">
                {currentSeries.genres.slice(0, 4).map(genre => (
                  <Badge key={genre} variant="secondary">
                    {genre}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="p-6 flex items-center gap-3 border-b border-border">
        <Button
          variant="outline"
          onClick={() => toggleFavorite(currentSeries.id)}
          className="gap-2"
        >
          {currentSeries.isFavorite ? (
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
      </div>
      
      {/* Description */}
      {currentSeries.description && (
        <div className="px-6 py-4 border-b border-border">
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            {currentSeries.description}
          </p>
        </div>
      )}
      
      {/* Seasons & Episodes */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Laddar avsnitt...</span>
          </div>
        ) : currentSeries.seasons && currentSeries.seasons.length > 0 ? (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              {currentSeries.seasons.map(season => (
                <SeasonSection
                  key={season.seasonNumber}
                  season={season}
                  isOpen={openSeasons.has(season.seasonNumber)}
                  onToggle={() => toggleSeason(season.seasonNumber)}
                  onPlayEpisode={handlePlayEpisode}
                  getWatchProgress={getWatchProgress}
                  isTVMode={isTVMode}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p>Inga säsonger tillgängliga för denna serie.</p>
          </div>
        )}
      </div>
    </div>
  );
  
  if (isTVMode) {
    return <TVLayout>{content}</TVLayout>;
  }
  
  return <AppLayout>{content}</AppLayout>;
}

// Season Section Component
interface SeasonSectionProps {
  season: Season;
  isOpen: boolean;
  onToggle: () => void;
  onPlayEpisode: (episode: Episode) => void;
  getWatchProgress: (id: string) => any;
  isTVMode: boolean;
}

function SeasonSection({ 
  season, 
  isOpen, 
  onToggle, 
  onPlayEpisode,
  getWatchProgress,
  isTVMode 
}: SeasonSectionProps) {
  const episodeCount = season.episodes?.length || season.episodeCount || 0;
  
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className={cn(
        "w-full flex items-center justify-between p-4 rounded-lg",
        "bg-muted/50 hover:bg-muted transition-colors",
        isTVMode && "p-6"
      )}>
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
          <span className={cn(
            "font-semibold",
            isTVMode ? "text-xl" : "text-lg"
          )}>
            {season.title || `Säsong ${season.seasonNumber}`}
          </span>
        </div>
        <span className="text-muted-foreground text-sm">
          {episodeCount} avsnitt
        </span>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="mt-2 space-y-1 pl-4">
          {season.episodes && season.episodes.length > 0 ? (
            season.episodes.map(episode => {
              const progress = getWatchProgress(episode.id);
              
              return (
                <button
                  key={episode.id}
                  onClick={() => onPlayEpisode(episode)}
                  className={cn(
                    "w-full flex items-center gap-4 p-3 rounded-lg transition-colors",
                    "hover:bg-muted focus:bg-muted focus:outline-none",
                    "text-left",
                    isTVMode && "p-4"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10",
                    "text-primary font-semibold",
                    isTVMode && "w-12 h-12"
                  )}>
                    {episode.episodeNumber}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className={cn(
                      "font-medium truncate",
                      isTVMode && "text-lg"
                    )}>
                      {episode.episodeTitle || episode.title || `Avsnitt ${episode.episodeNumber}`}
                    </h4>
                    {episode.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {episode.description}
                      </p>
                    )}
                    {/* Progress bar */}
                    {progress && !progress.completed && progress.progress > 0 && (
                      <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden w-32">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${progress.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {episode.duration && (
                      <span className="text-sm">{episode.duration} min</span>
                    )}
                    <Play className={cn(
                      "w-5 h-5",
                      isTVMode && "w-6 h-6"
                    )} />
                  </div>
                </button>
              );
            })
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Inga avsnitt tillgängliga
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
