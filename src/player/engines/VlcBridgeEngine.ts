/**
 * VlcBridgeEngine - In-app VLC engine using libVLC via Capacitor bridge
 * 
 * CRITICAL: This uses the native libVLC library embedded in the app.
 * It does NOT launch external VLC app. All playback happens in-app.
 * 
 * Supports: MKV, AVI, RMVB, TS, FLV, WMV, AC3, DTS, HEVC, and more.
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
  isNativePlatform, 
  getPlatform,
} from '../NativePlaybackPlugin';
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

// ============= VLC Plugin Types =============

interface VlcPlaybackState {
  status: 'idle' | 'opening' | 'buffering' | 'playing' | 'paused' | 'stopped' | 'ended' | 'error';
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  isMuted: boolean;
  playbackRate?: number;
}

interface VlcError {
  code: string;
  message: string;
}

interface VlcTrack {
  id: string;
  label: string;
  language?: string;
  selected?: boolean;
}

interface VlcEngineInfo {
  engine: string;
  displayName: string;
  version: string;
  capabilities: {
    drm: boolean;
    casting: boolean;
    pip: boolean;
    hls: boolean;
    dash: boolean;
    mkv: boolean;
    avi: boolean;
    ac3: boolean;
    hevc: boolean;
  };
}

interface VlcPlugin {
  load(options: { 
    url: string; 
    headers?: Record<string, string>;
    startPosition?: number;
    autoPlay?: boolean;
  }): Promise<{ success: boolean }>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(options: { position: number }): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  setMuted(options: { muted: boolean }): Promise<void>;
  setPlaybackRate(options: { rate: number }): Promise<void>;
  getState(): Promise<VlcPlaybackState>;
  getAudioTracks(): Promise<{ tracks: VlcTrack[] }>;
  setAudioTrack(options: { trackId: string }): Promise<void>;
  getSubtitleTracks(): Promise<{ tracks: VlcTrack[] }>;
  setSubtitleTrack(options: { trackId: string }): Promise<void>;
  addExternalSubtitle(options: { url: string }): Promise<{ success: boolean }>;
  getEngineInfo(): Promise<VlcEngineInfo>;
  destroy(): Promise<void>;
  addListener(event: 'stateChange', callback: (event: { state: VlcPlaybackState }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'error', callback: (event: { error: VlcError }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'timeUpdate', callback: (event: { currentTime: number; duration: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'buffering', callback: (event: { percent: number }) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

// Register VLC plugin - will use web fallback if native not available
const VlcPlayback = registerPlugin<VlcPlugin>('VlcPlayback', {
  web: () => import('../VlcPlaybackWeb').then(m => new m.VlcPlaybackWeb()),
});

// ============= VLC Bridge Engine (In-App libVLC) =============

export class VlcBridgeEngine extends BaseEngine {
  readonly id = 'vlc-bridge';
  readonly displayName = 'VLC (In-App)';
  readonly supports: EngineCapabilities = {
    live: true,
    vod: true,
    casting: false, // VLC doesn't support casting directly
    externalSubtitles: true,
    embeddedSubtitles: true,
    drm: false, // VLC has limited DRM support
    adaptiveBitrate: true,
    pip: true,
  };
  
  private listeners: PluginListenerHandle[] = [];
  private isDestroyed = false;
  private vlcVersion: string = '';
  
  async load(source: MediaSource): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Engine is destroyed');
    }
    
    console.log('[VlcBridge] Loading source with in-app libVLC:', source.url.substring(0, 80));
    this.source = source;
    this.setStatus('loading');
    
    // Clean up any existing listeners
    await this.removeListeners();
    
    try {
      // Get engine info (version, capabilities)
      try {
        const info = await VlcPlayback.getEngineInfo();
        this.vlcVersion = info.version;
        console.log('[VlcBridge] VLC version:', this.vlcVersion);
      } catch (e) {
        console.warn('[VlcBridge] Could not get engine info:', e);
      }
      
      // Register event listeners
      const stateListener = await VlcPlayback.addListener('stateChange', (event) => {
        this.handleVlcStateChange(event.state);
      });
      this.listeners.push(stateListener);
      
      const errorListener = await VlcPlayback.addListener('error', (event) => {
        this.handleVlcError(event.error);
      });
      this.listeners.push(errorListener);
      
      const timeListener = await VlcPlayback.addListener('timeUpdate', (event) => {
        this.updateState({
          currentTime: event.currentTime,
          duration: event.duration,
        });
      });
      this.listeners.push(timeListener);
      
      const bufferingListener = await VlcPlayback.addListener('buffering', (event) => {
        if (event.percent < 100) {
          this.updateState({ buffered: event.percent / 100 });
        }
      });
      this.listeners.push(bufferingListener);
      
      // Load the stream with headers if provided
      await VlcPlayback.load({
        url: source.url,
        headers: source.headers,
        startPosition: source.startPosition,
        autoPlay: true,
      });
      
      console.log('[VlcBridge] Load initiated successfully (in-app VLC)');
      
      // Refresh available tracks after load
      setTimeout(() => this.refreshTracks(), 1500);
      
    } catch (error) {
      console.error('[VlcBridge] Load failed:', error);
      this.setError(this.createError(
        'VLC_LOAD_FAILED',
        error instanceof Error ? error.message : 'Failed to load VLC player',
        true
      ));
    }
  }
  
  private async refreshTracks(): Promise<void> {
    try {
      // Get audio tracks
      const audioResult = await VlcPlayback.getAudioTracks();
      this.audioTracks = audioResult.tracks.map(t => ({
        id: t.id,
        label: t.label,
        lang: t.language || 'und',
      }));
      
      // Get subtitle tracks
      const subResult = await VlcPlayback.getSubtitleTracks();
      this.subtitleTracks = subResult.tracks.map(t => ({
        id: t.id,
        label: t.label,
        lang: t.language || 'und',
        kind: 'embedded' as const,
      }));
      
      console.log('[VlcBridge] Tracks refreshed:', {
        audio: this.audioTracks.length,
        subtitles: this.subtitleTracks.length,
      });
    } catch (e) {
      console.warn('[VlcBridge] Failed to refresh tracks:', e);
    }
  }
  
  private handleVlcStateChange(state: VlcPlaybackState): void {
    console.log('[VlcBridge] State change:', state.status);
    
    switch (state.status) {
      case 'idle':
        this.setStatus('idle');
        break;
      case 'opening':
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
      case 'ended':
        this.setStatus('ended');
        break;
      case 'error':
        this.setStatus('error');
        break;
    }
    
    this.updateState({
      currentTime: state.currentTime,
      duration: state.duration,
      buffered: state.buffered,
      volume: state.volume,
      isMuted: state.isMuted,
      playbackRate: state.playbackRate || 1,
    });
  }
  
  private handleVlcError(error: VlcError): void {
    console.error('[VlcBridge] VLC error:', error.code, error.message);
    
    this.setError(this.createError(
      error.code || 'VLC_ERROR',
      error.message,
      true
    ));
  }
  
  async play(): Promise<void> {
    if (this.isDestroyed) return;
    console.log('[VlcBridge] Play');
    await VlcPlayback.play();
  }
  
  async pause(): Promise<void> {
    if (this.isDestroyed) return;
    console.log('[VlcBridge] Pause');
    await VlcPlayback.pause();
  }
  
  async stop(): Promise<void> {
    if (this.isDestroyed) return;
    console.log('[VlcBridge] Stop');
    await VlcPlayback.stop();
    this.setStatus('ended');
  }
  
  async seek(seconds: number): Promise<void> {
    if (this.isDestroyed) return;
    console.log('[VlcBridge] Seek to', seconds);
    await VlcPlayback.seek({ position: seconds });
  }
  
  setVolume(volume: number): void {
    if (this.isDestroyed) return;
    VlcPlayback.setVolume({ volume: Math.max(0, Math.min(1, volume)) });
    this.updateState({ volume });
  }
  
  setMuted(muted: boolean): void {
    if (this.isDestroyed) return;
    VlcPlayback.setMuted({ muted });
    this.updateState({ isMuted: muted });
  }
  
  setPlaybackRate(rate: number): void {
    if (this.isDestroyed) return;
    VlcPlayback.setPlaybackRate({ rate });
    this.updateState({ playbackRate: rate });
  }
  
  // ============= Track Management =============
  
  listSubtitles(): SubtitleTrack[] {
    return [...this.subtitleTracks];
  }
  
  async setSubtitle(id?: string): Promise<void> {
    await VlcPlayback.setSubtitleTrack({ trackId: id || '-1' });
    this.updateState({ currentSubtitleId: id });
  }
  
  listAudioTracks(): AudioTrack[] {
    return [...this.audioTracks];
  }
  
  async setAudioTrack(id?: string): Promise<void> {
    if (id) {
      await VlcPlayback.setAudioTrack({ trackId: id });
      this.updateState({ currentAudioId: id });
    }
  }
  
  async addExternalSubtitle(url: string): Promise<void> {
    try {
      await VlcPlayback.addExternalSubtitle({ url });
      // Refresh tracks to include the new subtitle
      setTimeout(() => this.refreshTracks(), 500);
    } catch (e) {
      console.error('[VlcBridge] Failed to add external subtitle:', e);
    }
  }
  
  // ============= Cleanup =============
  
  private async removeListeners(): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener.remove();
      } catch (e) {
        console.warn('[VlcBridge] Failed to remove listener:', e);
      }
    }
    this.listeners = [];
  }
  
  async destroy(): Promise<void> {
    console.log('[VlcBridge] Destroying in-app VLC engine');
    this.isDestroyed = true;
    
    await this.removeListeners();
    
    try {
      await VlcPlayback.destroy();
      await VlcPlayback.removeAllListeners();
    } catch (e) {
      console.warn('[VlcBridge] Error during destroy:', e);
    }
    
    this.stateListeners.clear();
    this.source = null;
    this.subtitleTracks = [];
    this.audioTracks = [];
  }
  
  // ============= Info =============
  
  getVlcVersion(): string {
    return this.vlcVersion;
  }
}

// ============= Factory =============

export const VlcBridgeEngineFactory: EngineFactory = {
  id: 'vlc-bridge',
  displayName: 'VLC (In-App)',
  priority: 10, // Lower priority than ExoPlayer - used as fallback
  
  isAvailable(): boolean {
    // VLC is available on native Android (libVLC)
    // iOS support can be added later with MobileVLCKit
    return isNativePlatform() && getPlatform() === 'android';
  },
  
  supportsSource(_source: MediaSource): boolean {
    // VLC can play almost anything - MKV, AVI, RMVB, etc.
    return true;
  },
  
  create(): VlcBridgeEngine {
    return new VlcBridgeEngine();
  },
};

export default VlcBridgeEngine;
