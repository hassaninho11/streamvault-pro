/**
 * VOD Detector - Identifies movies and series from M3U entries
 * Enhanced heuristics for accurate classification
 */

import type { ParsedM3UItem } from '../types';

export type ContentType = 'live' | 'movie' | 'series' | 'unknown';

export interface DetectedContent {
  type: ContentType;
  item: ParsedM3UItem;
  // Extracted metadata for VOD
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  seriesTitle?: string;
  episodeTitle?: string;
  confidence: number; // 0-100 confidence score
}

export interface ClassificationRule {
  id: string;
  pattern: string;
  type: 'regex' | 'contains' | 'group';
  targetType: ContentType;
  enabled: boolean;
}

// ============= Priority 1: tvg-type attribute =============
const TVG_TYPE_MAP: Record<string, ContentType> = {
  'vod': 'movie',
  'movie': 'movie',
  'movies': 'movie',
  'film': 'movie',
  'series': 'series',
  'serie': 'series',
  'episode': 'series',
  'tv-show': 'series',
  'tvshow': 'series',
  'live': 'live',
  'channel': 'live',
  'tv': 'live',
};

// ============= Priority 2: Group title patterns =============

// Patterns that indicate LIVE content
const LIVE_GROUP_PATTERNS = [
  /\blive\b/i,
  /\btv\b(?!\s*show)/i,
  /\bchannels?\b/i,
  /\bsports?\b/i,
  /\bnews\b/i,
  /\b(sweden|usa|uk|germany|france|spain|italy)\b/i,
  /\bmusic\b/i,
  /\bradio\b/i,
  /\bppv\b/i,
  /\b24\/7\b/i,
  /\blive\s*(tv|sport|stream)/i,
  /\bkanaler\b/i, // Swedish
  /\bsvenska\b/i, // Swedish
];

// Patterns that indicate VOD/MOVIES content
const MOVIE_GROUP_PATTERNS = [
  /\bvod\b/i,
  /\bmovies?\b/i,
  /\bfilms?\b/i,
  /\bcinema\b/i,
  /\b(4k|uhd|hd)\s*(movies?|films?)/i,
  /\bpremiere\b/i,
  /\bbiograf\b/i, // Swedish
  /\bpelícula/i, // Spanish
  /\bfilmer\b/i, // Swedish
  /\bnollywood\b/i,
  /\bbollywood\b/i,
  /\bhollywood\b/i,
  /\bhorror\b/i,
  /\baction\b/i,
  /\bcomedy\b/i,
  /\bdrama\b/i,
  /\bthriller\b/i,
  /\bromance\b/i,
  /\bsci[\s-]?fi\b/i,
  /\bdocumentar/i,
];

// Patterns that indicate SERIES content
const SERIES_GROUP_PATTERNS = [
  /\bseries\b/i,
  /\bserie\b/i,
  /\btv\s*shows?\b/i,
  /\bepisodes?\b/i,
  /\bseasons?\b/i,
  /\bserier\b/i, // Swedish
  /\bshows?\b(?!.*live)/i,
  /\banime\b/i,
  /\bcartoons?\b/i,
  /\btecknat\b/i, // Swedish (animated)
  /\bdokumentär\s*serier/i, // Swedish doc series
];

// ============= Priority 3: Name patterns for episodes =============

// Robust episode detection patterns
const EPISODE_PATTERNS = [
  // S01E05, S1E5, s01e05
  { regex: /\bS(\d{1,2})\s*E(\d{1,3})\b/i, seasonGroup: 1, episodeGroup: 2 },
  // Season 1 Episode 5, Säsong 1 Avsnitt 5
  { regex: /\b(?:Season|Säsong|Temporada)\s*(\d{1,2}).*?(?:Episode|Avsnitt|Episodio|Ep)\s*(\d{1,3})\b/i, seasonGroup: 1, episodeGroup: 2 },
  // 1x05, 01x05
  { regex: /\b(\d{1,2})x(\d{1,3})\b/i, seasonGroup: 1, episodeGroup: 2 },
  // E05, Ep05, Episode 5 (season assumed 1)
  { regex: /\b(?:E|Ep|Episode|Avsnitt)\s*(\d{1,3})\b/i, seasonGroup: null, episodeGroup: 1 },
  // - 01, - 05 (at end of name, episode only)
  { regex: /\s-\s*(\d{1,3})$/i, seasonGroup: null, episodeGroup: 1 },
];

// ============= Priority 4: URL patterns =============

