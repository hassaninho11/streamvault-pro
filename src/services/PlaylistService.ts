/**
 * PlaylistService - Handles fetching and parsing of M3U/Xtream playlists
 * Uses Web Workers for parsing to keep UI responsive
 * Uses edge function proxy to avoid CORS issues
 * Implements IndexedDB caching for fast app restarts
 */

import { workerManager } from '@/workers/workerManager';
import { useChannelStore } from '@/data/stores/channelStore';
import { supabase } from '@/integrations/supabase/client';
import { cacheManager } from '@/data/cache/cacheManager';
import type { CoreChannel, ChannelIndex } from '@/core/types';

export interface PlaylistLoadResult {
  success: boolean;
  channelCount: number;
  groups: string[];
  fromCache?: boolean;
  error?: string;
  timing?: {
    fetchMs: number;
    parseMs: number;
    indexMs: number;
  };
}

/**
 * Generate a simple hash for cache invalidation
 */
function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

class PlaylistService {
  /**
   * Load channels from cache if available
   * Returns true if cache was used, false if fresh fetch needed
   */
  async loadFromCache(providerId: string): Promise<PlaylistLoadResult | null> {
    try {
      const cached = await cacheManager.getCachedChannels(providerId);
      
      if (cached && cached.channels.length > 0) {
        console.log(`[PlaylistService] Loading ${cached.channels.length} channels from cache for provider ${providerId}`);
        
        // Reconstruct index from cached channels
        const index = this.buildIndexFromChannels(cached.channels);
        
        // Update channel store
        const state = useChannelStore.getState();
        const existingChannels = state.channels.filter(c => c.providerId !== providerId);
        const mergedChannels = [...existingChannels, ...cached.channels];
        
        // Rebuild full index
        const fullIndex = this.buildIndexFromChannels(mergedChannels);
        useChannelStore.getState().setChannels(mergedChannels, fullIndex);
        
        return {
          success: true,
          channelCount: cached.channels.length,
          groups: index.groups,
          fromCache: true,
        };
      }
      
      return null;
    } catch (error) {
      console.error('[PlaylistService] Cache load error:', error);
      return null;
    }
  }

