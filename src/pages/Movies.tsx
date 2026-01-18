/**
 * Movies Page - Netflix-style movie browsing
 * Loads real VOD data from Xtream providers
 */
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Loader2 } from 'lucide-react';
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
import { Movie, VodItem, Episode } from '@/types/vod';
import { cn } from '@/lib/utils';

export default function MoviesPage() {
  const { isTVMode } = useTVMode();
  const navigate = useNavigate();
  const { isLoading: vodLoading, movieCount } = useVodLoader();
  
  const { 
    movies,
    currentFilter, 
    setFilter, 
    clearFilter, 
    toggleFavorite,
    getContinueWatching,
    getFilteredMovies,
    getAllGenres,
  } = useVodStore();
  
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [viewMode, setViewMode] = useState<'categories' | 'grid'>('categories');
  
  // Get all genres from actual movies
  const allGenres = useMemo(() => getAllGenres(), [movies]);
  
  // Get filtered movies
  const filteredMovies = useMemo(() => getFilteredMovies(), [movies, currentFilter]);
  
  // Categories for browse view
  const categories = useMemo(() => {
    const cats = [];
    
    // Continue watching
    const continueWatching = getContinueWatching().filter(i => i.type === 'movie');
    if (continueWatching.length > 0) {
      cats.push({
        id: 'continue',
        name: 'Fortsätt titta',
        type: 'continue_watching' as const,
        items: continueWatching,
      });
    }
    
    // Recently added
    const recentMovies = [...movies]
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
      .slice(0, 20);
    if (recentMovies.length > 0) {
      cats.push({
        id: 'recent',
        name: 'Nyligen tillagda',
        type: 'recently_added' as const,
        items: recentMovies,
      });
    }
    
    // Top rated
    const topRated = [...movies]
      .filter(m => m.rating && m.rating > 0)
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
      const genreMovies = movies.filter(m => m.genres.includes(genre));
      if (genreMovies.length > 0) {
        cats.push({
          id: `genre-${genre}`,
          name: genre,
          type: 'genre' as const,
          items: genreMovies.slice(0, 20),
        });
      }
    });
    
    return cats;
  }, [movies, allGenres, getContinueWatching]);
  
  const handleItemClick = useCallback((item: VodItem) => {
    setSelectedMovie(item as Movie);
  }, []);
  
  const handlePlay = useCallback((item: VodItem | Episode) => {
    if (!item) {
      console.error('No item provided for playback');
      toast.error('Kunde inte spela upp - ingen film vald');
      return;
    }
    
    if (!item.streamUrl) {
      console.error('No stream URL for item:', item);
      toast.error('Kunde inte spela upp - ingen stream-URL hittades');
      return;
    }
    
    setSelectedMovie(null);
    // Navigate to VOD player with stream info
    const params = new URLSearchParams({
      type: 'movie',
      id: item.id,
      url: item.streamUrl,
      title: item.title || 'Film',
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
        <Film className={cn(
          "text-primary",
          isTVMode ? "w-10 h-10" : "w-8 h-8"
        )} />
        <h1 className={cn(
          "font-bold",
          isTVMode ? "text-4xl" : "text-2xl"
        )}>
          Filmer
        </h1>
        {movies.length > 0 && (
          <span className="text-muted-foreground text-sm">
            ({movies.length} filmer)
          </span>
        )}
      </div>
      
      {/* Loading state */}
      {vodLoading && movies.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Laddar filmer...</p>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {!vodLoading && movies.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Film className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Inga filmer hittades</h2>
            <p className="text-muted-foreground max-w-md">
              Lägg till en Xtream Codes-provider för att få tillgång till filmer och serier.
            </p>
          </div>
        </div>
      )}
      
      {/* Content when we have movies */}
      {movies.length > 0 && (
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
            totalCount={filteredMovies.length}
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
                items={filteredMovies}
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
        item={selectedMovie}
        open={!!selectedMovie}
        onClose={() => setSelectedMovie(null)}
        onPlay={handlePlay}
      />
    </div>
  );
  
  if (isTVMode) {
    return <TVLayout>{content}</TVLayout>;
  }
  
  return <AppLayout>{content}</AppLayout>;
}
