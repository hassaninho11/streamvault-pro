/**
 * ExoPlayerBridgeEngine - Full implementation for Android native playback via ExoPlayer
 * Communicates with the Capacitor NativePlayback plugin
 */

import { BaseEngine } from './BaseEngine';
import { 
  MediaSource, 
  EngineCapabilities, 
  EngineFactory,
  SubtitleTrack,
  AudioTrack,
} from '../types';
import { 
  NativePlayback, 
  isNativePlatform, 
  getPlatform,
  type PlaybackState as NativePlaybackState,
  type PlaybackError as NativePlaybackError,
} from '../NativePlaybackPlugin';
import type { PluginListenerHandle } from '@capacitor/core';

// ============= ExoPlayer Bridge Engine =============

export class ExoPlayerBridgeEngine extends BaseEngine {
  readonly id = 'exo-bridge';
  readonly displayName = 'ExoPlayer';
  readonly supports: EngineCapabilities = {
    live: true,
    vod: true,
    casting: true,
    externalSubtitles: true,
    embeddedSubtitles: true,
    drm: true,
    adaptiveBitrate: true,
    pip: true,
  };
  
  private listeners: PluginListenerHandle[] = [];
  private isDestroyed = false;
  private loadRetryCount = 0;
  private maxRetries = 3;
  
