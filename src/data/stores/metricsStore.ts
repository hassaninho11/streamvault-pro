/**
 * Performance Metrics Store - Tracks and exposes performance data
 * Includes startup metrics for category visibility optimization
 */

import { create } from 'zustand';
import type { PerformanceMetrics } from '../../core/types';
import { cacheManager } from '../cache/cacheManager';

export interface StartupMetrics {
  // Timing
  appStartTimestamp: number;
  playlistLoadStartMs?: number;
  playlistLoadEndMs?: number;
  totalStartupMs?: number;
  
  // Content stats
  totalChannelsLoaded: number;
  channelsFromCache: number;
  channelsFresh: number;
  totalCategories: number;
  visibleCategories: number;
  hiddenCategories: number;
  
  // Estimated savings
  estimatedSkippedItems: number;
  estimatedTimeSavedMs: number;
  
  // Source info
  loadSource: 'cache' | 'network' | 'mixed' | 'none';
  providerCount: number;
}

interface MetricsState extends PerformanceMetrics {
  // Render tracking
  renderTimes: Map<string, number[]>;
  
  // Startup metrics
  startupMetrics: StartupMetrics;
  
  // Actions
  setColdStart: (ms: number) => void;
  recordRender: (component: string, ms: number) => void;
  setWorkerParse: (ms: number) => void;
  recordPlayerError: () => void;
  recordPlayerReconnect: () => void;
  updateCacheStats: () => void;
  getAverageRenderTime: (component: string) => number;
  getTopRenderOffenders: (limit?: number) => { component: string; avgMs: number; count: number }[];
  reset: () => void;
  
  // Startup metrics actions
  recordAppStart: () => void;
  recordPlaylistLoadStart: () => void;
  recordPlaylistLoadComplete: (stats: {
    totalChannels: number;
    fromCache: number;
    fresh: number;
    providerCount: number;
  }) => void;
  updateCategoryStats: (stats: {
    total: number;
    visible: number;
    hidden: number;
    estimatedSkippedItems: number;
  }) => void;
  getStartupSummary: () => {
    loadTimeMs: number;
    loadSource: string;
    channelCount: number;
    hiddenCategorySavings: {
      categoriesHidden: number;
      itemsSkipped: number;
      estimatedTimeSavedMs: number;
    };
  };
}

const initialStartupMetrics: StartupMetrics = {
  appStartTimestamp: 0,
  totalChannelsLoaded: 0,
  channelsFromCache: 0,
  channelsFresh: 0,
  totalCategories: 0,
  visibleCategories: 0,
  hiddenCategories: 0,
  estimatedSkippedItems: 0,
  estimatedTimeSavedMs: 0,
  loadSource: 'none',
  providerCount: 0,
};

