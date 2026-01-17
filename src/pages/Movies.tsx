/**
 * Movies Page - Netflix-style movie browsing
 */
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TVLayout } from '@/components/tv/TVLayout';
import { VodGrid } from '@/components/vod/VodGrid';
import { VodCategoryRow } from '@/components/vod/VodCategoryRow';
import { VodFilterBar } from '@/components/vod/VodFilterBar';
import { VodDetailModal } from '@/components/vod/VodDetailModal';
import { useVodStore } from '@/data/stores/vodStore';
import { useTVMode } from '@/contexts/TVModeContext';
import { Movie, VodItem, Episode } from '@/types/vod';
import { cn } from '@/lib/utils';

// Demo movies data
const demoMovies: Movie[] = [
  {
    id: 'movie-1',
    providerId: 'demo',
    type: 'movie',
    title: 'The Matrix',
    originalTitle: 'The Matrix',
    year: 1999,
    genres: ['Action', 'Sci-Fi'],
    description: 'A computer hacker learns about the true nature of reality and his role in the war against its controllers.',
    posterUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&h=450&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&h=1080&fit=crop',
    duration: 136,
    rating: 8.7,
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    metadataSource: 'provider',
    subtitlesAvailable: true,
    audioLanguages: ['en', 'sv'],
    addedAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'movie-2',
    providerId: 'demo',
    type: 'movie',
    title: 'Inception',
    year: 2010,
    genres: ['Action', 'Sci-Fi', 'Thriller'],
    description: 'A thief who steals corporate secrets through dream-sharing technology is given the task of planting an idea.',
    posterUrl: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=300&h=450&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1920&h=1080&fit=crop',
    duration: 148,
    rating: 8.8,
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    metadataSource: 'provider',
    subtitlesAvailable: true,
    audioLanguages: ['en'],
    addedAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(),
  },
  {
    id: 'movie-3',
    providerId: 'demo',
    type: 'movie',
    title: 'Interstellar',
    year: 2014,
    genres: ['Adventure', 'Drama', 'Sci-Fi'],
    description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.',
    posterUrl: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=300&h=450&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&h=1080&fit=crop',
    duration: 169,
    rating: 8.6,
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    metadataSource: 'provider',
    subtitlesAvailable: false,
    audioLanguages: ['en'],
    addedAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(),
  },
  {
    id: 'movie-4',
    providerId: 'demo',
    type: 'movie',
    title: 'The Dark Knight',
    year: 2008,
    genres: ['Action', 'Crime', 'Drama'],
    description: 'When the Joker wreaks havoc on Gotham, Batman must accept one of the greatest psychological tests.',
    posterUrl: 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=300&h=450&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=1920&h=1080&fit=crop',
    duration: 152,
    rating: 9.0,
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    metadataSource: 'provider',
    subtitlesAvailable: true,
    audioLanguages: ['en', 'sv', 'de'],
    addedAt: new Date(Date.now() - 259200000),
    updatedAt: new Date(),
  },
  {
    id: 'movie-5',
    providerId: 'demo',
    type: 'movie',
    title: 'Pulp Fiction',
    year: 1994,
    genres: ['Crime', 'Drama'],
    description: 'The lives of two mob hitmen, a boxer, a gangster and his wife intertwine in four tales of violence.',
    posterUrl: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=300&h=450&fit=crop',
    duration: 154,
    rating: 8.9,
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    metadataSource: 'provider',
    subtitlesAvailable: true,
    audioLanguages: ['en'],
    addedAt: new Date(Date.now() - 345600000),
    updatedAt: new Date(),
  },
  {
    id: 'movie-6',
    providerId: 'demo',
    type: 'movie',
    title: 'Fight Club',
    year: 1999,
    genres: ['Drama'],
    description: 'An insomniac office worker and a devil-may-care soap maker form an underground fight club.',
    posterUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=300&h=450&fit=crop',
    duration: 139,
    rating: 8.8,
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    metadataSource: 'provider',
    subtitlesAvailable: false,
    audioLanguages: ['en'],
    addedAt: new Date(Date.now() - 432000000),
    updatedAt: new Date(),
  },
];

export default function MoviesPage() {
  const { isTVMode } = useTVMode();
  const navigate = useNavigate();
  const { 
    currentFilter, 
    setFilter, 
    clearFilter, 
    toggleFavorite,
    getContinueWatching,
    getFavorites,
  } = useVodStore();
  
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [viewMode, setViewMode] = useState<'categories' | 'grid'>('categories');
  
  // Use demo movies (in real app, this would come from store/API)
  const movies = demoMovies;
  
  // Get all genres
  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    movies.forEach(m => m.genres.forEach(g => genres.add(g)));
    return Array.from(genres).sort();
  }, [movies]);
  
  // Filter movies
  const filteredMovies = useMemo(() => {
    let filtered = [...movies];
    
    if (currentFilter.searchQuery) {
      const query = currentFilter.searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.title.toLowerCase().includes(query) ||
        m.originalTitle?.toLowerCase().includes(query)
      );
    }
    
    if (currentFilter.genres?.length) {
      filtered = filtered.filter(m => 
        m.genres.some(g => currentFilter.genres!.includes(g))
      );
    }
    
    if (currentFilter.favoritesOnly) {
      filtered = filtered.filter(m => m.isFavorite);
    }
    
    // Sort
    const { sortBy = 'addedAt', sortOrder = 'desc' } = currentFilter;
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'year':
          comparison = (a.year || 0) - (b.year || 0);
          break;
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0);
          break;
        case 'addedAt':
          comparison = a.addedAt.getTime() - b.addedAt.getTime();
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return filtered;
  }, [movies, currentFilter]);
  
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
    cats.push({
      id: 'recent',
      name: 'Nyligen tillagda',
      type: 'recently_added' as const,
      items: [...movies].sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()).slice(0, 10),
    });
    
    // Top rated
    cats.push({
      id: 'top_rated',
      name: 'Högst betyg',
      type: 'collection' as const,
      items: [...movies].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10),
    });
    
    // By genre
    allGenres.slice(0, 4).forEach(genre => {
      const genreMovies = movies.filter(m => m.genres.includes(genre));
      if (genreMovies.length > 0) {
        cats.push({
          id: `genre-${genre}`,
          name: genre,
          type: 'genre' as const,
          items: genreMovies,
        });
      }
    });
    
    return cats;
  }, [movies, allGenres, getContinueWatching]);
  
  const handleItemClick = useCallback((item: VodItem) => {
    setSelectedMovie(item as Movie);
  }, []);
  
  const handlePlay = useCallback((item: VodItem | Episode) => {
    setSelectedMovie(null);
    navigate(`/player?type=movie&id=${item.id}`);
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
      </div>
      
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
          // Category rows view
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
          // Grid view (filtered)
          <VodGrid
            items={filteredMovies}
            onItemClick={handleItemClick}
            onItemPlay={handlePlay}
            onItemInfo={handleItemClick}
            onToggleFavorite={(item) => toggleFavorite(item.id)}
          />
        )}
      </div>
      
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
