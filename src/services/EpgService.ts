/**
 * EPG Service - Fetches and manages EPG data
 * Uses edge function proxy and web worker for parsing
 */

import { supabase } from '@/integrations/supabase/client';
import { workerManager } from '@/workers/workerManager';
import { useEpgStore } from '@/data/stores/epgStore';
import { useChannelStore } from '@/data/stores/channelStore';
import type { CoreEpgProgram } from '@/core/types';

export interface EpgLoadResult {
  success: boolean;
  programCount: number;
  channelCount: number;
  error?: string;
  timing?: {
    fetchMs: number;
    parseMs: number;
  };
}

class EpgServiceClass {
  private isLoading = false;
  private lastLoadTime = 0;
  private readonly MIN_RELOAD_INTERVAL = 5 * 60 * 1000; // 5 minutes

  /**
   * Load EPG data from a URL
   */
  async loadEpg(epgUrl: string): Promise<EpgLoadResult> {
    if (this.isLoading) {
      return { success: false, programCount: 0, channelCount: 0, error: 'EPG load already in progress' };
    }

    // Prevent too frequent reloads
    if (Date.now() - this.lastLoadTime < this.MIN_RELOAD_INTERVAL) {
      console.log('[EpgService] Skipping reload - too recent');
      return { success: true, programCount: 0, channelCount: 0 };
    }

    this.isLoading = true;
    useEpgStore.getState().setLoading(true);

    try {
      console.log('[EpgService] Fetching EPG from:', epgUrl);
      const fetchStart = performance.now();

      // Fetch via edge function proxy
      const { data, error } = await supabase.functions.invoke('playlist-proxy', {
        body: { url: epgUrl, type: 'epg' }
      });

      if (error || !data.success) {
        throw new Error(error?.message || data?.error || 'Failed to fetch EPG');
      }

      const fetchMs = performance.now() - fetchStart;
      console.log(`[EpgService] EPG fetched in ${fetchMs.toFixed(0)}ms, size: ${data.content.length}`);

      // Build channel mapping from store
      const channelMapping = this.buildChannelMapping();
      console.log(`[EpgService] Built mapping for ${channelMapping.size} channels`);

      // Parse in worker
      const parseStart = performance.now();
      const { response, timing } = await workerManager.parseEpg(data.content, channelMapping);
      const parseMs = performance.now() - parseStart;

      console.log(`[EpgService] Parsed ${response.programs.length} programs in ${parseMs.toFixed(0)}ms`);

      // Update store
      const byChannelId = new Map(response.byChannelId);
      useEpgStore.getState().setPrograms(response.programs, byChannelId);
      
      // Update now/next cache
      useEpgStore.getState().updateNowNextCache();

      this.lastLoadTime = Date.now();

      return {
        success: true,
        programCount: response.programs.length,
        channelCount: byChannelId.size,
        timing: { fetchMs, parseMs },
      };

    } catch (error) {
      console.error('[EpgService] Error loading EPG:', error);
      return {
        success: false,
        programCount: 0,
        channelCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.isLoading = false;
      useEpgStore.getState().setLoading(false);
    }
  }

  /**
   * Build channel mapping from current channels (epgId -> channelId)
   */
  private buildChannelMapping(): Map<string, string> {
    const channels = useChannelStore.getState().channels;
    const mapping = new Map<string, string>();

    for (const channel of channels) {
      if (channel.epgId) {
        mapping.set(channel.epgId, channel.id);
      }
      // Also try tvg-id variations
      mapping.set(channel.channelId, channel.id);
      mapping.set(channel.name.toLowerCase(), channel.id);
    }

    return mapping;
  }

  /**
   * Get programs for a channel in a time range
   */
  getProgramsInRange(channelId: string, start: number, end: number): CoreEpgProgram[] {
    const channelPrograms = useEpgStore.getState().byChannelId.get(channelId) || [];
    return channelPrograms.filter(p => p.end > start && p.start < end);
  }

  /**
   * Get now/next for a channel
   */
  getNowNext(channelId: string): { now?: CoreEpgProgram; next?: CoreEpgProgram } {
    return useEpgStore.getState().nowNextCache.get(channelId) || {};
  }

  /**
   * Force refresh now/next cache (call periodically)
   */
  refreshNowNextCache(): void {
    useEpgStore.getState().updateNowNextCache();
  }
}

export const EpgService = new EpgServiceClass();
