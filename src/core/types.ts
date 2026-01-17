/**
 * Core types for StreamVault - Pure TypeScript, no React dependencies
 * These types form the foundation of the data engine layer
 */

// ============= Channel Types =============

export interface CoreChannel {
  id: string;
  providerId: string;
  channelId: string;
  name: string;
  nameLower: string; // Pre-computed for search
  group: string;
  groupLower: string; // Pre-computed for search
  logoUrl?: string;
  streamUrl: string;
  epgId?: string;
  number?: number;
  isHD: boolean;
}

export interface ChannelIndex {
  byId: Map<string, CoreChannel>;
  byGroup: Map<string, string[]>; // group -> channel ids
  byProvider: Map<string, string[]>; // provider -> channel ids
  searchTokens: Map<string, Set<string>>; // token -> channel ids
  allIds: string[];
  groups: string[];
}

// ============= EPG Types =============

export interface CoreEpgProgram {
  id: string;
  channelId: string;
  start: number; // Unix timestamp for fast comparison
  end: number;
  title: string;
  description?: string;
  category?: string;
}

export interface EpgDaySegment {
  date: string; // YYYY-MM-DD
  programs: CoreEpgProgram[];
}

export interface EpgIndex {
  byChannelId: Map<string, CoreEpgProgram[]>;
  byChannelAndDay: Map<string, EpgDaySegment>; // "channelId:YYYY-MM-DD" -> segment
  nowNextCache: Map<string, { now?: CoreEpgProgram; next?: CoreEpgProgram }>;
  lastUpdated: number;
}

// ============= Provider Types =============

export interface CoreProvider {
  id: string;
  name: string;
  type: 'm3u' | 'xtream';
  m3uUrl?: string;
  xtreamHost?: string;
  xtreamUser?: string;
  epgUrl?: string;
  lastSync?: number;
  channelCount: number;
  isActive: boolean;
}

// ============= M3U Parser Types =============

export interface ParsedM3UItem {
  name: string;
  group: string;
  logo?: string;
  url: string;
  tvgId?: string;
  tvgName?: string;
  extras: Record<string, string>;
}

export interface ParsedPlaylist {
  items: ParsedM3UItem[];
  groups: string[];
  totalCount: number;
  parseTimeMs: number;
}

// ============= Worker Message Types =============

export interface WorkerMessage<T = unknown> {
  type: string;
  payload: T;
  requestId: string;
}

export interface WorkerResponse<T = unknown> {
  type: string;
  payload: T;
  requestId: string;
  error?: string;
  timing?: { parseMs: number; indexMs: number };
}

// Playlist Worker
export interface ParsePlaylistRequest {
  content: string;
  providerId: string;
}

export interface ParsePlaylistResponse {
  channels: CoreChannel[];
  index: {
    byGroup: [string, string[]][];
    groups: string[];
    searchTokens: [string, string[]][];
  };
}

// EPG Worker  
export interface ParseEpgRequest {
  content: string;
  channelMapping: [string, string][]; // epgId -> channelId
}

export interface ParseEpgResponse {
  programs: CoreEpgProgram[];
  byChannelId: [string, CoreEpgProgram[]][];
}

// ============= Performance Metrics =============

export interface PerformanceMetrics {
  coldStartMs?: number;
  lastRenderMs?: number;
  workerParseMs?: number;
  cacheHitRatio: number;
  cacheHits: number;
  cacheMisses: number;
  playerErrors: number;
  playerReconnects: number;
  memoryUsageMB?: number;
}

// ============= View Models (for UI layer) =============

export interface ChannelViewModel {
  id: string;
  name: string;
  group: string;
  logoUrl?: string;
  isHD: boolean;
  isFavorite: boolean;
  nowPlaying?: string;
  nextUp?: string;
}

export interface EpgGridViewModel {
  channels: { id: string; name: string; logoUrl?: string }[];
  timeSlots: number[]; // Unix timestamps for column headers
  programs: Map<string, { left: number; width: number; program: CoreEpgProgram }[]>;
}
