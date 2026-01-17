/**
 * VOD Detector - Identifies movies and series from M3U entries
 * Based on group-title patterns and URL analysis
 */

import type { ParsedM3UItem } from '../types';

export type ContentType = 'live' | 'movie' | 'series';

export interface DetectedContent {
  type: ContentType;
  item: ParsedM3UItem;
  // Extracted metadata for VOD
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  seriesTitle?: string;
}

// Patterns that indicate VOD content (movies)
const MOVIE_GROUP_PATTERNS = [
  /\bvod\b/i,
  /\bmovie/i,
  /\bfilm/i,
  /\bcinema/i,
  /\b(4k|uhd)\s*(movies?|films?)/i,
  /\bpremiere/i,
  /\bbiograf/i, // Swedish
  /\bpelícula/i, // Spanish
];

// Patterns that indicate series content
const SERIES_GROUP_PATTERNS = [
  /\bseries\b/i,
  /\bserie\b/i,
  /\btv\s*shows?\b/i,
  /\bepisode/i,
  /\bseasons?\b/i,
  /\bserier\b/i, // Swedish
];

// URL patterns that indicate VOD
const VOD_URL_PATTERNS = [
  /\/movie\//i,
  /\/movies\//i,
  /\/vod\//i,
  /\/film\//i,
  /\/series\//i,
  /\.(mkv|avi|mp4|m4v)$/i, // Video file extensions
];

// URL patterns that indicate live streams
const LIVE_URL_PATTERNS = [
  /\/live\//i,
  /\.ts$/i,
  /\.m3u8$/i,
];

// Regex to extract year from title: "Movie Name (2023)" or "Movie Name 2023"
const YEAR_REGEX = /[\(\[]?\b(19[5-9]\d|20[0-3]\d)\b[\)\]]?/;

// Regex to extract season/episode: "S01E05", "Season 1 Episode 5", etc.
const SEASON_EPISODE_REGEX = /\bS(\d{1,2})\s*E(\d{1,3})\b/i;
const SEASON_ONLY_REGEX = /\b(?:Season|Säsong|S)\s*(\d{1,2})\b/i;
const EPISODE_ONLY_REGEX = /\b(?:Episode|Avsnitt|E|Ep)\s*(\d{1,3})\b/i;

/**
 * Detect if a group name indicates VOD content
 */
export function detectContentTypeFromGroup(group: string): ContentType {
  const groupLower = group.toLowerCase();
  
  // Check for series first (more specific)
  for (const pattern of SERIES_GROUP_PATTERNS) {
    if (pattern.test(groupLower)) {
      return 'series';
    }
  }
  
  // Check for movies
  for (const pattern of MOVIE_GROUP_PATTERNS) {
    if (pattern.test(groupLower)) {
      return 'movie';
    }
  }
  
  return 'live';
}

/**
 * Detect content type from URL patterns
 */
export function detectContentTypeFromUrl(url: string): ContentType | null {
  // Check for live patterns first
  for (const pattern of LIVE_URL_PATTERNS) {
    if (pattern.test(url)) {
      return 'live';
    }
  }
  
  // Check for VOD patterns
  for (const pattern of VOD_URL_PATTERNS) {
    if (pattern.test(url)) {
      // Distinguish movie vs series based on URL path
      if (/\/series\//i.test(url)) {
        return 'series';
      }
      return 'movie';
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
    // Only accept years from 1950 to current year + 2
    const currentYear = new Date().getFullYear();
    if (year >= 1950 && year <= currentYear + 2) {
      return year;
    }
  }
  return undefined;
}

/**
 * Extract season and episode numbers
 */
export function extractSeasonEpisode(title: string): { season?: number; episode?: number; cleanTitle?: string } {
  // Try S01E05 format first
  const seMatch = SEASON_EPISODE_REGEX.exec(title);
  if (seMatch) {
    const cleanTitle = title.replace(SEASON_EPISODE_REGEX, '').trim();
    return {
      season: parseInt(seMatch[1], 10),
      episode: parseInt(seMatch[2], 10),
      cleanTitle,
    };
  }
  
  // Try separate patterns
  const seasonMatch = SEASON_ONLY_REGEX.exec(title);
  const episodeMatch = EPISODE_ONLY_REGEX.exec(title);
  
  if (seasonMatch || episodeMatch) {
    let cleanTitle = title;
    if (seasonMatch) {
      cleanTitle = cleanTitle.replace(SEASON_ONLY_REGEX, '').trim();
    }
    if (episodeMatch) {
      cleanTitle = cleanTitle.replace(EPISODE_ONLY_REGEX, '').trim();
    }
    
    return {
      season: seasonMatch ? parseInt(seasonMatch[1], 10) : undefined,
      episode: episodeMatch ? parseInt(episodeMatch[1], 10) : undefined,
      cleanTitle,
    };
  }
  
  return {};
}

/**
 * Clean up title by removing year, season/episode info, and extra whitespace
 */
export function cleanTitle(title: string): string {
  return title
    .replace(YEAR_REGEX, '')
    .replace(SEASON_EPISODE_REGEX, '')
    .replace(/\s*[-–—:]\s*$/, '') // Remove trailing dashes/colons
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Main detection function - analyzes an M3U item and determines its content type
 */
export function detectContent(item: ParsedM3UItem): DetectedContent {
  // First try to detect from group
  let type = detectContentTypeFromGroup(item.group);
  
  // If still live, try URL patterns
  if (type === 'live') {
    const urlType = detectContentTypeFromUrl(item.url);
    if (urlType && urlType !== 'live') {
      type = urlType;
    }
  }
  
  // Extract metadata for VOD content
  if (type === 'movie' || type === 'series') {
    const year = extractYear(item.name);
    const { season, episode, cleanTitle: seriesTitle } = extractSeasonEpisode(item.name);
    
    // If we found season/episode info, it's definitely a series
    if (season !== undefined || episode !== undefined) {
      type = 'series';
    }
    
    return {
      type,
      item,
      year,
      seasonNumber: season,
      episodeNumber: episode,
      seriesTitle: type === 'series' ? (seriesTitle || cleanTitle(item.name)) : undefined,
    };
  }
  
  return { type, item };
}

/**
 * Batch detect content types for all items
 */
export function categorizePlaylist(items: ParsedM3UItem[]): {
  live: ParsedM3UItem[];
  movies: DetectedContent[];
  series: DetectedContent[];
} {
  const live: ParsedM3UItem[] = [];
  const movies: DetectedContent[] = [];
  const series: DetectedContent[] = [];
  
  for (const item of items) {
    const detected = detectContent(item);
    
    switch (detected.type) {
      case 'movie':
        movies.push(detected);
        break;
      case 'series':
        series.push(detected);
        break;
      default:
        live.push(item);
    }
  }
  
  return { live, movies, series };
}
