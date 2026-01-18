/**
 * Series Page - Browse TV series
 * Loads real series data from Xtream providers
 */
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tv, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { TVLayout } from '@/components/tv/TVLayout';
import { PaginatedVodGrid } from '@/components/vod/PaginatedVodGrid';
import { VodCategoryRow } from '@/components/vod/VodCategoryRow';
import { VodFilterBar } from '@/components/vod/VodFilterBar';
import { VodDetailModal } from '@/components/vod/VodDetailModal';
import { useVodStore } from '@/data/stores/vodStore';
import { useVodLoader } from '@/hooks/useVodLoader';
import { useTVMode } from '@/contexts/TVModeContext';
import { Series, VodItem, Episode } from '@/types/vod';
import { cn } from '@/lib/utils';

export default function SeriesPage() {
  const { isTVMode } = useTVMode();
  const navigate = useNavigate();
  const { isLoading: vodLoading, seriesCount } = useVodLoader();
  
  const { 
    series,
    currentFilter, 
    setFilter, 
    clearFilter, 
    toggleFavorite,
    getContinueWatching,
    getFilteredSeries,
  } = useVodStore();
  
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [viewMode, setViewMode] = useState<'categories' | 'grid'>('categories');
  
  // Get all genres from actual series
  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    series.forEach(s => s.genres.forEach(g => genres.add(g)));
    return Array.from(genres).sort();
  }, [series]);
  
  // Get filtered series
  const filteredSeries = useMemo(() => getFilteredSeries(), [series, currentFilter]);
  
  // Categories for browse view
  const categories = useMemo(() => {
    const cats = [];
    
    // Continue watching (episodes)
    const continueWatching = getContinueWatching().filter(i => i.type === 'episode');
    if (continueWatching.length > 0) {
      cats.push({
        id: 'continue',
        name: 'Fortsätt titta',
        type: 'continue_watching' as const,
        items: continueWatching,
      });
    }
    
    // Recently added
    const recentSeries = [...series]
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
      .slice(0, 20);
    if (recentSeries.length > 0) {
      cats.push({
        id: 'recent',
        name: 'Nyligen tillagda',
        type: 'recently_added' as const,
        items: recentSeries,
      });
    }
    
    // Top rated
    const topRated = [...series]
      .filter(s => s.rating && s.rating > 0)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 20);
    if (topRated.length > 0) {
      cats.push({
        id: 'top_rated',
        name: 'Högst betyg',
        type: 'collection' as const,
        items: topRated,
      });
    }
    
    // By genre (top 6 genres)
    allGenres.slice(0, 6).forEach(genre => {
      const genreSeries = series.filter(s => s.genres.includes(genre));
      if (genreSeries.length > 0) {
        cats.push({
          id: `genre-${genre}`,
          name: genre,
          type: 'genre' as const,
          items: genreSeries.slice(0, 20),
        });
      }
    });
    
    return cats;
  }, [series, allGenres, getContinueWatching]);
  
  const handleItemClick = useCallback((item: VodItem) => {
    setSelectedSeries(item as Series);
  }, []);
  
  const handlePlay = useCallback((item: VodItem | Episode) => {
    if (!item) {
      console.error('No item provided for playback');
      toast.error('Kunde inte spela upp - inget avsnitt valt');
      return;
    }
    
    if (!item.streamUrl) {
      console.error('No stream URL for episode:', item);
      toast.error('Kunde inte spela upp - ingen stream-URL hittades');
      return;
    }
    
    setSelectedSeries(null);
    // Navigate to VOD player with stream info
    const params = new URLSearchParams({
      type: 'episode',
      id: item.id,
      url: item.streamUrl,
      title: item.title || 'Avsnitt',
    });
    navigate(`/live?vod=true&${params.toString()}`);
  }, [navigate]);
  
  const handleFilterChange = useCallback((filter: Partial<typeof currentFilter>) => {
    setFilter(filter);
    if (Object.keys(filter).some(k => filter[k as keyof typeof filter])) {
      setViewMode('grid');
    }
  }, [setFilter]);
  
  const content = (
    <div className={cn(
      "flex flex-col h-full",
      isTVMode ? "p-6" : "p-4"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center gap-4 mb-6",
        isTVMode && "mb-8"
      )}>
        <Tv className={cn(
          "text-primary",
          isTVMode ? "w-10 h-10" : "w-8 h-8"
        )} />
        <h1 className={cn(
          "font-bold",
          isTVMode ? "text-4xl" : "text-2xl"
        )}>
          Serier
        </h1>
        {series.length > 0 && (
          <span className="text-muted-foreground text-sm">
            ({series.length} serier)
          </span>
        )}
      </div>
      
      {/* Loading state */}
      {vodLoading && series.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Laddar serier...</p>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {!vodLoading && series.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Tv className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Inga serier hittades</h2>
            <p className="text-muted-foreground max-w-md">
              Lägg till en Xtream Codes-provider för att få tillgång till filmer och serier.
            </p>
          </div>
        </div>
      )}
      
      {/* Content when we have series */}
      {series.length > 0 && (
        <>
          {/* Filter bar */}
          <VodFilterBar
            filter={currentFilter}
            availableGenres={allGenres}
            onFilterChange={handleFilterChange}
            onClearFilters={() => {
              clearFilter();
              setViewMode('categories');
            }}
            totalCount={filteredSeries.length}
            className="mb-6"
          />
          
          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {viewMode === 'categories' && !currentFilter.searchQuery ? (
              <div className="space-y-8 overflow-y-auto h-full pb-8">
                {categories.map(category => (
                  <VodCategoryRow
                    key={category.id}
                    category={category}
                    onItemClick={handleItemClick}
                    onItemPlay={handlePlay}
                    onItemInfo={handleItemClick}
                  />
                ))}
              </div>
            ) : (
              <PaginatedVodGrid
                items={filteredSeries}
                onItemClick={handleItemClick}
                onItemPlay={handlePlay}
                onItemInfo={handleItemClick}
                onToggleFavorite={(item) => toggleFavorite(item.id)}
              />
            )}
          </div>
        </>
      )}
      
      {/* Detail modal */}
      <VodDetailModal
        item={selectedSeries}
        open={!!selectedSeries}
        onClose={() => setSelectedSeries(null)}
        onPlay={handlePlay}
      />
    </div>
  );
  
  if (isTVMode) {
    return <TVLayout>{content}</TVLayout>;
  }
  
  return <AppLayout>{content}</AppLayout>;
}
