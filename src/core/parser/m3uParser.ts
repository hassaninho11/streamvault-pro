/**
 * M3U Parser - Pure TypeScript, runs in Web Worker
 * Optimized for parsing large playlists (10k+ channels)
 * Now with VOD detection and separation
 */

import type { ParsedM3UItem, ParsedPlaylist } from '../types';
import { categorizePlaylist, type DetectedContent } from './vodDetector';

const EXTINF_REGEX = /^#EXTINF:(-?\d*\.?\d*)\s*,(.*)$/;
const ATTR_REGEX = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

/**
 * Extended playlist result with VOD separation
 */
export interface CategorizedPlaylist extends ParsedPlaylist {
  liveItems: ParsedM3UItem[];
  movieItems: DetectedContent[];
  seriesItems: DetectedContent[];
}

/**
 * Parse M3U content into structured data
 * Uses streaming approach to handle large files efficiently
 */
export function parseM3U(content: string): ParsedPlaylist {
  const startTime = performance.now();
  const items: ParsedM3UItem[] = [];
  const groupsSet = new Set<string>();
  
  const lines = content.split(/\r?\n/);
  let currentItem: Partial<ParsedM3UItem> | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line || line === '#EXTM3U') continue;
    
    if (line.startsWith('#EXTINF:')) {
      currentItem = parseExtInf(line);
    } else if (line.startsWith('#')) {
      // Skip other directives
      continue;
    } else if (currentItem && line.length > 0) {
      // This is the URL
      currentItem.url = line;
      
      if (currentItem.name && currentItem.url) {
        const item: ParsedM3UItem = {
          name: currentItem.name,
          group: currentItem.group || 'Uncategorized',
          logo: currentItem.logo,
          url: currentItem.url,
          tvgId: currentItem.tvgId,
          tvgName: currentItem.tvgName,
          extras: currentItem.extras || {},
        };
        
        items.push(item);
        groupsSet.add(item.group);
      }
      
      currentItem = null;
    }
  }
  
  const parseTimeMs = performance.now() - startTime;
  
  return {
    items,
    groups: Array.from(groupsSet).sort(),
    totalCount: items.length,
    parseTimeMs,
  };
}

/**
 * Parse M3U and categorize into live/movies/series
 */
export function parseM3UWithCategories(content: string): CategorizedPlaylist {
  const basic = parseM3U(content);
  const categorized = categorizePlaylist(basic.items);
  
  console.log(`[m3uParser] Categorized: ${categorized.live.length} live, ${categorized.movies.length} movies, ${categorized.series.length} series`);
  
  return {
    ...basic,
    liveItems: categorized.live,
    movieItems: categorized.movies,
    seriesItems: categorized.series,
  };
}

function parseExtInf(line: string): Partial<ParsedM3UItem> {
  const extras: Record<string, string> = {};
  
  // Extract attributes
  let match: RegExpExecArray | null;
  while ((match = ATTR_REGEX.exec(line)) !== null) {
    extras[match[1].toLowerCase()] = match[2];
  }
  
  // Extract name from end of line
  const commaIndex = line.lastIndexOf(',');
  const name = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : '';
  
  return {
    name,
    group: extras['group-title'] || extras['group'] || 'Uncategorized',
    logo: extras['tvg-logo'] || extras['logo'],
    tvgId: extras['tvg-id'],
    tvgName: extras['tvg-name'],
    extras,
  };
}

/**
 * Parse Xtream API response to M3U items
 */
export function parseXtreamChannels(
  channels: { stream_id: number; name: string; stream_icon?: string; category_id?: string }[],
  categories: { category_id: string; category_name: string }[],
  baseUrl: string,
  username: string,
  password: string
): ParsedPlaylist {
  const startTime = performance.now();
  const categoryMap = new Map(categories.map(c => [c.category_id, c.category_name]));
  
  const items: ParsedM3UItem[] = channels.map(ch => ({
    name: ch.name,
    group: categoryMap.get(ch.category_id || '') || 'Uncategorized',
    logo: ch.stream_icon,
    url: `${baseUrl}/live/${username}/${password}/${ch.stream_id}.ts`,
    extras: {},
  }));
  
  const groups = Array.from(new Set(items.map(i => i.group))).sort();
  
  return {
    items,
    groups,
    totalCount: items.length,
    parseTimeMs: performance.now() - startTime,
  };
}
