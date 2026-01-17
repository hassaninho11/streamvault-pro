/**
 * Channel Store - Zustand store with O(1) indexed lookups
 * Supports 10k+ channels with fast search and filtering
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { CoreChannel, ChannelIndex, ChannelViewModel, CoreEpgProgram } from '../../core/types';
import { searchChannels, getChannelsByGroup, getGroupsWithCounts } from '../../core/indexing/channelIndex';

interface ChannelState {
  // Raw data
  channels: CoreChannel[];
  index: ChannelIndex | null;
  
  // UI state
  selectedChannelId: string | null;
  searchQuery: string;
  selectedGroup: string | null;
  
  // Favorites (synced with DB)
  favoriteIds: Set<string>;
  
  // EPG data for now/next
  nowNextMap: Map<string, { now?: CoreEpgProgram; next?: CoreEpgProgram }>;
  
  // Loading states
  isLoading: boolean;
  parseProgress: number;
  
  // Actions
  setChannels: (channels: CoreChannel[], index: ChannelIndex) => void;
  setSelectedChannel: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedGroup: (group: string | null) => void;
  setFavorites: (ids: string[]) => void;
  toggleFavorite: (id: string) => void;
  setNowNext: (channelId: string, data: { now?: CoreEpgProgram; next?: CoreEpgProgram }) => void;
  setLoading: (loading: boolean) => void;
  setParseProgress: (progress: number) => void;
  reset: () => void;
}

const initialState = {
  channels: [],
  index: null,
  selectedChannelId: null,
  searchQuery: '',
  selectedGroup: null,
  favoriteIds: new Set<string>(),
  nowNextMap: new Map(),
  isLoading: false,
  parseProgress: 0,
};

export const useChannelStore = create<ChannelState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    setChannels: (channels, index) => set({ 
      channels, 
      index, 
      isLoading: false,
      parseProgress: 100,
    }),
    
    setSelectedChannel: (id) => set({ selectedChannelId: id }),
    
    setSearchQuery: (query) => set({ searchQuery: query }),
    
    setSelectedGroup: (group) => set({ selectedGroup: group }),
    
    setFavorites: (ids) => set({ favoriteIds: new Set(ids) }),
    
    toggleFavorite: (id) => set((state) => {
      const newFavorites = new Set(state.favoriteIds);
      if (newFavorites.has(id)) {
        newFavorites.delete(id);
      } else {
        newFavorites.add(id);
      }
      return { favoriteIds: newFavorites };
    }),
    
    setNowNext: (channelId, data) => set((state) => {
      const newMap = new Map(state.nowNextMap);
      newMap.set(channelId, data);
      return { nowNextMap: newMap };
    }),
    
    setLoading: (loading) => set({ isLoading: loading }),
    
    setParseProgress: (progress) => set({ parseProgress: progress }),
    
    reset: () => set(initialState),
  }))
);

// ============= Selectors (memoized via Zustand) =============

// Cached filtered IDs to prevent re-computation on every render
let cachedFilteredIds: string[] = [];
let cachedSearchQuery = '';
let cachedSelectedGroup: string | null = null;
let cachedIndex: ChannelIndex | null = null;

/**
 * Get filtered channel IDs based on current search/group
 * Returns IDs only - components lookup channel data as needed
 * Uses caching to prevent infinite re-renders
 */
export const useFilteredChannelIds = (): string[] => {
  const searchQuery = useChannelStore((state) => state.searchQuery);
  const selectedGroup = useChannelStore((state) => state.selectedGroup);
  const index = useChannelStore((state) => state.index);
  
  // Return cached result if inputs haven't changed
  if (
    index === cachedIndex &&
    searchQuery === cachedSearchQuery &&
    selectedGroup === cachedSelectedGroup
  ) {
    return cachedFilteredIds;
  }
  
  // Update cache
  cachedIndex = index;
  cachedSearchQuery = searchQuery;
  cachedSelectedGroup = selectedGroup;
  
  if (!index) {
    cachedFilteredIds = [];
    return cachedFilteredIds;
  }
  
  // Search takes priority
  if (searchQuery.length > 0) {
    cachedFilteredIds = searchChannels(searchQuery, index);
  } else if (selectedGroup) {
    // Group filter
    cachedFilteredIds = getChannelsByGroup(selectedGroup, index);
  } else {
    // All channels
    cachedFilteredIds = index.allIds;
  }
  
  return cachedFilteredIds;
};

/**
 * Get single channel by ID - O(1) lookup
 */
export const useChannel = (id: string): CoreChannel | undefined => {
  return useChannelStore((state) => state.index?.byId.get(id));
};

/**
 * Get channel as view model with favorite/EPG data
 */
export const useChannelViewModel = (id: string): ChannelViewModel | undefined => {
  return useChannelStore((state) => {
    const channel = state.index?.byId.get(id);
    if (!channel) return undefined;
    
    const nowNext = state.nowNextMap.get(id);
    
    return {
      id: channel.id,
      name: channel.name,
      group: channel.group,
      logoUrl: channel.logoUrl,
      isHD: channel.isHD,
      isFavorite: state.favoriteIds.has(id),
      nowPlaying: nowNext?.now?.title,
      nextUp: nowNext?.next?.title,
    };
  });
};

/**
 * Get selected channel
 */
export const useSelectedChannel = (): CoreChannel | null => {
  return useChannelStore((state) => {
    if (!state.selectedChannelId || !state.index) return null;
    return state.index.byId.get(state.selectedChannelId) || null;
  });
};

/**
 * Get groups with counts
 */
export const useGroups = (): { name: string; count: number }[] => {
  return useChannelStore((state) => {
    if (!state.index) return [];
    return getGroupsWithCounts(state.index);
  });
};

/**
 * Get search query
 */
export const useSearchQuery = (): string => {
  return useChannelStore((state) => state.searchQuery);
};

/**
 * Get selected group
 */
export const useSelectedGroup = (): string | null => {
  return useChannelStore((state) => state.selectedGroup);
};

/**
 * Get favorite channel IDs
 */
export const useFavoriteIds = (): Set<string> => {
  return useChannelStore((state) => state.favoriteIds);
};

/**
 * Check if channel is favorite
 */
export const useIsFavorite = (id: string): boolean => {
  return useChannelStore((state) => state.favoriteIds.has(id));
};

/**
 * Get loading state
 */
export const useIsLoading = (): boolean => {
  return useChannelStore((state) => state.isLoading);
};

/**
 * Get total channel count
 */
export const useChannelCount = (): number => {
  return useChannelStore((state) => state.channels.length);
};
