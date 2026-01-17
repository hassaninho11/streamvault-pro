/**
 * PlaylistService - Handles fetching and parsing of M3U/Xtream playlists
 * Uses Web Workers for parsing to keep UI responsive
 * Uses edge function proxy to avoid CORS issues
 * Implements IndexedDB caching for fast app restarts
 * Now separates VOD (movies/series) from live channels
 */

import { workerManager, type ExtendedParsePlaylistResponse } from '@/workers/workerManager';
import { useChannelStore } from '@/data/stores/channelStore';
import { useVodStore } from '@/data/stores/vodStore';
import { supabase } from '@/integrations/supabase/client';
import { cacheManager } from '@/data/cache/cacheManager';
import type { CoreChannel, ChannelIndex } from '@/core/types';
import type { DetectedContent } from '@/core/parser/vodDetector';
import type { Movie, Series, Season, Episode } from '@/types/vod';

export interface PlaylistLoadResult {
  success: boolean;
  channelCount: number;
  movieCount: number;
  seriesCount: number;
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
          movieCount: 0,
          seriesCount: 0,
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

      // Try edge function proxy first, fallback to direct fetch
      let content: string;
      let proxyFailed = false;
      
      try {
        const { data, error } = await supabase.functions.invoke('playlist-proxy', {
          body: { url, type: 'fetch' }
        });
        
        clearInterval(fetchProgressInterval);

        if (error) {
          throw new Error(error.message || 'Proxy failed');
        }

        // Check for DNS errors - fallback to direct fetch
        if (data?.error && (
          data.error.includes('DNS') || 
          data.error.includes('dns') ||
          data.error.includes('could not be found')
        )) {
          console.log('[PlaylistService] Proxy DNS error, trying direct fetch...');
          proxyFailed = true;
        } else if (!data?.success) {
          throw new Error(data?.error || 'Failed to fetch playlist');
        } else {
          content = data.content;
        }
      } catch (proxyError) {
        clearInterval(fetchProgressInterval);
        console.log('[PlaylistService] Proxy failed, trying direct fetch...', proxyError);
        proxyFailed = true;
      }
      