export const useMetricsStore = create<MetricsState>((set, get) => ({
  coldStartMs: undefined,
  lastRenderMs: undefined,
  workerParseMs: undefined,
  cacheHitRatio: 0,
  cacheHits: 0,
  cacheMisses: 0,
  playerErrors: 0,
  playerReconnects: 0,
  memoryUsageMB: undefined,
  renderTimes: new Map(),
  startupMetrics: { ...initialStartupMetrics },
  
  setColdStart: (ms) => set({ coldStartMs: ms }),
  
  recordRender: (component, ms) => set((state) => {
    const times = state.renderTimes.get(component) || [];
    // Keep last 100 samples
    const newTimes = [...times.slice(-99), ms];
    const newMap = new Map(state.renderTimes);
    newMap.set(component, newTimes);
    return { renderTimes: newMap, lastRenderMs: ms };
  }),
  
  setWorkerParse: (ms) => set({ workerParseMs: ms }),
  
  recordPlayerError: () => set((state) => ({ playerErrors: state.playerErrors + 1 })),
  
  recordPlayerReconnect: () => set((state) => ({ playerReconnects: state.playerReconnects + 1 })),
  
  updateCacheStats: () => {
    const stats = cacheManager.getCacheStats();
    set({
      cacheHitRatio: stats.hitRatio,
      cacheHits: stats.hits,
      cacheMisses: stats.misses,
    });
  },
  
  getAverageRenderTime: (component) => {
    const times = get().renderTimes.get(component);
    if (!times || times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  },
  
  getTopRenderOffenders: (limit = 10) => {
    const { renderTimes } = get();
    const results: { component: string; avgMs: number; count: number }[] = [];
    
    for (const [component, times] of renderTimes) {
      if (times.length > 0) {
        const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
        results.push({ component, avgMs, count: times.length });
      }
    }
    
    return results
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, limit);
  },
  
  // Startup metrics
  recordAppStart: () => {
    set((state) => ({
      startupMetrics: {
        ...state.startupMetrics,
        appStartTimestamp: performance.now(),
      },
    }));
  },
  
  recordPlaylistLoadStart: () => {
    set((state) => ({
      startupMetrics: {
        ...state.startupMetrics,
        playlistLoadStartMs: performance.now(),
      },
    }));
  },
  
  recordPlaylistLoadComplete: (stats) => {
    const now = performance.now();
    set((state) => {
      const loadTimeMs = state.startupMetrics.playlistLoadStartMs
        ? now - state.startupMetrics.playlistLoadStartMs
        : 0;
      
      let loadSource: StartupMetrics['loadSource'] = 'none';
      if (stats.fromCache > 0 && stats.fresh > 0) {
        loadSource = 'mixed';
      } else if (stats.fromCache > 0) {
        loadSource = 'cache';
      } else if (stats.fresh > 0) {
        loadSource = 'network';
      }
      
      return {
        startupMetrics: {
          ...state.startupMetrics,
          playlistLoadEndMs: now,
          totalStartupMs: loadTimeMs,
          totalChannelsLoaded: stats.totalChannels,
          channelsFromCache: stats.fromCache,
          channelsFresh: stats.fresh,
          loadSource,
          providerCount: stats.providerCount,
        },
      };
    });
  },
  
  updateCategoryStats: (stats) => {
    // Estimate time saved: ~0.1ms per skipped item for indexing + rendering
    const estimatedTimeSavedMs = Math.round(stats.estimatedSkippedItems * 0.1);
    
    set((state) => ({
      startupMetrics: {
        ...state.startupMetrics,
        totalCategories: stats.total,
        visibleCategories: stats.visible,
        hiddenCategories: stats.hidden,
        estimatedSkippedItems: stats.estimatedSkippedItems,
        estimatedTimeSavedMs,
      },
    }));
  },
  
  getStartupSummary: () => {
    const { startupMetrics } = get();
    return {
      loadTimeMs: startupMetrics.totalStartupMs || 0,
      loadSource: startupMetrics.loadSource,
      channelCount: startupMetrics.totalChannelsLoaded,
      hiddenCategorySavings: {
        categoriesHidden: startupMetrics.hiddenCategories,
        itemsSkipped: startupMetrics.estimatedSkippedItems,
        estimatedTimeSavedMs: startupMetrics.estimatedTimeSavedMs,
      },
    };
  },
  
  reset: () => set({
    coldStartMs: undefined,
    lastRenderMs: undefined,
    workerParseMs: undefined,
    cacheHitRatio: 0,
    cacheHits: 0,
    cacheMisses: 0,
    playerErrors: 0,
    playerReconnects: 0,
    memoryUsageMB: undefined,
    renderTimes: new Map(),
    startupMetrics: { ...initialStartupMetrics },
  }),
}));

// Memory usage updater (where supported)
if (typeof performance !== 'undefined' && 'memory' in performance) {
  setInterval(() => {
    const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
    if (memory) {
      useMetricsStore.setState({ 
        memoryUsageMB: Math.round(memory.usedJSHeapSize / 1024 / 1024) 
      });
    }
  }, 5000);
}

// ============= Performance Profiling Helpers =============

export function profileRender(component: string): () => void {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    useMetricsStore.getState().recordRender(component, duration);
  };
}

export function measureColdStart(): void {
  if (typeof performance !== 'undefined') {
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navEntry) {
      const coldStart = navEntry.domInteractive - navEntry.fetchStart;
      useMetricsStore.getState().setColdStart(coldStart);
    }
  }
}
