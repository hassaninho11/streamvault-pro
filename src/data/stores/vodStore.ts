/**
 * VOD Store - State management for Movies & Series
 * Respects category visibility settings for performance
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  VodItem, 
  Movie, 
  Series, 
  Episode, 
  WatchProgress, 
  VodFilter, 
  VodCategory,
  Subtitle,
  VodPlayerSettings
} from '@/types/vod';
import { useCategoryVisibilityStore, createCategoryId } from './categoryVisibilityStore';

interface VodState {
  // Data
  movies: Movie[];
  series: Series[];
  watchProgress: Map<string, WatchProgress>;
  subtitles: Map<string, Subtitle[]>;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  selectedItem: VodItem | null;
  currentFilter: VodFilter;
  
  // Player settings
  playerSettings: VodPlayerSettings;
  
  // Actions
  setMovies: (movies: Movie[]) => void;
  setSeries: (series: Series[]) => void;
  addMovies: (movies: Movie[]) => void;
  addSeries: (series: Series[]) => void;
  
  updateWatchProgress: (progress: WatchProgress) => void;
  getWatchProgress: (itemId: string) => WatchProgress | undefined;
  getContinueWatching: () => VodItem[];
  
  toggleFavorite: (itemId: string) => void;
  getFavorites: (type?: 'movie' | 'series') => VodItem[];
  
  addSubtitle: (subtitle: Subtitle) => void;
  getSubtitles: (vodItemId: string) => Subtitle[];
  
  setFilter: (filter: Partial<VodFilter>) => void;
  clearFilter: () => void;
  
  setSelectedItem: (item: VodItem | null) => void;
  setPlayerSettings: (settings: Partial<VodPlayerSettings>) => void;
  
  getFilteredMovies: () => Movie[];
  getFilteredSeries: () => Series[];
  getCategories: () => VodCategory[];
  getAllGenres: () => string[];
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

const defaultPlayerSettings: VodPlayerSettings = {
  autoPlayNext: true,
  skipIntro: true,
  subtitleDelay: 0,
  subtitleFontSize: 'medium',
  subtitleFontColor: '#ffffff',
  subtitleBackground: 'semi',
  rememberPosition: true,
};

const defaultFilter: VodFilter = {
  sortBy: 'addedAt',
  sortOrder: 'desc',
};

export const useVodStore = create<VodState>()(
  persist(
    (set, get) => ({
      // Initial state
      movies: [],
      series: [],
      watchProgress: new Map(),
      subtitles: new Map(),
      isLoading: false,
      error: null,
      selectedItem: null,
      currentFilter: defaultFilter,
      playerSettings: defaultPlayerSettings,
      
      // Setters
      setMovies: (movies) => set({ movies }),
      setSeries: (series) => set({ series }),
      
      addMovies: (newMovies) => set((state) => ({
        movies: [...state.movies.filter(m => !newMovies.some(nm => nm.id === m.id)), ...newMovies]
      })),
      
      addSeries: (newSeries) => set((state) => ({
        series: [...state.series.filter(s => !newSeries.some(ns => ns.id === s.id)), ...newSeries]
      })),
      
      // Watch Progress
      updateWatchProgress: (progress) => set((state) => {
        const newProgress = new Map(state.watchProgress);
        newProgress.set(progress.itemId, progress);
        return { watchProgress: newProgress };
      }),
      
      getWatchProgress: (itemId) => get().watchProgress.get(itemId),
      
      getContinueWatching: () => {
        const { movies, series, watchProgress } = get();
        const inProgress: VodItem[] = [];
        
        // Movies in progress
        movies.forEach(movie => {
          const progress = watchProgress.get(movie.id);
          if (progress && !progress.completed && progress.progress > 5 && progress.progress < 95) {
            inProgress.push({ ...movie, watchProgress: progress });
          }
        });
        
        // Episodes in progress
        series.forEach(s => {
          s.seasons.forEach(season => {
            season.episodes.forEach(episode => {
              const progress = watchProgress.get(episode.id);
              if (progress && !progress.completed && progress.progress > 5 && progress.progress < 95) {
                inProgress.push({ ...episode, watchProgress: progress });
              }
            });
          });
        });
        
        // Sort by last watched
        return inProgress.sort((a, b) => 
          (b.watchProgress?.lastWatchedAt.getTime() || 0) - (a.watchProgress?.lastWatchedAt.getTime() || 0)
        );
      },
      
      // Favorites
      toggleFavorite: (itemId) => set((state) => {
        const movieIndex = state.movies.findIndex(m => m.id === itemId);
        if (movieIndex >= 0) {
          const movies = [...state.movies];
          movies[movieIndex] = { ...movies[movieIndex], isFavorite: !movies[movieIndex].isFavorite };
          return { movies };
        }
        
        const seriesIndex = state.series.findIndex(s => s.id === itemId);
        if (seriesIndex >= 0) {
          const series = [...state.series];
          series[seriesIndex] = { ...series[seriesIndex], isFavorite: !series[seriesIndex].isFavorite };
          return { series };
        }
        
        return {};
      }),
      
      getFavorites: (type) => {
        const { movies, series } = get();
        const favorites: VodItem[] = [];
        
        if (!type || type === 'movie') {
          favorites.push(...movies.filter(m => m.isFavorite));
        }
        if (!type || type === 'series') {
          favorites.push(...series.filter(s => s.isFavorite));
        }
        
        return favorites;
      },
      
      // Subtitles
      addSubtitle: (subtitle) => set((state) => {
        const newSubtitles = new Map(state.subtitles);
        const existing = newSubtitles.get(subtitle.vodItemId) || [];
        newSubtitles.set(subtitle.vodItemId, [...existing, subtitle]);
        return { subtitles: newSubtitles };
      }),
      
      getSubtitles: (vodItemId) => get().subtitles.get(vodItemId) || [],
      
      // Filters
      setFilter: (filter) => set((state) => ({
        currentFilter: { ...state.currentFilter, ...filter }
      })),
      
      clearFilter: () => set({ currentFilter: defaultFilter }),
      
      // UI State
      setSelectedItem: (item) => set({ selectedItem: item }),
      
      setPlayerSettings: (settings) => set((state) => ({
        playerSettings: { ...state.playerSettings, ...settings }
      })),
      
      // Filtered data - respects category visibility
      getFilteredMovies: () => {
        const { movies, currentFilter } = get();
        let filtered = [...movies];
        
        // Get visibility settings
        const visibilityState = useCategoryVisibilityStore.getState();
        const hasConfigured = visibilityState.hasConfigured.movies;
        const visibleCategoryIds = visibilityState.visibleCategoryIds.movies;
        
        // Filter by category visibility
        if (hasConfigured) {
          filtered = filtered.filter((m) => {
            // Movie is visible if any of its genres are visible
            return m.genres.some((genre) => {
              const categoryId = createCategoryId('default', 'movies', genre);
              return visibleCategoryIds.has(categoryId);
            });
          });
        }
        
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
        
        if (currentFilter.yearFrom) {
          filtered = filtered.filter(m => m.year && m.year >= currentFilter.yearFrom!);
        }
        
        if (currentFilter.yearTo) {
          filtered = filtered.filter(m => m.year && m.year <= currentFilter.yearTo!);
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
      },
      
      getFilteredSeries: () => {
        const { series, currentFilter } = get();
        let filtered = [...series];
        
        // Get visibility settings
        const visibilityState = useCategoryVisibilityStore.getState();
        const hasConfigured = visibilityState.hasConfigured.series;
        const visibleCategoryIds = visibilityState.visibleCategoryIds.series;
        
        // Filter by category visibility
        if (hasConfigured) {
          filtered = filtered.filter((s) => {
            // Series is visible if any of its genres are visible
            return s.genres.some((genre) => {
              const categoryId = createCategoryId('default', 'series', genre);
              return visibleCategoryIds.has(categoryId);
            });
          });
        }
        
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
        
        if (currentFilter.yearFrom) {
          filtered = filtered.filter(s => s.year && s.year >= currentFilter.yearFrom!);
        }
        
        if (currentFilter.yearTo) {
          filtered = filtered.filter(s => s.year && s.year <= currentFilter.yearTo!);
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
      },
      
      getCategories: () => {
        const { movies, series, watchProgress } = get();
        const categories: VodCategory[] = [];
        
        // Continue Watching
        const continueWatching = get().getContinueWatching();
        if (continueWatching.length > 0) {
          categories.push({
            id: 'continue_watching',
            name: 'Fortsätt titta',
            type: 'continue_watching',
            items: continueWatching.slice(0, 20),
          });
        }
        
        // Recently Added Movies
        const recentMovies = [...movies]
          .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
          .slice(0, 20);
        if (recentMovies.length > 0) {
          categories.push({
            id: 'recent_movies',
            name: 'Nyligen tillagda filmer',
            type: 'recently_added',
            items: recentMovies,
          });
        }
        
        // Recently Added Series
        const recentSeries = [...series]
          .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
          .slice(0, 20);
        if (recentSeries.length > 0) {
          categories.push({
            id: 'recent_series',
            name: 'Nyligen tillagda serier',
            type: 'recently_added',
            items: recentSeries,
          });
        }
        
        // Favorites
        const favorites = get().getFavorites();
        if (favorites.length > 0) {
          categories.push({
            id: 'favorites',
            name: 'Favoriter',
            type: 'favorites',
            items: favorites,
          });
        }
        
        // Genre categories (top genres)
        const allGenres = get().getAllGenres();
        allGenres.slice(0, 5).forEach(genre => {
          const genreItems = [
            ...movies.filter(m => m.genres.includes(genre)),
            ...series.filter(s => s.genres.includes(genre)),
          ].slice(0, 20);
          
          if (genreItems.length > 0) {
            categories.push({
              id: `genre_${genre.toLowerCase().replace(/\s+/g, '_')}`,
              name: genre,
              type: 'genre',
              items: genreItems,
            });
          }
        });
        
        return categories;
      },
      
      getAllGenres: () => {
        const { movies, series } = get();
        const genreCount = new Map<string, number>();
        
        [...movies, ...series].forEach(item => {
          item.genres.forEach(genre => {
            genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
          });
        });
        
        // Sort by count
        return Array.from(genreCount.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([genre]) => genre);
      },
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      
      clear: () => set({
        movies: [],
        series: [],
        watchProgress: new Map(),
        subtitles: new Map(),
        selectedItem: null,
        currentFilter: defaultFilter,
        error: null,
      }),
    }),
    {
      name: 'streamvault-vod',
      partialize: (state) => ({
        watchProgress: Array.from(state.watchProgress.entries()),
        subtitles: Array.from(state.subtitles.entries()),
        playerSettings: state.playerSettings,
      }),
      merge: (persisted: any, current) => ({
        ...current,
        watchProgress: new Map(persisted?.watchProgress || []),
        subtitles: new Map(persisted?.subtitles || []),
        playerSettings: persisted?.playerSettings || defaultPlayerSettings,
      }),
    }
  )
);
