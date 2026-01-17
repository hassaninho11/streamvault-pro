/**
 * EPG Store - Zustand store for TV guide data
 * Pre-computes now/next for fast access
 */

import { create } from 'zustand';
import type { CoreEpgProgram } from '../../core/types';
import { getNowNext } from '../../core/parser/epgParser';

interface EpgState {
  // Raw data
  programs: CoreEpgProgram[];
  byChannelId: Map<string, CoreEpgProgram[]>;
  
  // Pre-computed now/next cache
  nowNextCache: Map<string, { now?: CoreEpgProgram; next?: CoreEpgProgram }>;
  lastNowNextUpdate: number;
  
  // Loading state
  isLoading: boolean;
  lastRefresh: number;
  
  // Actions
  setPrograms: (programs: CoreEpgProgram[], byChannelId: Map<string, CoreEpgProgram[]>) => void;
  updateNowNextCache: () => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useEpgStore = create<EpgState>((set, get) => ({
  programs: [],
  byChannelId: new Map(),
  nowNextCache: new Map(),
  lastNowNextUpdate: 0,
  isLoading: false,
  lastRefresh: 0,
  
  setPrograms: (programs, byChannelId) => {
    set({ 
      programs, 
      byChannelId, 
      isLoading: false,
      lastRefresh: Date.now(),
    });
    // Update now/next after setting programs
    get().updateNowNextCache();
  },
  
  updateNowNextCache: () => {
    const { byChannelId } = get();
    const now = Date.now();
    const newCache = new Map<string, { now?: CoreEpgProgram; next?: CoreEpgProgram }>();
    
    for (const [channelId, programs] of byChannelId) {
      newCache.set(channelId, getNowNext(programs, now));
    }
    
    set({ nowNextCache: newCache, lastNowNextUpdate: now });
  },
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  reset: () => set({
    programs: [],
    byChannelId: new Map(),
    nowNextCache: new Map(),
    lastNowNextUpdate: 0,
    isLoading: false,
    lastRefresh: 0,
  }),
}));

// ============= Selectors =============

/**
 * Get programs for a channel
 */
export const useChannelPrograms = (channelId: string): CoreEpgProgram[] => {
  return useEpgStore((state) => state.byChannelId.get(channelId) || []);
};

/**
 * Get now/next for a channel
 */
export const useNowNext = (channelId: string): { now?: CoreEpgProgram; next?: CoreEpgProgram } => {
  return useEpgStore((state) => state.nowNextCache.get(channelId) || {});
};

/**
 * Get programs for time range (for EPG grid)
 */
export const useProgramsInRange = (
  channelId: string,
  startTime: number,
  endTime: number
): CoreEpgProgram[] => {
  return useEpgStore((state) => {
    const programs = state.byChannelId.get(channelId) || [];
    return programs.filter(p => p.end > startTime && p.start < endTime);
  });
};

/**
 * Get EPG loading state
 */
export const useEpgLoading = (): boolean => {
  return useEpgStore((state) => state.isLoading);
};

/**
 * Get last refresh time
 */
export const useEpgLastRefresh = (): number => {
  return useEpgStore((state) => state.lastRefresh);
};
