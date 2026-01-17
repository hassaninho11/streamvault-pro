/**
 * VOD Types for StreamVault - Movies & Series
 */

export type VodType = 'movie' | 'series' | 'season' | 'episode';
export type MetadataSource = 'provider' | 'generated' | 'matched';
export type SubtitleFormat = 'srt' | 'vtt' | 'embedded';
export type SubtitleSource = 'provider' | 'ai_generated' | 'user';

export interface VodItem {
  id: string;
  providerId: string;
  type: VodType;
  title: string;
  originalTitle?: string;
  year?: number;
  genres: string[];
  description?: string;
  posterUrl?: string;
  backdropUrl?: string;
  duration?: number; // minutes
  rating?: number; // 0-10
  streamUrl?: string; // Only for movie/episode
  
  // Series specific
  seriesId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  
  // Metadata
  metadataSource: MetadataSource;
  subtitlesAvailable: boolean;
  audioLanguages: string[];
  addedAt: Date;
  updatedAt: Date;
  
  // User state
  isFavorite?: boolean;
  watchProgress?: WatchProgress;
}

export interface Series extends Omit<VodItem, 'type' | 'streamUrl'> {
  type: 'series';
  seasons: Season[];
}

export interface Season {
  id: string;
  seriesId: string;
  seasonNumber: number;
  title?: string;
  posterUrl?: string;
  episodes: Episode[];
  episodeCount: number;
}

export interface Episode extends Omit<VodItem, 'type'> {
  type: 'episode';
  seriesId: string;
  seasonNumber: number;
  episodeNumber: number;
  airDate?: Date;
}

export interface Movie extends Omit<VodItem, 'type'> {
  type: 'movie';
  director?: string;
  cast?: string[];
  trailerUrl?: string;
}

export interface WatchProgress {
  itemId: string;
  progress: number; // 0-100
  currentTime: number; // seconds
  duration: number; // seconds
  lastWatchedAt: Date;
  completed: boolean;
}

export interface Subtitle {
  id: string;
  vodItemId: string;
  language: string;
  languageCode: string;
  format: SubtitleFormat;
  source: SubtitleSource;
  url?: string;
  content?: string; // VTT/SRT content for AI-generated
  isDefault?: boolean;
  aiGenerated?: boolean;
  createdAt: Date;
}

export interface SubtitleCue {
  startTime: number; // seconds
  endTime: number; // seconds
  text: string;
}

export interface SubtitleTrack {
  language: string;
  languageCode: string;
  cues: SubtitleCue[];
}

export interface VodFilter {
  type?: VodType;
  genres?: string[];
  yearFrom?: number;
  yearTo?: number;
  sortBy?: 'title' | 'year' | 'rating' | 'addedAt' | 'lastWatched';
  sortOrder?: 'asc' | 'desc';
  searchQuery?: string;
  favoritesOnly?: boolean;
  continueWatchingOnly?: boolean;
}

export interface VodCategory {
  id: string;
  name: string;
  items: VodItem[];
  type: 'genre' | 'collection' | 'continue_watching' | 'recently_added' | 'favorites';
}

// AI Subtitle Generation
export interface SubtitleGenerationRequest {
  vodItemId: string;
  streamUrl: string;
  targetLanguage: string;
  autoDetectLanguage?: boolean;
}

export interface SubtitleGenerationProgress {
  vodItemId: string;
  status: 'queued' | 'extracting_audio' | 'transcribing' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  message?: string;
  error?: string;
}

export interface SubtitleGenerationResult {
  vodItemId: string;
  subtitle: Subtitle;
  detectedLanguage?: string;
  confidence?: number;
}

// Intro Skip
export interface IntroMarker {
  seriesId: string;
  seasonNumber?: number;
  startTime: number; // seconds
  endTime: number; // seconds
  type: 'intro' | 'outro' | 'recap';
}

// Player Settings for VOD
export interface VodPlayerSettings {
  autoPlayNext: boolean;
  skipIntro: boolean;
  subtitleDelay: number; // ms offset
  subtitleFontSize: 'small' | 'medium' | 'large' | 'xlarge';
  subtitleFontColor: string;
  subtitleBackground: 'none' | 'semi' | 'solid';
  rememberPosition: boolean;
}
