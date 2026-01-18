/**
 * Import Worker - Parses and classifies M3U content into Live/Movies/Series
 * Runs off main thread to prevent UI freezing
 */

import { parseM3U } from '../core/parser/m3uParser';
import { 
  categorizePlaylist, 
  buildSeriesStructure, 
  extractYear, 
  cleanTitle,
  type DetectedContent,
  type ContentType,
} from '../core/parser/vodDetector';
import { buildChannelIndex } from '../core/indexing/channelIndex';
import type { CoreChannel, ParsedM3UItem } from '../core/types';
import type { Movie, Series, Season, Episode } from '../types/vod';

// ============= Message Types =============

export interface ImportWorkerRequest {
  type: 'IMPORT_M3U';
  payload: {
    content: string;
    providerId: string;
    providerName: string;
  };
  requestId: string;
}

export interface ImportWorkerResponse {
  type: 'IMPORT_COMPLETE' | 'IMPORT_ERROR' | 'IMPORT_PROGRESS';
  requestId: string;
  payload?: ImportResult;
  progress?: { stage: string; percent: number };
  error?: string;
}

export interface ImportResult {
  channels: CoreChannel[];
  channelIndex: {
    byGroup: [string, string[]][];
    groups: string[];
    searchTokens: [string, string[]][];
  };
  movies: Movie[];
  series: Series[];
  unknown: DetectedContent[];
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
}

// ============= Helpers =============

