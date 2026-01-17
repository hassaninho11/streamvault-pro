/**
 * PlaylistService - Handles fetching and parsing of M3U/Xtream playlists
 * Uses Web Workers for parsing to keep UI responsive
 * Uses edge function proxy to avoid CORS issues
 */

import { workerManager } from '@/workers/workerManager';
import { useChannelStore } from '@/data/stores/channelStore';
import { supabase } from '@/integrations/supabase/client';
import type { CoreChannel, ChannelIndex } from '@/core/types';

export interface PlaylistLoadResult {
  success: boolean;
  channelCount: number;
  groups: string[];
  error?: string;
  timing?: {
    fetchMs: number;
    parseMs: number;
    indexMs: number;
  };
}

class PlaylistService {
  /**
   * Fetch and parse an M3U playlist from URL
   */
  async loadM3UPlaylist(url: string, providerId: string): Promise<PlaylistLoadResult> {
    const fetchStart = performance.now();
    
    try {
      // Set loading state
      useChannelStore.getState().setLoading(true);
      useChannelStore.getState().setParseProgress(10);

      // Fetch via edge function proxy to avoid CORS issues
      const { data, error } = await supabase.functions.invoke('playlist-proxy', {
        body: { url, type: 'fetch' }
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch playlist');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch playlist');
      }

      const content = data.content;
      const fetchMs = performance.now() - fetchStart;
      
      useChannelStore.getState().setParseProgress(40);

      // Parse in worker
      const { response: parseResult, timing } = await workerManager.parsePlaylist(content, providerId);
      
      useChannelStore.getState().setParseProgress(80);

      // Reconstruct the index from serialized data
      const index = this.reconstructIndex(parseResult.channels, parseResult.index);
      
      // Update channel store
      useChannelStore.getState().setChannels(parseResult.channels, index);

      return {
        success: true,
        channelCount: parseResult.channels.length,
        groups: parseResult.index.groups,
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
