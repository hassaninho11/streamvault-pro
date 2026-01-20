/**
 * Native Playback Plugin Types
 * Defines the interface for communicating with native players (ExoPlayer/AVPlayer)
 */

import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

// ============= Types =============

export interface PlaybackState {
  status: 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'stopped' | 'error';
  currentTime: number;
  duration: number;
  bufferedPosition: number;
  isLive: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  videoWidth?: number;
  videoHeight?: number;
}

export interface PlaybackError {
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export interface StreamInfo {
  url: string;
  mimeType?: string;
  isLive?: boolean;
  title?: string;
  subtitle?: string;
  artworkUrl?: string;
  headers?: Record<string, string>;
  drmLicenseUrl?: string;
  drmType?: 'widevine' | 'fairplay' | 'playready';
}

export interface LoadOptions {
  stream: StreamInfo;
  startPosition?: number;
  autoPlay?: boolean;
}

export interface QualityLevel {
  id: string;
  width: number;
  height: number;
  bitrate: number;
  label: string;
}

export interface AudioTrack {
  id: string;
  language: string;
  label: string;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  isExternal: boolean;
}

// ============= Events =============

export interface StateChangeEvent {
  state: PlaybackState;
}

export interface ErrorEvent {
  error: PlaybackError;
}

export interface BufferingEvent {
  isBuffering: boolean;
  percent: number;
}

export interface QualityChangeEvent {
  level: QualityLevel;
  auto: boolean;
}

export interface TimeUpdateEvent {
  currentTime: number;
  duration: number;
  bufferedPosition: number;
}

// ============= Plugin Interface =============

export interface NativePlaybackPlugin {
  /**
   * Load a stream URL and prepare for playback
   */
  load(options: LoadOptions): Promise<{ success: boolean }>;
  
  /**
   * Start playback
   */
  play(): Promise<void>;
  
  /**
   * Pause playback
   */
  pause(): Promise<void>;
  
  /**
   * Stop playback and release resources
   */
  stop(): Promise<void>;
  
  /**
   * Seek to position in seconds
   */
  seek(options: { position: number }): Promise<void>;
  
  /**
   * Set volume (0.0 - 1.0)
   */
  setVolume(options: { volume: number }): Promise<void>;
  
  /**
   * Set muted state
   */
  setMuted(options: { muted: boolean }): Promise<void>;
  
  /**
   * Set playback rate
   */
  setPlaybackRate(options: { rate: number }): Promise<void>;
  
  /**
   * Get current playback state
   */
  getState(): Promise<PlaybackState>;
  
  /**
   * Get available quality levels
   */
  getQualityLevels(): Promise<{ levels: QualityLevel[] }>;
  
  /**
   * Set quality level (-1 for auto)
   */
  setQualityLevel(options: { levelId: string | 'auto' }): Promise<void>;
  
  /**
   * Get available audio tracks
   */
  getAudioTracks(): Promise<{ tracks: AudioTrack[] }>;
  
  /**
   * Set audio track
   */
  setAudioTrack(options: { trackId: string }): Promise<void>;
  
  /**
   * Get available subtitle tracks
   */
  getSubtitleTracks(): Promise<{ tracks: SubtitleTrack[] }>;
  
  /**
   * Set subtitle track (null to disable)
   */
  setSubtitleTrack(options: { trackId: string | null }): Promise<void>;
  
  /**
   * Check if Picture-in-Picture is supported
   */
  isPipSupported(): Promise<{ supported: boolean }>;
  
  /**
   * Enter Picture-in-Picture mode
   */
  enterPip(): Promise<void>;
  
  /**
   * Exit Picture-in-Picture mode
   */
  exitPip(): Promise<void>;
  
  /**
   * Get engine info
   */
  getEngineInfo(): Promise<{ 
    name: string; 
    version: string; 
    platform: 'android' | 'ios' | 'web';
  }>;
  
  // Event listeners
  addListener(
    eventName: 'stateChange',
    listenerFunc: (event: StateChangeEvent) => void
  ): Promise<PluginListenerHandle>;
  
  addListener(
    eventName: 'error',
    listenerFunc: (event: ErrorEvent) => void
  ): Promise<PluginListenerHandle>;
  
  addListener(
    eventName: 'buffering',
    listenerFunc: (event: BufferingEvent) => void
  ): Promise<PluginListenerHandle>;
  
  addListener(
    eventName: 'qualityChange',
    listenerFunc: (event: QualityChangeEvent) => void
  ): Promise<PluginListenerHandle>;
  
  addListener(
    eventName: 'timeUpdate',
    listenerFunc: (event: TimeUpdateEvent) => void
  ): Promise<PluginListenerHandle>;
  
  removeAllListeners(): Promise<void>;
}

// ============= Register Plugin =============

/**
 * The NativePlayback Capacitor plugin.
 * 
 * On Android: Uses ExoPlayer via NativePlaybackPlugin.kt
 * On iOS: Falls back to web implementation (AVPlayer integration pending)
 * On Web: Uses NativePlaybackWeb stub
 */
const NativePlayback = registerPlugin<NativePlaybackPlugin>('NativePlayback', {
  web: () => import('./NativePlaybackWeb').then(m => new m.NativePlaybackWeb()),
});

export { NativePlayback };

// ============= Utility Functions =============

/**
 * Check if we're running in a native Capacitor environment
 */
export function isNativePlatform(): boolean {
  try {
    const cap = (window as unknown as { 
      Capacitor?: { 
        isNativePlatform?: () => boolean;
      } 
    }).Capacitor;
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/**
 * Get the current platform
 */
export function getPlatform(): 'web' | 'android' | 'ios' {
  try {
    const cap = (window as unknown as { 
      Capacitor?: { 
        getPlatform?: () => string;
      } 
    }).Capacitor;
    const platform = cap?.getPlatform?.();
    if (platform === 'android') return 'android';
    if (platform === 'ios') return 'ios';
    return 'web';
  } catch {
    return 'web';
  }
}

/**
 * Check if the NativePlayback plugin is properly registered
 */
export async function isNativePlaybackRegistered(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  
  try {
    const info = await NativePlayback.getEngineInfo();
    return info?.platform === 'android' || info?.platform === 'ios';
  } catch (err) {
    console.warn('[NativePlayback] Plugin not registered or unavailable:', err);
    return false;
  }
}

/**
 * Hash a URL for safe logging
 */
export function hashUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    const hostHash = btoa(parsed.host).slice(0, 8);
    return `${parsed.protocol}//${hostHash}.../${parsed.pathname.split('/').pop() || ''}`;
  } catch {
    return '[invalid-url]';
  }
}