function generateId(prefix: string, providerId: string, ...parts: (string | number)[]): string {
  const combined = [providerId, ...parts].join('-');
  // Simple hash
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${prefix}-${providerId.slice(0, 8)}-${Math.abs(hash).toString(36)}`;
}

function convertToMovie(
  detected: DetectedContent, 
  providerId: string
): Movie {
  const item = detected.item;
  const year = detected.year || extractYear(item.name);
  const title = cleanTitle(item.name);
  
  // Extract genre from group if possible
  const genres: string[] = [];
  if (item.group && item.group !== 'Uncategorized') {
    // Try to extract genre from group name
    const groupLower = item.group.toLowerCase();
    const genrePatterns = [
      'action', 'comedy', 'drama', 'horror', 'thriller', 'romance', 
      'sci-fi', 'scifi', 'fantasy', 'documentary', 'animation',
      'adventure', 'crime', 'mystery', 'western', 'war', 'family'
    ];
    for (const genre of genrePatterns) {
      if (groupLower.includes(genre)) {
        genres.push(genre.charAt(0).toUpperCase() + genre.slice(1));
      }
    }
    if (genres.length === 0) {
      genres.push(item.group);
    }
  } else {
    genres.push('Uncategorized');
  }
  
  return {
    id: generateId('movie', providerId, item.name, item.url),
    providerId,
    type: 'movie',
    title,
    year,
    genres,
    description: undefined,
    posterUrl: item.logo,
    backdropUrl: undefined,
    duration: undefined,
    rating: undefined,
    streamUrl: item.url,
    metadataSource: 'provider',
    subtitlesAvailable: false,
    audioLanguages: ['und'],
    addedAt: new Date(),
    updatedAt: new Date(),
  };
}

function convertToSeries(
  title: string,
  seasonsData: Map<number, DetectedContent[]>,
  providerId: string
): Series {
  const firstEpisode = Array.from(seasonsData.values())[0]?.[0];
  const item = firstEpisode?.item;
  
  // Build seasons
  const seasons: Season[] = [];
  let totalEpisodes = 0;
  
  for (const [seasonNum, episodes] of Array.from(seasonsData.entries()).sort((a, b) => a[0] - b[0])) {
    const seasonEpisodes: Episode[] = episodes.map((ep, idx) => {
      totalEpisodes++;
      return {
        id: generateId('ep', providerId, title, seasonNum, ep.episodeNumber || idx + 1),
        providerId,
        type: 'episode',
        title: ep.episodeTitle || `Avsnitt ${ep.episodeNumber || idx + 1}`,
        episodeTitle: ep.episodeTitle,
        seriesId: generateId('series', providerId, title),
        seasonNumber: seasonNum,
        episodeNumber: ep.episodeNumber || idx + 1,
        duration: undefined,
        streamUrl: ep.item.url,
        genres: [],
        description: undefined,
        posterUrl: ep.item.logo,
        metadataSource: 'provider',
        subtitlesAvailable: false,
        audioLanguages: ['und'],
        addedAt: new Date(),
        updatedAt: new Date(),
      };
    });
    
    seasons.push({
      id: generateId('season', providerId, title, seasonNum),
      seriesId: generateId('series', providerId, title),
      seasonNumber: seasonNum,
      title: `Säsong ${seasonNum}`,
      posterUrl: item?.logo,
      episodes: seasonEpisodes,
      episodeCount: seasonEpisodes.length,
    });
  }
  
  // Extract genre from first episode's group
  const genres: string[] = item?.group && item.group !== 'Uncategorized' 
    ? [item.group] 
    : ['Uncategorized'];
  
  return {
    id: generateId('series', providerId, title),
    providerId,
    type: 'series',
    title,
    year: firstEpisode?.year,
    genres,
    description: undefined,
    posterUrl: item?.logo,
    backdropUrl: undefined,
    rating: undefined,
    metadataSource: 'provider',
    subtitlesAvailable: false,
    audioLanguages: ['und'],
    addedAt: new Date(),
    updatedAt: new Date(),
    totalSeasons: seasons.length,
    totalEpisodes,
    seasons,
  };
}

// ============= Worker Handler =============

self.onmessage = (event: MessageEvent<ImportWorkerRequest>) => {
  const { type, payload, requestId } = event.data;
  
  if (type !== 'IMPORT_M3U') {
    self.postMessage({
      type: 'IMPORT_ERROR',
      requestId,
      error: `Unknown message type: ${type}`,
    });
    return;
  }
  
  try {
    const startTime = performance.now();
    
    // Progress: Parsing
    self.postMessage({
      type: 'IMPORT_PROGRESS',
      requestId,
      progress: { stage: 'Parsar spellista...', percent: 10 },
    });
    
    // Parse M3U content
    const parsed = parseM3U(payload.content);
    const parseTimeMs = performance.now() - startTime;
    
    console.log(`[importWorker] Parsed ${parsed.items.length} items in ${parseTimeMs.toFixed(0)}ms`);
    
    // Progress: Classifying
    self.postMessage({
      type: 'IMPORT_PROGRESS',
      requestId,
      progress: { stage: 'Klassificerar innehåll...', percent: 30 },
    });
    
    // Categorize into live/movies/series
    const categorized = categorizePlaylist(parsed.items);
    
    console.log(`[importWorker] Categorized: ${categorized.live.length} live, ${categorized.movies.length} movies, ${categorized.series.length} series, ${categorized.unknown.length} unknown`);
    
    // Progress: Building channel index
    self.postMessage({
      type: 'IMPORT_PROGRESS',
      requestId,
      progress: { stage: 'Bygger kanalindex...', percent: 50 },
    });
    
    // Build channel index for live channels
    const { channels, index: channelIndex } = buildChannelIndex(categorized.live, payload.providerId);
    
    // Progress: Building series structure
    self.postMessage({
      type: 'IMPORT_PROGRESS',
      requestId,
      progress: { stage: 'Bygger seriestruktur...', percent: 70 },
    });
    
    // Convert movies
    const movies: Movie[] = categorized.movies.map(m => convertToMovie(m, payload.providerId));
    
    // Build proper series structure with seasons and episodes
    const seriesStructure = buildSeriesStructure(categorized.series, payload.providerId);
    const series: Series[] = [];
    let seasonCount = 0;
    let episodeCount = 0;
    
    for (const [_, data] of seriesStructure) {
      const s = convertToSeries(data.title, data.seasons, payload.providerId);
      series.push(s);
      seasonCount += s.totalSeasons || 0;
      episodeCount += s.totalEpisodes || 0;
    }
    
    console.log(`[importWorker] Built ${series.length} series with ${seasonCount} seasons, ${episodeCount} episodes`);
    
    // Progress: Complete
    self.postMessage({
      type: 'IMPORT_PROGRESS',
      requestId,
      progress: { stage: 'Slutför...', percent: 90 },
    });
    
    const processTimeMs = performance.now() - startTime;
    
    // Send result
    const result: ImportResult = {
      channels,
      channelIndex: {
        byGroup: Array.from(channelIndex.byGroup.entries()),
        groups: channelIndex.groups,
        searchTokens: Array.from(channelIndex.searchTokens.entries()).map(
          ([key, set]) => [key, Array.from(set)]
        ),
      },
      movies,
      series,
      unknown: categorized.unknown,
      stats: {
        total: parsed.items.length,
        liveCount: channels.length,
        movieCount: movies.length,
        seriesCount: series.length,
        seasonCount,
        episodeCount,
        unknownCount: categorized.unknown.length,
        parseTimeMs,
        processTimeMs,
      },
    };
    
    self.postMessage({
      type: 'IMPORT_COMPLETE',
      requestId,
      payload: result,
    });
    
  } catch (error) {
    console.error('[importWorker] Error:', error);
    self.postMessage({
      type: 'IMPORT_ERROR',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