const VOD_URL_PATTERNS = [
  { pattern: /\/movie\//i, type: 'movie' as ContentType },
  { pattern: /\/movies\//i, type: 'movie' as ContentType },
  { pattern: /\/vod\//i, type: 'movie' as ContentType },
  { pattern: /\/film\//i, type: 'movie' as ContentType },
  { pattern: /\/series\//i, type: 'series' as ContentType },
  { pattern: /\.(mkv|avi|mp4|m4v|mov|wmv)(\?.*)?$/i, type: 'movie' as ContentType },
];

const LIVE_URL_PATTERNS = [
  /\/live\//i,
  /\.ts(\?.*)?$/i,
  /\.m3u8(\?.*)?$/i,
];

// Year extraction: "Movie Name (2023)" or "Movie Name 2023"
const YEAR_REGEX = /[\(\[\s]?(19[5-9]\d|20[0-4]\d)[\)\]\s]?/;

/**
 * Check tvg-type attribute (highest priority)
 */
function detectFromTvgType(extras: Record<string, string>): ContentType | null {
  const tvgType = extras['tvg-type']?.toLowerCase().trim();
  if (tvgType && TVG_TYPE_MAP[tvgType]) {
    return TVG_TYPE_MAP[tvgType];
  }
  return null;
}

/**
 * Detect content type from group name
 */
function detectFromGroup(group: string): { type: ContentType; confidence: number } | null {
  const groupLower = group.toLowerCase();
  
  // Check series patterns first (more specific)
  for (const pattern of SERIES_GROUP_PATTERNS) {
    if (pattern.test(groupLower)) {
      return { type: 'series', confidence: 75 };
    }
  }
  
  // Check movie patterns
  for (const pattern of MOVIE_GROUP_PATTERNS) {
    if (pattern.test(groupLower)) {
      return { type: 'movie', confidence: 70 };
    }
  }
  
  // Check live patterns
  for (const pattern of LIVE_GROUP_PATTERNS) {
    if (pattern.test(groupLower)) {
      return { type: 'live', confidence: 80 };
    }
  }
  
  return null;
}

/**
 * Extract episode information from name
 */
function extractEpisodeInfo(name: string): { 
  season?: number; 
  episode?: number; 
  seriesTitle?: string;
  episodeTitle?: string;
} | null {
  for (const pattern of EPISODE_PATTERNS) {
    const match = pattern.regex.exec(name);
    if (match) {
      let seriesTitle = name.substring(0, match.index).trim();
      let episodeTitle = name.substring(match.index + match[0].length).trim();
      
      // Clean up series title
      seriesTitle = seriesTitle
        .replace(/\s*[-–—:]\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Clean up episode title
      episodeTitle = episodeTitle
        .replace(/^\s*[-–—:]\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      return {
        season: pattern.seasonGroup !== null ? parseInt(match[pattern.seasonGroup], 10) : 1,
        episode: parseInt(match[pattern.episodeGroup], 10),
        seriesTitle: seriesTitle || undefined,
        episodeTitle: episodeTitle || undefined,
      };
    }
  }
  return null;
}

/**
 * Detect content type from URL
 */
function detectFromUrl(url: string): { type: ContentType; confidence: number } | null {
  // Check live patterns first
  for (const pattern of LIVE_URL_PATTERNS) {
    if (pattern.test(url)) {
      return { type: 'live', confidence: 60 };
    }
  }
  
  // Check VOD patterns
  for (const { pattern, type } of VOD_URL_PATTERNS) {
    if (pattern.test(url)) {
      return { type, confidence: 65 };
    }
  }
  
  return null;
}

/**
 * Extract year from title
 */
export function extractYear(title: string): number | undefined {
  const match = YEAR_REGEX.exec(title);
  if (match) {
    const year = parseInt(match[1], 10);
    const currentYear = new Date().getFullYear();
    if (year >= 1950 && year <= currentYear + 2) {
      return year;
    }
  }
  return undefined;
}

/**
 * Clean up title by removing year, season/episode info
 */
export function cleanTitle(title: string): string {
  let clean = title;
  
  // Remove year
  clean = clean.replace(YEAR_REGEX, '');
  
  // Remove episode patterns
  for (const pattern of EPISODE_PATTERNS) {
    clean = clean.replace(pattern.regex, '');
  }
  
  // Clean up
  return clean
    .replace(/\s*[-–—:]\s*$/, '')
    .replace(/^\s*[-–—:]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Main detection function - analyzes an M3U item
 */
export function detectContent(item: ParsedM3UItem): DetectedContent {
  let type: ContentType = 'unknown';
  let confidence = 0;
  let seasonNumber: number | undefined;
  let episodeNumber: number | undefined;
  let seriesTitle: string | undefined;
  let episodeTitle: string | undefined;
  
  // Priority 1: tvg-type attribute (highest confidence)
  const tvgType = detectFromTvgType(item.extras);
  if (tvgType) {
    type = tvgType;
    confidence = 95;
  }
  
  // Priority 2: Group title patterns
  if (type === 'unknown' || confidence < 70) {
    const groupResult = detectFromGroup(item.group);
    if (groupResult && groupResult.confidence > confidence) {
      type = groupResult.type;
      confidence = groupResult.confidence;
    }
  }
  
  // Priority 3: Episode patterns in name (strong indicator for series)
  const episodeInfo = extractEpisodeInfo(item.name);
  if (episodeInfo) {
    type = 'series';
    confidence = Math.max(confidence, 85);
    seasonNumber = episodeInfo.season;
    episodeNumber = episodeInfo.episode;
    seriesTitle = episodeInfo.seriesTitle;
    episodeTitle = episodeInfo.episodeTitle;
  }
  
  // Priority 4: URL patterns (if still undecided or low confidence)
  if (type === 'unknown' || confidence < 60) {
    const urlResult = detectFromUrl(item.url);
    if (urlResult) {
      if (type === 'unknown' || urlResult.confidence > confidence) {
        type = urlResult.type;
        confidence = urlResult.confidence;
      }
    }
  }
  
  // Fallback: if group is empty and name looks like a channel, assume live
  if (type === 'unknown') {
    // Short names without episode patterns are likely live channels
    if (item.name.length < 30 && !episodeInfo) {
      type = 'live';
      confidence = 40;
    } else {
      // Can't determine - mark as unknown for manual sorting
      confidence = 0;
    }
  }
  
  // Extract year for movies
  const year = extractYear(item.name);
  
  return {
    type,
    item,
    year,
    seasonNumber,
    episodeNumber,
    seriesTitle: seriesTitle || (type === 'series' ? cleanTitle(item.name) : undefined),
    episodeTitle,
    confidence,
  };
}

/**
 * Batch detect and categorize all items
 */
export function categorizePlaylist(items: ParsedM3UItem[]): {
  live: ParsedM3UItem[];
  movies: DetectedContent[];
  series: DetectedContent[];
  unknown: DetectedContent[];
  stats: {
    total: number;
    liveCount: number;
    movieCount: number;
    seriesCount: number;
    unknownCount: number;
    avgConfidence: number;
  };
} {
  const live: ParsedM3UItem[] = [];
  const movies: DetectedContent[] = [];
  const series: DetectedContent[] = [];
  const unknown: DetectedContent[] = [];
  let totalConfidence = 0;
  
  for (const item of items) {
    const detected = detectContent(item);
    totalConfidence += detected.confidence;
    
    switch (detected.type) {
      case 'movie':
        movies.push(detected);
        break;
      case 'series':
        series.push(detected);
        break;
      case 'live':
        live.push(item);
        break;
      default:
        unknown.push(detected);
    }
  }
  
  return {
    live,
    movies,
    series,
    unknown,
    stats: {
      total: items.length,
      liveCount: live.length,
      movieCount: movies.length,
      seriesCount: series.length,
      unknownCount: unknown.length,
      avgConfidence: items.length > 0 ? Math.round(totalConfidence / items.length) : 0,
    },
  };
}

/**
 * Group series episodes into proper series/season structure
 */
export function buildSeriesStructure(
  episodes: DetectedContent[],
  providerId: string
): Map<string, {
  title: string;
  seasons: Map<number, DetectedContent[]>;
}> {
  const seriesMap = new Map<string, {
    title: string;
    seasons: Map<number, DetectedContent[]>;
  }>();
  
  for (const episode of episodes) {
    // Generate a consistent series key
    const seriesKey = (episode.seriesTitle || cleanTitle(episode.item.name))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    
    if (!seriesMap.has(seriesKey)) {
      seriesMap.set(seriesKey, {
        title: episode.seriesTitle || cleanTitle(episode.item.name),
        seasons: new Map(),
      });
    }
    
    const seriesData = seriesMap.get(seriesKey)!;
    const seasonNum = episode.seasonNumber || 1;
    
    if (!seriesData.seasons.has(seasonNum)) {
      seriesData.seasons.set(seasonNum, []);
    }
    
    seriesData.seasons.get(seasonNum)!.push(episode);
  }
  
  // Sort episodes within each season
  for (const seriesData of seriesMap.values()) {
    for (const episodes of seriesData.seasons.values()) {
      episodes.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));
    }
  }
  
  return seriesMap;
}
