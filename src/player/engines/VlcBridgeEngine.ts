/**
 * VlcBridgeEngine - VLC fallback engine for formats not supported by ExoPlayer
 * Uses libVLC via Capacitor bridge for maximum format compatibility
 */

import { BaseEngine } from './BaseEngine';
import { 
  MediaSource, 
  EngineCapabilities, 
  EngineFactory,
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
}

interface VlcError {
  code: string;
  message: string;
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
  getState(): Promise<VlcPlaybackState>;
  destroy(): Promise<void>;
  addListener(event: 'stateChange', callback: (event: { state: VlcPlaybackState }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'error', callback: (event: { error: VlcError }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'timeUpdate', callback: (event: { currentTime: number; duration: number }) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

// Register VLC plugin - will use web fallback if native not available
const VlcPlayback = registerPlugin<VlcPlugin>('VlcPlayback', {
  web: () => import('../VlcPlaybackWeb').then(m => new m.VlcPlaybackWeb()),
});

// ============= VLC Bridge Engine =============

export class VlcBridgeEngine extends BaseEngine {
  readonly id = 'vlc-bridge';
  readonly displayName = 'VLC (Kompatibilitet)';
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
  
  async load(source: MediaSource): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('Engine is destroyed');
    }
    
    console.log('[VlcBridge] Loading source:', source.url.substring(0, 80));
    this.source = source;
    this.setStatus('loading');
    
    // Clean up any existing listeners
    await this.removeListeners();
    
    try {
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
      
      // Load the stream
      await VlcPlayback.load({
        url: source.url,
        headers: source.headers,
        startPosition: source.startPosition,
        autoPlay: true,
      });
      
      console.log('[VlcBridge] Load initiated successfully');
      
    } catch (error) {
      console.error('[VlcBridge] Load failed:', error);
      this.setError(this.createError(
        'VLC_LOAD_FAILED',
        error instanceof Error ? error.message : 'Failed to load VLC player',
        true
      ));
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
    // VLC doesn't support variable playback rate through this bridge
    console.log('[VlcBridge] Playback rate not supported:', rate);
  }
  
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
    console.log('[VlcBridge] Destroying engine');
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
  }
}

// ============= Factory =============

export const VlcBridgeEngineFactory: EngineFactory = {
  id: 'vlc-bridge',
  displayName: 'VLC (Kompatibilitet)',
  priority: 10, // Lower priority than ExoPlayer - used as fallback
  
  isAvailable(): boolean {
    // VLC is available on native platforms
    return isNativePlatform() && (getPlatform() === 'android' || getPlatform() === 'ios');
  },
  
  supportsSource(_source: MediaSource): boolean {
    // VLC can play almost anything
    return true;
  },
  
  create(): VlcBridgeEngine {
    return new VlcBridgeEngine();
  },
};

export default VlcBridgeEngine;
