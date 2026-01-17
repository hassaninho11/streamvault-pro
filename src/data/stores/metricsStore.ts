/**
 * Performance Metrics Store - Tracks and exposes performance data
 */

import { create } from 'zustand';
import type { PerformanceMetrics } from '../../core/types';
import { cacheManager } from '../cache/cacheManager';

interface MetricsState extends PerformanceMetrics {
  // Render tracking
  renderTimes: Map<string, number[]>;
  
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
}

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
