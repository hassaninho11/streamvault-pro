/**
 * Player Engine Types - Core abstractions for multi-player system
 */

// ============= Media Source =============

export interface SubtitleTrack {
  id: string;
  label: string;
  lang?: string;
  kind: 'embedded' | 'external';
  url?: string;
  format?: 'vtt' | 'srt';
}

export interface AudioTrack {
  id: string;
  label: string;
  lang?: string;
}

export interface DrmConfig {
  scheme: 'widevine' | 'fairplay' | 'playready';
  licenseUrl: string;
}

export interface MediaSource {
  url: string;
  type: 'live' | 'vod';
  mimeHint?: string;
  title?: string;
  posterUrl?: string;
  duration?: number;
  headers?: Record<string, string>;
  drm?: DrmConfig;
  subtitleTracks?: SubtitleTrack[];
  audioTracks?: AudioTrack[];
  startPosition?: number; // Resume position in seconds
}

// ============= Player State =============

export type PlayerStatus = 
  | 'idle' 
  | 'loading' 
  | 'playing' 
  | 'paused' 
  | 'buffering' 
  | 'ended' 
  | 'error';

export interface PlayerError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
}

export interface PlayerState {
  status: PlayerStatus;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  error: PlayerError | null;
  currentSubtitleId?: string;
  currentAudioId?: string;
}

// ============= Engine Capabilities =============

export interface EngineCapabilities {
  live: boolean;
  vod: boolean;
  casting: boolean;
  externalSubtitles: boolean;
  embeddedSubtitles: boolean;
  drm: boolean;
  adaptiveBitrate: boolean;
  pip: boolean;
}

// ============= Platform Detection =============

export type Platform = 'web' | 'android' | 'ios' | 'tvos' | 'electron' | 'tizen' | 'webos';

export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'web';
  
  const ua = navigator.userAgent.toLowerCase();
  
  // Check for TV platforms
  if (ua.includes('tizen')) return 'tizen';
  if (ua.includes('webos') || ua.includes('web0s')) return 'webos';
  
  // Check for Electron
  if ('electron' in window || ua.includes('electron')) return 'electron';
  
  // Check for native mobile (via Capacitor/Cordova)
  if ('Capacitor' in window) {
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  }
  
  return 'web';
}

// ============= Engine Interface =============

export interface MediaPlayerEngine {
  readonly id: string;
  readonly displayName: string;
  readonly supports: EngineCapabilities;
  
  // Lifecycle
  attach(containerEl: HTMLElement): void;
  detach(): void;
  destroy(): Promise<void>;
  
  // Playback control
  load(source: MediaSource): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(seconds: number): Promise<void>;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  
  // State
  getState(): PlayerState;
  onStateChange(callback: (state: PlayerState) => void): () => void;
  
  // Tracks
  listSubtitles(): SubtitleTrack[];
  setSubtitle(id?: string): Promise<void>;
  listAudioTracks(): AudioTrack[];
  setAudioTrack(id?: string): Promise<void>;
}

// ============= Engine Factory =============

export interface EngineFactory {
  id: string;
  displayName: string;
  priority: number; // Lower = higher priority
  isAvailable(): boolean;
  supportsSource(source: MediaSource): boolean;
  create(): MediaPlayerEngine;
}

// ============= Player Settings =============

export type BufferMode = 'balanced' | 'low-latency' | 'stability';

export interface PlayerSettings {
  preferredEngine: string; // 'auto' or engine id
  bufferMode: BufferMode;
  subtitleDelay: number; // ms
  audioLanguage?: string;
  forceSoftwareDecoding: boolean;
  maxRetries: number;
  retryDelay: number;
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  preferredEngine: 'auto',
  bufferMode: 'balanced',
  subtitleDelay: 0,
  forceSoftwareDecoding: false,
  maxRetries: 3,
  retryDelay: 1000,
};

// ============= Diagnostics =============

export interface PlayerDiagnostics {
  currentEngine: string;
  fallbackCount: number;
  lastErrorCode: string | null;
  loadLatencyMs: number;
  playLatencyMs: number;
  bufferingEvents: number;
  totalBufferingMs: number;
}
