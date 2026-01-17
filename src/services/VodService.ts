/**
 * VOD Service - Fetches movies and series from Xtream Codes providers
 */

import { supabase } from '@/integrations/supabase/client';
import { useVodStore } from '@/data/stores/vodStore';
import type { Movie, Series, Season, Episode } from '@/types/vod';

export interface VodLoadResult {
  success: boolean;
  movieCount: number;
  seriesCount: number;
  error?: string;
}

interface XtreamVodItem {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  category_id: string;
  container_extension: string;
  // Movie specific
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  duration?: string;
  duration_secs?: number;
  backdrop_path?: string[];
}

interface XtreamSeriesItem {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  category_id: string;
}

interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

class VodServiceClass {
  /**
   * Load VOD (movies) from Xtream provider
   */
  async loadMovies(host: string, username: string, password: string, providerId: string): Promise<VodLoadResult> {
    try {
      console.log('[VodService] Loading movies from Xtream...');
      useVodStore.getState().setLoading(true);

      // Fetch VOD streams
      const { data, error } = await supabase.functions.invoke('playlist-proxy', {
        body: { host, username, password, type: 'xtream_vod' }
      });

      if (error || !data.success) {
        throw new Error(error?.message || data?.error || 'Failed to fetch VOD');
      }

      const items: XtreamVodItem[] = data.data || [];
      console.log(`[VodService] Received ${items.length} VOD items`);

      // Convert to Movie type
      const movies: Movie[] = items.slice(0, 500).map(item => this.convertXtreamToMovie(item, host, username, password, providerId));

      useVodStore.getState().setMovies(movies);

      return {
        success: true,
        movieCount: movies.length,
        seriesCount: 0,
      };

    } catch (error) {
      console.error('[VodService] Error loading movies:', error);
      return {
        success: false,
        movieCount: 0,
        seriesCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      useVodStore.getState().setLoading(false);
    }
  }

  /**
   * Load Series from Xtream provider
   */
  async loadSeries(host: string, username: string, password: string, providerId: string): Promise<VodLoadResult> {
    try {
      console.log('[VodService] Loading series from Xtream...');
      useVodStore.getState().setLoading(true);

      // Fetch series list
      const { data, error } = await supabase.functions.invoke('playlist-proxy', {
        body: { host, username, password, type: 'xtream_series' }
      });

      if (error || !data.success) {
        throw new Error(error?.message || data?.error || 'Failed to fetch series');
      }

      const items: XtreamSeriesItem[] = data.data || [];
      console.log(`[VodService] Received ${items.length} series items`);

      // Convert to Series type (limit to first 200 for performance)
      const series: Series[] = items.slice(0, 200).map(item => this.convertXtreamToSeries(item, host, username, password, providerId));

      useVodStore.getState().setSeries(series);

      return {
        success: true,
        movieCount: 0,
        seriesCount: series.length,
      };

    } catch (error) {
      console.error('[VodService] Error loading series:', error);
      return {
        success: false,
        movieCount: 0,
        seriesCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      useVodStore.getState().setLoading(false);
    }
  }

  private convertXtreamToMovie(item: XtreamVodItem, host: string, username: string, password: string, providerId: string): Movie {
    const cleanHost = host.replace(/\/+$/, '');
    const streamUrl = `${cleanHost}/movie/${username}/${password}/${item.stream_id}.${item.container_extension || 'mp4'}`;
    
    const genres = item.genre 
      ? item.genre.split(',').map(g => g.trim()).filter(Boolean)
      : ['Uncategorized'];

    const year = item.releaseDate 
      ? parseInt(item.releaseDate.substring(0, 4), 10) 
      : undefined;

    return {
      id: `movie-${providerId}-${item.stream_id}`,
      providerId,
      type: 'movie',
      title: item.name,
      year,
      genres,
      description: item.plot,
      posterUrl: item.stream_icon,
      backdropUrl: item.backdrop_path?.[0],
      duration: item.duration_secs ? Math.round(item.duration_secs / 60) : undefined,
      rating: item.rating_5based ? item.rating_5based * 2 : undefined,
      streamUrl,
      director: item.director,
      cast: item.cast?.split(',').map(c => c.trim()),
      metadataSource: 'provider',
      subtitlesAvailable: false,
      audioLanguages: ['und'],
      addedAt: item.added ? new Date(parseInt(item.added) * 1000) : new Date(),
      updatedAt: new Date(),
    };
  }

  private convertXtreamToSeries(item: XtreamSeriesItem, host: string, username: string, password: string, providerId: string): Series {
    const genres = item.genre 
      ? item.genre.split(',').map(g => g.trim()).filter(Boolean)
      : ['Uncategorized'];

    const year = item.releaseDate 
      ? parseInt(item.releaseDate.substring(0, 4), 10) 
      : undefined;

    // Note: To get full episode list, we'd need to call get_series_info for each series
    // For now, we create empty seasons (can be lazy-loaded)
    return {
      id: `series-${providerId}-${item.series_id}`,
      providerId,
      type: 'series',
      title: item.name,
      year,
      genres,
      description: item.plot,
      posterUrl: item.cover,
      backdropUrl: item.backdrop_path?.[0],
      rating: item.rating_5based ? item.rating_5based * 2 : undefined,
      metadataSource: 'provider',
      subtitlesAvailable: false,
      audioLanguages: ['und'],
      addedAt: item.last_modified ? new Date(item.last_modified) : new Date(),
      updatedAt: new Date(),
      totalSeasons: 0,
      totalEpisodes: 0,
      seasons: [],
    };
  }

  /**
   * Load full series info including episodes
   */
  async loadSeriesInfo(seriesId: string, host: string, username: string, password: string): Promise<Series | null> {
    try {
      const numericId = seriesId.split('-').pop();
      const cleanHost = host.replace(/\/+$/, '');
      
      const { data, error } = await supabase.functions.invoke('playlist-proxy', {
        body: { 
          host, 
          username, 
          password, 
          type: 'xtream_live', // Use generic action
          action: `get_series_info&series_id=${numericId}`
        }
      });

      if (error || !data.success) {
        console.error('[VodService] Failed to load series info:', error || data?.error);
        return null;
      }

      const info = data.data;
      if (!info || !info.episodes) return null;

      const seasons: Season[] = Object.keys(info.episodes).map(seasonNum => {
        const seasonEpisodes = info.episodes[seasonNum] || [];
        return {
          id: `season-${seriesId}-${seasonNum}`,
          seriesId,
          seasonNumber: parseInt(seasonNum, 10),
          title: `Season ${seasonNum}`,
          episodeCount: seasonEpisodes.length,
          episodes: seasonEpisodes.map((ep: any, idx: number) => ({
            id: `episode-${seriesId}-${seasonNum}-${ep.id}`,
            providerId: seriesId.split('-')[1],
            type: 'episode' as const,
            title: ep.title || `Episode ${ep.episode_num}`,
            episodeTitle: ep.title,
            seriesId,
            seasonNumber: parseInt(seasonNum, 10),
            episodeNumber: ep.episode_num || idx + 1,
            duration: ep.duration_secs ? Math.round(ep.duration_secs / 60) : undefined,
            streamUrl: `${cleanHost}/series/${username}/${password}/${ep.id}.${ep.container_extension || 'mp4'}`,
            genres: [],
            metadataSource: 'provider' as const,
            subtitlesAvailable: false,
            audioLanguages: ['und'],
            addedAt: new Date(),
            updatedAt: new Date(),
          })),
        };
      });

      return {
        ...useVodStore.getState().series.find(s => s.id === seriesId)!,
        seasons,
        totalSeasons: seasons.length,
        totalEpisodes: seasons.reduce((sum, s) => sum + s.episodeCount, 0),
      };

    } catch (error) {
      console.error('[VodService] Error loading series info:', error);
      return null;
    }
  }
}

export const VodService = new VodServiceClass();