      // Fallback: try direct fetch
      if (proxyFailed) {
        console.log('[PlaylistService] Attempting direct fetch for:', url.substring(0, 50) + '...');
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/x-mpegURL, audio/mpegurl, text/plain, */*',
            },
          });
          
          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }
          
          content = await response.text();
          console.log('[PlaylistService] Direct fetch successful, content length:', content.length);
        } catch (directError) {
          console.error('[PlaylistService] Direct fetch also failed:', directError);
          throw new Error(
            'Could not connect to the playlist server. ' +
            'The server may be temporarily unavailable or blocking connections.'
          );
        }
      }

      const fetchMs = performance.now() - fetchStart;
      const contentHash = generateHash(content!.slice(0, 5000)); // Hash first 5KB for speed
      
      // Stage 2: Parsing (30-70%)
      useChannelStore.getState().setParseProgress(30);
      
      // Simulate parse progress
      const parseProgressInterval = setInterval(() => {
        const current = useChannelStore.getState().parseProgress;
        if (current < 65) {
          useChannelStore.getState().setParseProgress(current + 3);
        }
      }, 150);

      // Parse in worker - now returns categorized content
      const { response: parseResult, timing } = await workerManager.parsePlaylist(content!, providerId);
      
      clearInterval(parseProgressInterval);
      
      // Stage 3: Indexing (70-95%)
      useChannelStore.getState().setParseProgress(70);

      // Reconstruct the index from serialized data
      const index = this.reconstructIndex(parseResult.channels, parseResult.index);
      
      useChannelStore.getState().setParseProgress(75);

      // Convert and store VOD content
      const { movieCount, seriesCount } = this.storeVodContent(
        parseResult.movies,
        parseResult.series,
        providerId
      );
      
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
      console.log(`[PlaylistService] Stored ${movieCount} movies and ${seriesCount} series`);

      return {
        success: true,
        channelCount: parseResult.channels.length,
        movieCount,
        seriesCount,
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
        movieCount: 0,
        seriesCount: 0,
        groups: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert detected VOD items and store in vodStore
   */
  private storeVodContent(
    movieItems: DetectedContent[],
    seriesItems: DetectedContent[],
    providerId: string
  ): { movieCount: number; seriesCount: number } {
    const now = new Date();
    
    // Convert movies
    const movies: Movie[] = movieItems.map((detected, index) => ({
      id: `${providerId}-movie-${index}`,
      providerId,
      type: 'movie' as const,
      title: this.cleanVodTitle(detected.item.name),
      year: detected.year,
      genres: [detected.item.group],
      posterUrl: detected.item.logo,
      streamUrl: detected.item.url,
      metadataSource: 'provider' as const,
      subtitlesAvailable: false,
      audioLanguages: [],
      addedAt: now,
      updatedAt: now,
    }));
    
    // Group series items by series title
    const seriesMap = new Map<string, DetectedContent[]>();
    for (const item of seriesItems) {
      const seriesTitle = item.seriesTitle || this.extractSeriesTitle(item.item.name);
      const existing = seriesMap.get(seriesTitle) || [];
      existing.push(item);
      seriesMap.set(seriesTitle, existing);
    }
    
    // Convert series with episodes
    const series: Series[] = [];
    let seriesIndex = 0;
    
    for (const [seriesTitle, episodes] of seriesMap) {
      const seriesId = `${providerId}-series-${seriesIndex++}`;
      
      // Group episodes by season
      const seasonMap = new Map<number, DetectedContent[]>();
      for (const ep of episodes) {
        const seasonNum = ep.seasonNumber || 1;
        const existing = seasonMap.get(seasonNum) || [];
        existing.push(ep);
        seasonMap.set(seasonNum, existing);
      }
      
      // Build seasons with episodes
      const seasons: Season[] = [];
      for (const [seasonNum, seasonEps] of seasonMap) {
        const episodesList: Episode[] = seasonEps.map((ep, epIndex) => ({
          id: `${seriesId}-s${seasonNum}-e${ep.episodeNumber || epIndex + 1}`,
          providerId,
          type: 'episode' as const,
          title: ep.item.name,
          seriesId,
          seasonNumber: seasonNum,
          episodeNumber: ep.episodeNumber || epIndex + 1,
          year: ep.year,
          genres: [ep.item.group],
          posterUrl: ep.item.logo,
          streamUrl: ep.item.url,
          metadataSource: 'provider' as const,
          subtitlesAvailable: false,
          audioLanguages: [],
          addedAt: now,
          updatedAt: now,
        }));
        
        seasons.push({
          id: `${seriesId}-s${seasonNum}`,
          seriesId,
          seasonNumber: seasonNum,
          episodes: episodesList.sort((a, b) => a.episodeNumber - b.episodeNumber),
          episodeCount: episodesList.length,
        });
      }
      
      // Get first episode for poster
      const firstEp = episodes[0];
      
      series.push({
        id: seriesId,
        providerId,
        type: 'series',
        title: seriesTitle,
        year: firstEp.year,
        genres: [firstEp.item.group],
        posterUrl: firstEp.item.logo,
        seasons: seasons.sort((a, b) => a.seasonNumber - b.seasonNumber),
        totalSeasons: seasons.length,
        totalEpisodes: episodes.length,
        metadataSource: 'provider',
        subtitlesAvailable: false,
        audioLanguages: [],
        addedAt: now,
        updatedAt: now,
      });
    }
    
    // Store in vodStore
    if (movies.length > 0) {
      useVodStore.getState().addMovies(movies);
    }
    if (series.length > 0) {
      useVodStore.getState().addSeries(series);
    }
    
    return { movieCount: movies.length, seriesCount: series.length };
  }
  
  /**
   * Clean VOD title by removing year, quality tags, etc.
   */
  private cleanVodTitle(title: string): string {
    return title
      .replace(/[\(\[]?\b(19[5-9]\d|20[0-3]\d)\b[\)\]]?/g, '') // Remove year
      .replace(/\b(720p|1080p|4k|uhd|hd|sd)\b/gi, '') // Remove quality
      .replace(/\bS\d{1,2}\s*E\d{1,3}\b/gi, '') // Remove S01E01
      .replace(/\s*[-–—:]\s*$/g, '') // Remove trailing separators
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Extract series title from episode name
   */
  private extractSeriesTitle(name: string): string {
    // Remove common patterns: S01E01, Season 1 Episode 1, etc.
    let title = name
      .replace(/\bS\d{1,2}\s*E\d{1,3}\b/gi, '')
      .replace(/\b(?:Season|Säsong)\s*\d{1,2}/gi, '')
      .replace(/\b(?:Episode|Avsnitt|Ep)\s*\d{1,3}/gi, '')
      .replace(/[\(\[]?\b(19[5-9]\d|20[0-3]\d)\b[\)\]]?/g, '') // Remove year
      .replace(/\s*[-–—:]\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // If we removed everything, use original
    if (!title || title.length < 2) {
      title = name;
    }
    
    return title;
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
