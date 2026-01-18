/**
 * Import Service - Orchestrates playlist import from M3U/Xtream sources
 * Uses workers for parsing and manages storage to stores
 */

import { useChannelStore } from '@/data/stores/channelStore';
import { useVodStore } from '@/data/stores/vodStore';
import type { ImportResult } from '@/workers/importWorker';
import type { CoreChannel } from '@/core/types';
import type { Movie, Series } from '@/types/vod';

export interface ImportProgress {
  stage: string;
  percent: number;
}

export interface ImportSummary {
  providerId: string;
  providerName: string;
  success: boolean;
  stats: {
    total: number;
    liveCount: number;
    movieCount: number;
    seriesCount: number;
    seasonCount: number;
    episodeCount: number;
    unknownCount: number;
    parseTimeMs: number;
    processTimeMs: number;
  };
  error?: string;
}

class ImportServiceClass {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, {
    resolve: (result: ImportResult) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: ImportProgress) => void;
  }>();
  
  /**
   * Initialize the import worker
   */
  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/importWorker.ts', import.meta.url),
        { type: 'module' }
      );
      
      this.worker.onmessage = (event) => {
        const { type, requestId, payload, progress, error } = event.data;
        const pending = this.pendingRequests.get(requestId);
        
        if (!pending) return;
        
        if (type === 'IMPORT_PROGRESS' && progress) {
          pending.onProgress?.(progress);
          return;
        }
        
        if (type === 'IMPORT_COMPLETE' && payload) {
          this.pendingRequests.delete(requestId);
          pending.resolve(payload);
          return;
        }
        
        if (type === 'IMPORT_ERROR') {
          this.pendingRequests.delete(requestId);
          pending.reject(new Error(error || 'Import failed'));
          return;
        }
      };
      
      this.worker.onerror = (event) => {
        console.error('[ImportService] Worker error:', event);
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          pending.reject(new Error('Worker error'));
        }
        this.pendingRequests.clear();
        this.worker = null;
      };
    }
    
    return this.worker;
  }
  
  /**
   * Import from M3U content
   */
  async importM3U(
    content: string,
    providerId: string,
    providerName: string,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportSummary> {
    const requestId = `import-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    try {
      console.log(`[ImportService] Starting import for provider: ${providerName}`);
      
      const result = await new Promise<ImportResult>((resolve, reject) => {
        this.pendingRequests.set(requestId, { resolve, reject, onProgress });
        
        this.getWorker().postMessage({
          type: 'IMPORT_M3U',
          requestId,
          payload: { content, providerId, providerName },
        });
      });
      
      // Save to stores
      onProgress?.({ stage: 'Sparar data...', percent: 95 });
      
      // Save channels
      if (result.channels.length > 0) {
        await this.saveChannels(result.channels, providerId);
      }
      
      // Save movies
      if (result.movies.length > 0) {
        await this.saveMovies(result.movies);
      }
      
      // Save series
      if (result.series.length > 0) {
        await this.saveSeries(result.series);
      }
      
      console.log(`[ImportService] Import complete:`, result.stats);
      
      return {
        providerId,
        providerName,
        success: true,
        stats: result.stats,
      };
      
    } catch (error) {
      console.error('[ImportService] Import error:', error);
      return {
        providerId,
        providerName,
        success: false,
        stats: {
          total: 0,
          liveCount: 0,
          movieCount: 0,
          seriesCount: 0,
          seasonCount: 0,
          episodeCount: 0,
          unknownCount: 0,
          parseTimeMs: 0,
          processTimeMs: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Import from M3U URL
   */
  async importM3UFromUrl(
    url: string,
    providerId: string,
    providerName: string,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportSummary> {
    try {
      onProgress?.({ stage: 'Laddar spellista...', percent: 5 });
      
      // Fetch the M3U content
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch playlist: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      
      if (!content.includes('#EXTM3U') && !content.includes('#EXTINF')) {
        throw new Error('Invalid M3U format');
      }
      
      return await this.importM3U(content, providerId, providerName, onProgress);
      
    } catch (error) {
      console.error('[ImportService] Error fetching M3U:', error);
      return {
        providerId,
        providerName,
        success: false,
        stats: {
          total: 0,
          liveCount: 0,
          movieCount: 0,
          seriesCount: 0,
          seasonCount: 0,
          episodeCount: 0,
          unknownCount: 0,
          parseTimeMs: 0,
          processTimeMs: 0,
        },
        error: error instanceof Error ? error.message : 'Failed to fetch playlist',
      };
    }
  }
  
  /**
   * Save channels to the channel store
   */
  private async saveChannels(channels: CoreChannel[], providerId: string): Promise<void> {
    const channelStore = useChannelStore.getState();
    
    // Get existing channels and filter out ones from this provider
    const existingChannels = channelStore.channels.filter(c => c.providerId !== providerId);
    
    // Merge with new channels
    const allChannels = [...existingChannels, ...channels];
    
    // Rebuild index using the buildChannelIndex function
    const byId = new Map<string, CoreChannel>();
    const byGroup = new Map<string, string[]>();
    const byProvider = new Map<string, string[]>();
    const searchTokens = new Map<string, Set<string>>();
    const allIds: string[] = [];
    const groupsSet = new Set<string>();
    
    for (const channel of allChannels) {
      byId.set(channel.id, channel);
      allIds.push(channel.id);
      groupsSet.add(channel.group);
      
      // Group index
      if (!byGroup.has(channel.group)) {
        byGroup.set(channel.group, []);
      }
      byGroup.get(channel.group)!.push(channel.id);
      
      // Provider index
      if (!byProvider.has(channel.providerId)) {
        byProvider.set(channel.providerId, []);
      }
      byProvider.get(channel.providerId)!.push(channel.id);
      
      // Build search tokens
      const tokens = channel.nameLower.split(/\s+/).filter(t => t.length >= 2);
      for (const token of tokens) {
        if (!searchTokens.has(token)) {
          searchTokens.set(token, new Set());
        }
        searchTokens.get(token)!.add(channel.id);
      }
    }
    
    const index = {
      byId,
      byGroup,
      byProvider,
      searchTokens,
      allIds,
      groups: Array.from(groupsSet).sort(),
    };
    
    channelStore.setChannels(allChannels, index);
    
    console.log(`[ImportService] Saved ${channels.length} channels (${allChannels.length} total)`);
  }
  
  /**
   * Save movies to the VOD store
   */
  private async saveMovies(movies: Movie[]): Promise<void> {
    useVodStore.getState().addMovies(movies);
    console.log(`[ImportService] Saved ${movies.length} movies`);
  }
  
  /**
   * Save series to the VOD store
   */
  private async saveSeries(series: Series[]): Promise<void> {
    useVodStore.getState().addSeries(series);
    console.log(`[ImportService] Saved ${series.length} series`);
  }
  
  /**
   * Clear all imported data for a provider
   */
  clearProvider(providerId: string): void {
    // Clear channels
    const channelStore = useChannelStore.getState();
    const remainingChannels = channelStore.channels.filter(c => c.providerId !== providerId);
    
    // Rebuild index for remaining channels
    this.saveChannels([], providerId); // This will filter and rebuild
    
    // Clear movies
    const vodStore = useVodStore.getState();
    const remainingMovies = vodStore.movies.filter(m => m.providerId !== providerId);
    vodStore.setMovies(remainingMovies);
    
    // Clear series
    const remainingSeries = vodStore.series.filter(s => s.providerId !== providerId);
    vodStore.setSeries(remainingSeries);
    
    console.log(`[ImportService] Cleared data for provider: ${providerId}`);
  }
  
  /**
   * Terminate the worker
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

export const ImportService = new ImportServiceClass();
