/**
 * Enhanced Favorites Store - Supports channels, groups, and VOD items
 */

import { create } from 'zustand';

export type FavoriteType = 'channel' | 'group' | 'movie' | 'series';

export interface Favorite {
  id: string;
  type: FavoriteType;
  itemId: string;
  providerId?: string;
  name: string;
  logoUrl?: string;
  addedAt: number;
}

export interface WatchProgress {
  id: string;
  itemId: string;
  itemType: 'channel' | 'movie' | 'episode';
  title: string;
  posterUrl?: string;
  progress: number; // 0-100
  currentTime: number; // seconds
  duration: number; // seconds
  lastWatchedAt: number;
  providerId?: string;
  // For episodes
  seriesId?: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
}

interface FavoritesState {
  favorites: Favorite[];
  watchProgress: Map<string, WatchProgress>;
  recentChannels: string[]; // Channel IDs, most recent first
  
  // Favorites actions
  addFavorite: (item: Omit<Favorite, 'id' | 'addedAt'>) => void;
  removeFavorite: (itemId: string, type: FavoriteType) => void;
  isFavorite: (itemId: string, type: FavoriteType) => boolean;
  getFavoritesByType: (type: FavoriteType) => Favorite[];
  
  // Watch progress actions
  updateProgress: (progress: Omit<WatchProgress, 'id' | 'lastWatchedAt'>) => void;
  getProgress: (itemId: string) => WatchProgress | undefined;
  getContinueWatching: (limit?: number) => WatchProgress[];
  clearProgress: (itemId: string) => void;
  
  // Recent channels
  addRecentChannel: (channelId: string) => void;
  getRecentChannels: (limit?: number) => string[];
  clearRecentChannels: () => void;
  
  // Persistence
  load: () => void;
  save: () => void;
}

const STORAGE_KEY = 'streamvault-favorites';
const MAX_RECENTS = 50;

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  watchProgress: new Map(),
  recentChannels: [],

  addFavorite: (item) => {
    const existing = get().favorites.find(
      f => f.itemId === item.itemId && f.type === item.type
    );
    if (existing) return;

    const favorite: Favorite = {
      ...item,
      id: crypto.randomUUID(),
      addedAt: Date.now(),
    };

    set(state => ({
      favorites: [...state.favorites, favorite],
    }));
    get().save();
  },

  removeFavorite: (itemId, type) => {
    set(state => ({
      favorites: state.favorites.filter(
        f => !(f.itemId === itemId && f.type === type)
      ),
    }));
    get().save();
  },

  isFavorite: (itemId, type) => {
    return get().favorites.some(
      f => f.itemId === itemId && f.type === type
    );
  },

  getFavoritesByType: (type) => {
    return get().favorites
      .filter(f => f.type === type)
      .sort((a, b) => b.addedAt - a.addedAt);
  },

  updateProgress: (progress) => {
    const existing = get().watchProgress.get(progress.itemId);
    const updated: WatchProgress = {
      ...progress,
      id: existing?.id || crypto.randomUUID(),
      lastWatchedAt: Date.now(),
    };

    set(state => {
      const newMap = new Map(state.watchProgress);
      newMap.set(progress.itemId, updated);
      return { watchProgress: newMap };
    });
    get().save();
  },

  getProgress: (itemId) => {
    return get().watchProgress.get(itemId);
  },

  getContinueWatching: (limit = 20) => {
    return Array.from(get().watchProgress.values())
      .filter(p => p.progress > 5 && p.progress < 95) // Started but not finished
      .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)
      .slice(0, limit);
  },

  clearProgress: (itemId) => {
    set(state => {
      const newMap = new Map(state.watchProgress);
      newMap.delete(itemId);
      return { watchProgress: newMap };
    });
    get().save();
  },

  addRecentChannel: (channelId) => {
    set(state => {
      const filtered = state.recentChannels.filter(id => id !== channelId);
      return {
        recentChannels: [channelId, ...filtered].slice(0, MAX_RECENTS),
      };
    });
    get().save();
  },

  getRecentChannels: (limit = 10) => {
    return get().recentChannels.slice(0, limit);
  },

  clearRecentChannels: () => {
    set({ recentChannels: [] });
    get().save();
  },

  load: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          favorites: data.favorites || [],
          watchProgress: new Map(data.watchProgress || []),
          recentChannels: data.recentChannels || [],
        });
      }
    } catch {
      // Ignore
    }
  },

  save: () => {
    const state = get();
    const data = {
      favorites: state.favorites,
      watchProgress: Array.from(state.watchProgress.entries()),
      recentChannels: state.recentChannels,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
}));

// Initialize on import
if (typeof window !== 'undefined') {
  useFavoritesStore.getState().load();
}

// ============= Selectors =============

export const useFavoriteChannels = () => 
  useFavoritesStore(state => state.getFavoritesByType('channel'));

export const useFavoriteGroups = () => 
  useFavoritesStore(state => state.getFavoritesByType('group'));

export const useFavoriteMovies = () => 
  useFavoritesStore(state => state.getFavoritesByType('movie'));

export const useFavoriteSeries = () => 
  useFavoritesStore(state => state.getFavoritesByType('series'));

export const useContinueWatching = (limit?: number) => 
  useFavoritesStore(state => state.getContinueWatching(limit));

export const useRecentChannels = (limit?: number) => 
  useFavoritesStore(state => state.getRecentChannels(limit));
