/**
 * Series Page - Browse TV series
 */
import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tv } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TVLayout } from '@/components/tv/TVLayout';
import { VodGrid } from '@/components/vod/VodGrid';
import { VodCategoryRow } from '@/components/vod/VodCategoryRow';
import { VodFilterBar } from '@/components/vod/VodFilterBar';
import { VodDetailModal } from '@/components/vod/VodDetailModal';
import { useVodStore } from '@/data/stores/vodStore';
import { useTVMode } from '@/contexts/TVModeContext';
import { Series, VodItem, Episode } from '@/types/vod';
import { cn } from '@/lib/utils';

// Demo series data
const demoSeries: Series[] = [
  {
    id: 'series-1',
    providerId: 'demo',
    type: 'series',
    title: 'Breaking Bad',
    year: 2008,
    genres: ['Crime', 'Drama', 'Thriller'],
    description: 'A high school chemistry teacher diagnosed with terminal lung cancer turns to manufacturing methamphetamine.',
    posterUrl: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=300&h=450&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=1920&h=1080&fit=crop',
    rating: 9.5,
    metadataSource: 'provider',
    subtitlesAvailable: true,
    audioLanguages: ['en', 'sv'],
    addedAt: new Date(),
    updatedAt: new Date(),
    totalSeasons: 5,
    totalEpisodes: 62,
    seasons: [
      {
        id: 'season-1-1',
        seriesId: 'series-1',
        seasonNumber: 1,
        title: 'Säsong 1',
        episodeCount: 7,
        episodes: Array.from({ length: 7 }, (_, i) => ({
          id: `episode-1-1-${i + 1}`,
          providerId: 'demo',
          type: 'episode' as const,
          title: `Breaking Bad S01E0${i + 1}`,
          episodeTitle: ['Pilot', 'Cat\'s in the Bag...', '...And the Bag\'s in the River', 'Cancer Man', 'Gray Matter', 'Crazy Handful of Nothin\'', 'A No-Rough-Stuff-Type Deal'][i],
          seriesId: 'series-1',
          seasonNumber: 1,
          episodeNumber: i + 1,
          duration: 58,
          streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          genres: ['Crime', 'Drama'],
          metadataSource: 'provider' as const,
          subtitlesAvailable: true,
          audioLanguages: ['en'],
          addedAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      {
        id: 'season-1-2',
        seriesId: 'series-1',
        seasonNumber: 2,
        title: 'Säsong 2',
        episodeCount: 13,
        episodes: Array.from({ length: 13 }, (_, i) => ({
          id: `episode-1-2-${i + 1}`,
          providerId: 'demo',
          type: 'episode' as const,
          title: `Breaking Bad S02E${String(i + 1).padStart(2, '0')}`,
          episodeTitle: `Avsnitt ${i + 1}`,
          seriesId: 'series-1',
          seasonNumber: 2,
          episodeNumber: i + 1,
          duration: 47,
          streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          genres: ['Crime', 'Drama'],
          metadataSource: 'provider' as const,
          subtitlesAvailable: true,
          audioLanguages: ['en'],
          addedAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    ],
  },
  {
    id: 'series-2',
    providerId: 'demo',
    type: 'series',
    title: 'Game of Thrones',
    year: 2011,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy'],
    description: 'Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns.',
    posterUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=450&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920&h=1080&fit=crop',
    rating: 9.2,
    metadataSource: 'provider',
    subtitlesAvailable: true,
    audioLanguages: ['en'],
    addedAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(),
    totalSeasons: 8,
    totalEpisodes: 73,
    seasons: [
      {
        id: 'season-2-1',
        seriesId: 'series-2',
        seasonNumber: 1,
        title: 'Säsong 1',
        episodeCount: 10,
        episodes: Array.from({ length: 10 }, (_, i) => ({
          id: `episode-2-1-${i + 1}`,
          providerId: 'demo',
          type: 'episode' as const,
          title: `Game of Thrones S01E${String(i + 1).padStart(2, '0')}`,
          episodeTitle: `Avsnitt ${i + 1}`,
          seriesId: 'series-2',
          seasonNumber: 1,
          episodeNumber: i + 1,
          duration: 60,
          streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          genres: ['Fantasy', 'Drama'],
          metadataSource: 'provider' as const,
          subtitlesAvailable: true,
          audioLanguages: ['en'],
          addedAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    ],
  },
  {
    id: 'series-3',
    providerId: 'demo',
    type: 'series',
    title: 'Stranger Things',
    year: 2016,
    genres: ['Drama', 'Fantasy', 'Horror'],
    description: 'When a young boy disappears, his mother and friends must confront terrifying supernatural forces.',
    posterUrl: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=300&h=450&fit=crop',
    backdropUrl: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=1920&h=1080&fit=crop',
    rating: 8.7,
    metadataSource: 'provider',
    subtitlesAvailable: true,
    audioLanguages: ['en', 'sv'],
    addedAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(),
    totalSeasons: 4,
    totalEpisodes: 34,
    seasons: [
      {
        id: 'season-3-1',
        seriesId: 'series-3',
        seasonNumber: 1,
        title: 'Säsong 1',
        episodeCount: 8,
        episodes: Array.from({ length: 8 }, (_, i) => ({
          id: `episode-3-1-${i + 1}`,
          providerId: 'demo',
          type: 'episode' as const,
          title: `Stranger Things S01E0${i + 1}`,
          episodeTitle: `Avsnitt ${i + 1}`,
          seriesId: 'series-3',
          seasonNumber: 1,
          episodeNumber: i + 1,
          duration: 50,
          streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          genres: ['Horror', 'Sci-Fi'],
          metadataSource: 'provider' as const,
          subtitlesAvailable: true,
          audioLanguages: ['en'],
          addedAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    ],
  },
  {
    id: 'series-4',
    providerId: 'demo',
    type: 'series',
    title: 'The Office',
    year: 2005,
    genres: ['Comedy'],
    description: 'A mockumentary on a group of typical office workers, where the workday consists of ego clashes.',
    posterUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=300&h=450&fit=crop',
    rating: 8.9,
    metadataSource: 'provider',
    subtitlesAvailable: false,
    audioLanguages: ['en'],
    addedAt: new Date(Date.now() - 259200000),
    updatedAt: new Date(),
    totalSeasons: 9,
    totalEpisodes: 201,
    seasons: [],
  },
];

export default function SeriesPage() {
  const { isTVMode } = useTVMode();
  const navigate = useNavigate();
  const { 
    currentFilter, 
    setFilter, 
    clearFilter, 
    toggleFavorite,
    getContinueWatching,
  } = useVodStore();
  
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [viewMode, setViewMode] = useState<'categories' | 'grid'>('categories');
  
  // Use demo series (in real app, this would come from store/API)
  const series = demoSeries;
  
  // Get all genres
  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    series.forEach(s => s.genres.forEach(g => genres.add(g)));
    return Array.from(genres).sort();
  }, [series]);
  
  // Filter series
  const filteredSeries = useMemo(() => {
    let filtered = [...series];
    
    if (currentFilter.searchQuery) {
      const query = currentFilter.searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(query) ||
        s.originalTitle?.toLowerCase().includes(query)
      );
    }
    
    if (currentFilter.genres?.length) {
      filtered = filtered.filter(s => 
        s.genres.some(g => currentFilter.genres!.includes(g))
      );
    }
    
    if (currentFilter.favoritesOnly) {
      filtered = filtered.filter(s => s.isFavorite);
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
  }, [series, currentFilter]);
  
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
    cats.push({
      id: 'recent',
      name: 'Nyligen tillagda',
      type: 'recently_added' as const,
      items: [...series].sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()).slice(0, 10),
    });
    
    // Top rated
    cats.push({
      id: 'top_rated',
      name: 'Högst betyg',
      type: 'collection' as const,
      items: [...series].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10),
    });
    
    // By genre
    allGenres.slice(0, 4).forEach(genre => {
      const genreSeries = series.filter(s => s.genres.includes(genre));
      if (genreSeries.length > 0) {
        cats.push({
          id: `genre-${genre}`,
          name: genre,
          type: 'genre' as const,
          items: genreSeries,
        });
      }
    });
    
    return cats;
  }, [series, allGenres, getContinueWatching]);
  
  const handleItemClick = useCallback((item: VodItem) => {
    setSelectedSeries(item as Series);
  }, []);
  
  const handlePlay = useCallback((item: VodItem | Episode) => {
    setSelectedSeries(null);
    navigate(`/player?type=episode&id=${item.id}`);
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
        totalCount={filteredSeries.length}
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
            items={filteredSeries}
            onItemClick={handleItemClick}
            onItemPlay={handlePlay}
            onItemInfo={handleItemClick}
            onToggleFavorite={(item) => toggleFavorite(item.id)}
          />
        )}
      </div>
      
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