  /**
   * Fetch and parse an M3U playlist from URL
   */
  async loadM3UPlaylist(url: string, providerId: string, skipCache = false): Promise<PlaylistLoadResult> {
    const fetchStart = performance.now();
    
    // Try cache first (unless skipCache is true)
    if (!skipCache) {
      const cachedResult = await this.loadFromCache(providerId);
      if (cachedResult) {
        // Trigger background refresh
        this.refreshInBackground(url, providerId);
        return cachedResult;
      }
    }
    
    try {
      // Set loading state - Stage 1: Fetching (0-30%)
      useChannelStore.getState().setLoading(true);
      useChannelStore.getState().setParseProgress(5);

      // Simulate progress during fetch
      const fetchProgressInterval = setInterval(() => {
        const current = useChannelStore.getState().parseProgress;
        if (current < 25) {
          useChannelStore.getState().setParseProgress(current + 2);
        }
      }, 200);

      // Fetch via edge function proxy to avoid CORS issues
      const { data, error } = await supabase.functions.invoke('playlist-proxy', {
        body: { url, type: 'fetch' }
      });
      
      clearInterval(fetchProgressInterval);

      if (error) {
        throw new Error(error.message || 'Failed to fetch playlist');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch playlist');
      }

      const content = data.content;
      const fetchMs = performance.now() - fetchStart;
      const contentHash = generateHash(content.slice(0, 5000)); // Hash first 5KB for speed
      
      // Stage 2: Parsing (30-70%)
      useChannelStore.getState().setParseProgress(30);
      
      // Simulate parse progress
      const parseProgressInterval = setInterval(() => {
        const current = useChannelStore.getState().parseProgress;
        if (current < 65) {
          useChannelStore.getState().setParseProgress(current + 3);
        }
      }, 150);

      // Parse in worker
      const { response: parseResult, timing } = await workerManager.parsePlaylist(content, providerId);
      
      clearInterval(parseProgressInterval);
      
      // Stage 3: Indexing (70-95%)
      useChannelStore.getState().setParseProgress(70);

      // Reconstruct the index from serialized data
      const index = this.reconstructIndex(parseResult.channels, parseResult.index);
      
      useChannelStore.getState().setParseProgress(80);
      
      // Merge with existing channels from other providers
      const state = useChannelStore.getState();
      const existingChannels = state.channels.filter(c => c.providerId !== providerId);
      const mergedChannels = [...existingChannels, ...parseResult.channels];
      
      useChannelStore.getState().setParseProgress(85);
      
      // Rebuild full index with all channels
      const fullIndex = this.buildIndexFromChannels(mergedChannels);
      
      useChannelStore.getState().setParseProgress(90);
      
      // Update channel store
      useChannelStore.getState().setChannels(mergedChannels, fullIndex);
      
      // Stage 4: Caching (95-100%)
      useChannelStore.getState().setParseProgress(95);
      
      // Cache the parsed channels for this provider
      await cacheManager.setCachedChannels(providerId, parseResult.channels, contentHash);
      console.log(`[PlaylistService] Cached ${parseResult.channels.length} channels for provider ${providerId}`);

      return {
        success: true,
        channelCount: parseResult.channels.length,
        groups: parseResult.index.groups,
        fromCache: false,
        timing: {
          fetchMs,
          parseMs: timing.parseMs,
          indexMs: timing.indexMs,
        },
      };
    } catch (error) {
      console.error('[PlaylistService] Error loading playlist:', error);
      useChannelStore.getState().setLoading(false);
      
      return {
        success: false,
        channelCount: 0,
        groups: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Refresh playlist in background without blocking UI
   */
  private async refreshInBackground(url: string, providerId: string): Promise<void> {
    // Wait a bit before background refresh to let UI settle
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`[PlaylistService] Background refresh for provider ${providerId}`);
    await this.loadM3UPlaylist(url, providerId, true);
  }

  /**
   * Build index from channels array
   */
  private buildIndexFromChannels(channels: CoreChannel[]): ChannelIndex {
    const byId = new Map<string, CoreChannel>();
    const byGroup = new Map<string, string[]>();
    const byProvider = new Map<string, string[]>();
    const searchTokens = new Map<string, Set<string>>();
    const groups = new Set<string>();
    
    for (const channel of channels) {
      byId.set(channel.id, channel);
      
      // By group
      groups.add(channel.group);
      const groupChannels = byGroup.get(channel.group) || [];
      groupChannels.push(channel.id);
      byGroup.set(channel.group, groupChannels);
      
      // By provider
      const providerChannels = byProvider.get(channel.providerId) || [];
      providerChannels.push(channel.id);
      byProvider.set(channel.providerId, providerChannels);
      
      // Search tokens
      const tokens = this.tokenize(channel.name);
      for (const token of tokens) {
        const existing = searchTokens.get(token) || new Set();
        existing.add(channel.id);
        searchTokens.set(token, existing);
      }
    }
    
    return {
      byId,
      byGroup,
      byProvider,
      searchTokens,
      allIds: channels.map(c => c.id),
      groups: Array.from(groups).sort(),
    };
  }
  
  private tokenize(str: string): string[] {
    return str.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);
  }

  /**
   * Load Xtream Codes playlist
   */
  async loadXtreamPlaylist(
    host: string, 
    username: string, 
    password: string, 
    providerId: string
  ): Promise<PlaylistLoadResult> {
    // Construct Xtream M3U URL
    const cleanHost = host.replace(/\/+$/, '');
    const m3uUrl = `${cleanHost}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts`;
    
    return this.loadM3UPlaylist(m3uUrl, providerId);
  }

  /**
   * Reconstruct ChannelIndex from serialized worker response
   */
  private reconstructIndex(
    channels: CoreChannel[],
    serializedIndex: {
      byGroup: [string, string[]][];
      groups: string[];
      searchTokens: [string, string[]][];
    }
  ): ChannelIndex {
    const byId = new Map<string, CoreChannel>();
    const byProvider = new Map<string, string[]>();
    
    for (const channel of channels) {
      byId.set(channel.id, channel);
      
      const providerChannels = byProvider.get(channel.providerId) || [];
      providerChannels.push(channel.id);
      byProvider.set(channel.providerId, providerChannels);
    }

    return {
      byId,
      byGroup: new Map(serializedIndex.byGroup),
      byProvider,
      searchTokens: new Map(
        serializedIndex.searchTokens.map(([key, ids]) => [key, new Set(ids)])
      ),
      allIds: channels.map(c => c.id),
      groups: serializedIndex.groups,
    };
  }

  /**
   * Get channel count for a provider from current store
   */
  getProviderChannelCount(providerId: string): number {
    const index = useChannelStore.getState().index;
    if (!index) return 0;
    return index.byProvider.get(providerId)?.length || 0;
  }

  /**
   * Clear channels for a specific provider
   */
  clearProviderChannels(providerId: string): void {
    const state = useChannelStore.getState();
    if (!state.index) return;

    const remainingChannels = state.channels.filter(c => c.providerId !== providerId);
    
    // Rebuild index without this provider's channels
    if (remainingChannels.length === 0) {
      state.reset();
    } else {
      // Would need to rebuild index - for now just reset if removing a provider
      // In production, implement proper incremental index updates
    }
  }
}

export const playlistService = new PlaylistService();
export default playlistService;
