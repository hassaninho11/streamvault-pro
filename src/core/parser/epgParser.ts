/**
 * EPG/XMLTV Parser - Pure TypeScript, runs in Web Worker
 * Optimized for parsing large EPG files
 */

import type { CoreEpgProgram } from '../types';

interface RawEpgProgram {
  channel: string;
  start: string;
  stop: string;
  title: string;
  desc?: string;
  category?: string;
}

/**
 * Parse XMLTV format EPG content
 * Uses regex-based parsing for performance (faster than DOM parsing for large files)
 */
export function parseXMLTV(content: string): { programs: RawEpgProgram[]; parseTimeMs: number } {
  const startTime = performance.now();
  const programs: RawEpgProgram[] = [];
  
  // Match programme elements
  const programmeRegex = /<programme\s+start="([^"]+)"\s+stop="([^"]+)"\s+channel="([^"]+)"[^>]*>([\s\S]*?)<\/programme>/gi;
  const titleRegex = /<title[^>]*>([^<]*)<\/title>/i;
  const descRegex = /<desc[^>]*>([^<]*)<\/desc>/i;
  const categoryRegex = /<category[^>]*>([^<]*)<\/category>/i;
  
  let match: RegExpExecArray | null;
  
  while ((match = programmeRegex.exec(content)) !== null) {
    const [, start, stop, channel, inner] = match;
    
    const titleMatch = titleRegex.exec(inner);
    if (!titleMatch) continue;
    
    const descMatch = descRegex.exec(inner);
    const categoryMatch = categoryRegex.exec(inner);
    
    programs.push({
      channel,
      start,
      stop,
      title: decodeXmlEntities(titleMatch[1]),
      desc: descMatch ? decodeXmlEntities(descMatch[1]) : undefined,
      category: categoryMatch ? decodeXmlEntities(categoryMatch[1]) : undefined,
    });
  }
  
  return {
    programs,
    parseTimeMs: performance.now() - startTime,
  };
}

/**
 * Convert raw EPG programs to CoreEpgProgram with channel ID mapping
 */
export function mapEpgToChannels(
  rawPrograms: RawEpgProgram[],
  channelMapping: Map<string, string> // epgId -> channelId
): CoreEpgProgram[] {
  const programs: CoreEpgProgram[] = [];
  
  for (const raw of rawPrograms) {
    const channelId = channelMapping.get(raw.channel);
    if (!channelId) continue;
    
    const start = parseXmltvDate(raw.start);
    const end = parseXmltvDate(raw.stop);
    
    if (start && end) {
      programs.push({
        id: `${channelId}-${start}`,
        channelId,
        start,
        end,
        title: raw.title,
        description: raw.desc,
        category: raw.category,
      });
    }
  }
  
  // Sort by start time
  programs.sort((a, b) => a.start - b.start);
  
  return programs;
}

/**
 * Parse XMLTV date format: YYYYMMDDHHmmss +ZZZZ
 */
function parseXmltvDate(dateStr: string): number | null {
  try {
    // Format: 20240115120000 +0100
    const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
    if (!match) return null;
    
    const [, year, month, day, hour, min, sec, tz] = match;
    
    let isoString = `${year}-${month}-${day}T${hour}:${min}:${sec}`;
    if (tz) {
      isoString += `${tz.slice(0, 3)}:${tz.slice(3)}`;
    } else {
      isoString += 'Z';
    }
    
    return new Date(isoString).getTime();
  } catch {
    return null;
  }
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Build EPG index by channel ID
 */
export function buildEpgIndex(
  programs: CoreEpgProgram[]
): Map<string, CoreEpgProgram[]> {
  const index = new Map<string, CoreEpgProgram[]>();
  
  for (const program of programs) {
    const existing = index.get(program.channelId);
    if (existing) {
      existing.push(program);
    } else {
      index.set(program.channelId, [program]);
    }
  }
  
  return index;
}

/**
 * Get now/next programs for a channel
 */
export function getNowNext(
  programs: CoreEpgProgram[],
  now: number = Date.now()
): { now?: CoreEpgProgram; next?: CoreEpgProgram } {
  let nowProgram: CoreEpgProgram | undefined;
  let nextProgram: CoreEpgProgram | undefined;
  
  for (const program of programs) {
    if (program.start <= now && program.end > now) {
      nowProgram = program;
    } else if (program.start > now && !nextProgram) {
      nextProgram = program;
      break; // Programs are sorted, so we can break after finding next
    }
  }
  
  return { now: nowProgram, next: nextProgram };
}