  async load(source: MediaSource): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Engine is destroyed');
    }
    
    console.log('[ExoPlayerBridge] Loading source:', source.url.substring(0, 80));
    this.source = source;
    this.setStatus('loading');
    this.loadRetryCount = 0;
    
    // Clean up any existing listeners
    await this.removeListeners();
    
    try {
      // Register event listeners
      const stateListener = await NativePlayback.addListener('stateChange', (event) => {
        this.handleNativeStateChange(event.state);
      });
      this.listeners.push(stateListener);
      
      const errorListener = await NativePlayback.addListener('error', (event) => {
        this.handleNativeError(event.error);
      });
      this.listeners.push(errorListener);
      
      const timeListener = await NativePlayback.addListener('timeUpdate', (event) => {
        this.updateState({
          currentTime: event.currentTime,
          duration: event.duration,
          buffered: event.bufferedPosition,
        });
      });
      this.listeners.push(timeListener);
      
      // Determine MIME type hint
      let mimeType = source.mimeHint;
      if (!mimeType) {
        const url = source.url.toLowerCase();
        if (url.includes('.m3u8') || url.includes('m3u8')) {
          mimeType = 'application/x-mpegURL';
        } else if (url.includes('.mpd')) {
          mimeType = 'application/dash+xml';
        } else if (url.includes('.mp4')) {
          mimeType = 'video/mp4';
        } else if (url.includes('.mkv')) {
          mimeType = 'video/x-matroska';
        } else if (url.includes('.ts')) {
          mimeType = 'video/mp2t';
        }
      }
      
      // Load the stream
      await NativePlayback.load({
        stream: {
          url: source.url,
          mimeType,
          isLive: source.type === 'live',
          title: source.title,
          artworkUrl: source.posterUrl,
          headers: source.headers,
          drmLicenseUrl: source.drm?.licenseUrl,
          drmType: source.drm?.scheme,
        },
        startPosition: source.startPosition,
        autoPlay: true,
      });
      
      console.log('[ExoPlayerBridge] Load initiated successfully');
      
    } catch (error) {
      console.error('[ExoPlayerBridge] Load failed:', error);
      this.setError(this.createError(
        'NATIVE_LOAD_FAILED',
        error instanceof Error ? error.message : 'Failed to load native player',
        this.loadRetryCount < this.maxRetries
      ));
    }
  }
  
  private handleNativeStateChange(state: NativePlaybackState): void {
    console.log('[ExoPlayerBridge] State change:', state.status);
    
    // Map native state to engine state
    switch (state.status) {
      case 'idle':
        this.setStatus('idle');
        break;
      case 'loading':
        this.setStatus('loading');
        break;
      case 'buffering':
        this.setStatus('buffering');
        break;
      case 'playing':
        this.setStatus('playing');
        break;
      case 'paused':
        this.setStatus('paused');
        break;
      case 'stopped':
        this.setStatus('ended');
        break;
      case 'error':
        this.setStatus('error');
        break;
    }
    
    // Update full state
    this.updateState({
      currentTime: state.currentTime,
      duration: state.duration,
      buffered: state.bufferedPosition,
      volume: state.volume,
      isMuted: state.muted,
      playbackRate: state.playbackRate,
    });
  }
  
  private handleNativeError(error: NativePlaybackError): void {
    console.error('[ExoPlayerBridge] Native error:', error.code, error.message);
    
    // Map native error codes to our error codes
    const errorCode = this.mapErrorCode(error.code);
    
    this.setError(this.createError(
      errorCode,
      error.message,
      error.recoverable,
      error.details
    ));
    
    // If recoverable and we haven't exceeded retries, try again
    if (error.recoverable && this.loadRetryCount < this.maxRetries && this.source) {
      this.loadRetryCount++;
      console.log(`[ExoPlayerBridge] Retrying (${this.loadRetryCount}/${this.maxRetries})...`);
      setTimeout(() => {
        if (this.source && !this.isDestroyed) {
          this.load(this.source);
        }
      }, 1000 * this.loadRetryCount);
    }
  }
  
  private mapErrorCode(nativeCode: string): string {
    const mapping: Record<string, string> = {
      'NETWORK': 'NETWORK_ERROR',
      'SOURCE': 'SOURCE_ERROR',
      'DECODER': 'DECODER_ERROR',
      'DRM': 'DRM_ERROR',
      'TIMEOUT': 'TIMEOUT_ERROR',
      'UNKNOWN': 'UNKNOWN_ERROR',
    };
    return mapping[nativeCode] || nativeCode;
  }
  
  async play(): Promise<void> {
    if (this.isDestroyed) return;
    console.log('[ExoPlayerBridge] Play');
    await NativePlayback.play();
  }
  
  async pause(): Promise<void> {
    if (this.isDestroyed) return;
    console.log('[ExoPlayerBridge] Pause');
    await NativePlayback.pause();
  }
  
  async stop(): Promise<void> {
    if (this.isDestroyed) return;
    console.log('[ExoPlayerBridge] Stop');
    await NativePlayback.stop();
    this.setStatus('ended');
  }
  
  async seek(seconds: number): Promise<void> {
    if (this.isDestroyed) return;
    console.log('[ExoPlayerBridge] Seek to', seconds);
    await NativePlayback.seek({ position: seconds });
  }
  
  setVolume(volume: number): void {
    if (this.isDestroyed) return;
    NativePlayback.setVolume({ volume: Math.max(0, Math.min(1, volume)) });
    this.updateState({ volume });
  }
  
  setMuted(muted: boolean): void {
    if (this.isDestroyed) return;
    NativePlayback.setMuted({ muted });
    this.updateState({ isMuted: muted });
  }
  
  setPlaybackRate(rate: number): void {
    if (this.isDestroyed) return;
    NativePlayback.setPlaybackRate({ rate });
    this.updateState({ playbackRate: rate });
  }
  
  // ============= Track Management =============
  
  override listSubtitles(): SubtitleTrack[] {
    return this.subtitleTracks;
  }
  
  override async setSubtitle(id?: string): Promise<void> {
    if (this.isDestroyed) return;
    await NativePlayback.setSubtitleTrack({ trackId: id || null });
    this.updateState({ currentSubtitleId: id });
  }
  
  override listAudioTracks(): AudioTrack[] {
    return this.audioTracks;
  }
  
  override async setAudioTrack(id?: string): Promise<void> {
    if (this.isDestroyed) return;
    if (id) {
      await NativePlayback.setAudioTrack({ trackId: id });
    }
    this.updateState({ currentAudioId: id });
  }
  
  async refreshTracks(): Promise<void> {
    if (this.isDestroyed) return;
    
    try {
      const [audioResult, subtitleResult] = await Promise.all([
        NativePlayback.getAudioTracks(),
        NativePlayback.getSubtitleTracks(),
      ]);
      
      this.audioTracks = audioResult.tracks.map(t => ({
        id: t.id,
        language: t.language,
        label: t.label,
      }));
      
      this.subtitleTracks = subtitleResult.tracks.map(t => ({
        id: t.id,
        lang: t.language,
        label: t.label,
        kind: t.isExternal ? 'external' as const : 'embedded' as const,
        url: t.isExternal ? t.id : undefined,
      }));
      
    } catch (error) {
      console.warn('[ExoPlayerBridge] Failed to refresh tracks:', error);
    }
  }
  
  // ============= Cleanup =============
  
  private async removeListeners(): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener.remove();
      } catch (e) {
        console.warn('[ExoPlayerBridge] Failed to remove listener:', e);
      }
    }
    this.listeners = [];
  }
  
  async destroy(): Promise<void> {
    console.log('[ExoPlayerBridge] Destroying engine');
    this.isDestroyed = true;
    
    await this.removeListeners();
    
    try {
      await NativePlayback.stop();
      await NativePlayback.removeAllListeners();
    } catch (e) {
      console.warn('[ExoPlayerBridge] Error during destroy:', e);
    }
    
    this.stateListeners.clear();
    this.source = null;
  }
}

// ============= Factory =============

export const ExoPlayerBridgeEngineFactory: EngineFactory = {
  id: 'exo-bridge',
  displayName: 'ExoPlayer',
  priority: 1, // Highest priority on Android
  
  isAvailable(): boolean {
    return isNativePlatform() && getPlatform() === 'android';
  },
  
  supportsSource(source: MediaSource): boolean {
    // ExoPlayer supports almost all formats
    const url = source.url.toLowerCase();
    
    // Check for known unsupported formats (very rare)
    // ExoPlayer actually supports MKV with MatroskaExtractor
    const unsupported = ['.rmvb', '.rm'];
    if (unsupported.some(ext => url.includes(ext))) {
      return false;
    }
    
    return true;
  },
  
  create(): ExoPlayerBridgeEngine {
    return new ExoPlayerBridgeEngine();
  },
};

export default ExoPlayerBridgeEngine;
