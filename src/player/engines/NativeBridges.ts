/**
 * Native Bridge Engines - Stubs for native platform players
 * These will be implemented via Capacitor/native bridges
 */

import { BaseEngine } from './BaseEngine';
import { MediaSource, EngineCapabilities, EngineFactory } from '../types';

// ============= ExoPlayer Engine (Android) =============

export class ExoPlayerEngine extends BaseEngine {
  readonly id = 'exo';
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
  
  async load(source: MediaSource): Promise<void> {
    console.log('[ExoPlayerEngine] TODO: Bridge to native ExoPlayer', source.url);
    this.source = source;
    this.setStatus('loading');
    
    // In production, this would call:
    // await Capacitor.Plugins.ExoPlayerBridge.load({ url: source.url, ... });
    
    // For now, simulate immediate error to trigger fallback
    setTimeout(() => {
      this.setError(this.createError(
        'BRIDGE_NOT_IMPLEMENTED',
        'ExoPlayer bridge not yet implemented',
        true
      ));
    }, 100);
  }
  
  async play(): Promise<void> {
    console.log('[ExoPlayerEngine] TODO: Bridge play()');
  }
  
  async pause(): Promise<void> {
    console.log('[ExoPlayerEngine] TODO: Bridge pause()');
  }
  
  async stop(): Promise<void> {
    console.log('[ExoPlayerEngine] TODO: Bridge stop()');
    this.setStatus('idle');
  }
  
  async seek(seconds: number): Promise<void> {
    console.log('[ExoPlayerEngine] TODO: Bridge seek()', seconds);
  }
  
  setVolume(volume: number): void {
    console.log('[ExoPlayerEngine] TODO: Bridge setVolume()', volume);
  }
  
  setMuted(muted: boolean): void {
    console.log('[ExoPlayerEngine] TODO: Bridge setMuted()', muted);
  }
  
  setPlaybackRate(rate: number): void {
    console.log('[ExoPlayerEngine] TODO: Bridge setPlaybackRate()', rate);
  }
  
  async destroy(): Promise<void> {
    console.log('[ExoPlayerEngine] TODO: Bridge destroy()');
    this.stateListeners.clear();
  }
}

export const ExoPlayerEngineFactory: EngineFactory = {
  id: 'exo',
  displayName: 'ExoPlayer',
  priority: 5, // Highest on Android
  
  isAvailable(): boolean {
    // Check for Android Capacitor bridge
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
    return cap?.isNativePlatform?.() === true && cap?.getPlatform?.() === 'android';
  },
  
  supportsSource(_source: MediaSource): boolean {
    return true;
  },
  
  create(): ExoPlayerEngine {
    return new ExoPlayerEngine();
  },
};

// ============= AVPlayer Engine (iOS/tvOS) =============

export class AVPlayerEngine extends BaseEngine {
  readonly id = 'av';
  readonly displayName = 'AVPlayer';
  readonly supports: EngineCapabilities = {
    live: true,
    vod: true,
    casting: true, // AirPlay
    externalSubtitles: true,
    embeddedSubtitles: true,
    drm: true, // FairPlay
    adaptiveBitrate: true,
    pip: true,
  };
  
  async load(source: MediaSource): Promise<void> {
    console.log('[AVPlayerEngine] TODO: Bridge to native AVPlayer', source.url);
    this.source = source;
    this.setStatus('loading');
    
    // In production, this would call:
    // await Capacitor.Plugins.AVPlayerBridge.load({ url: source.url, ... });
    
    setTimeout(() => {
      this.setError(this.createError(
        'BRIDGE_NOT_IMPLEMENTED',
        'AVPlayer bridge not yet implemented',
        true
      ));
    }, 100);
  }
  
  async play(): Promise<void> {
    console.log('[AVPlayerEngine] TODO: Bridge play()');
  }
  
  async pause(): Promise<void> {
    console.log('[AVPlayerEngine] TODO: Bridge pause()');
  }
  
  async stop(): Promise<void> {
    console.log('[AVPlayerEngine] TODO: Bridge stop()');
    this.setStatus('idle');
  }
  
  async seek(seconds: number): Promise<void> {
    console.log('[AVPlayerEngine] TODO: Bridge seek()', seconds);
  }
  
  setVolume(volume: number): void {
    console.log('[AVPlayerEngine] TODO: Bridge setVolume()', volume);
  }
  
  setMuted(muted: boolean): void {
    console.log('[AVPlayerEngine] TODO: Bridge setMuted()', muted);
  }
  
  setPlaybackRate(rate: number): void {
    console.log('[AVPlayerEngine] TODO: Bridge setPlaybackRate()', rate);
  }
  
  async destroy(): Promise<void> {
    console.log('[AVPlayerEngine] TODO: Bridge destroy()');
    this.stateListeners.clear();
  }
}

export const AVPlayerEngineFactory: EngineFactory = {
  id: 'av',
  displayName: 'AVPlayer',
  priority: 5, // Highest on iOS
  
  isAvailable(): boolean {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
    const platform = cap?.getPlatform?.();
    return cap?.isNativePlatform?.() === true && (platform === 'ios' || platform === 'tvos');
  },
  
  supportsSource(_source: MediaSource): boolean {
    return true;
  },
  
  create(): AVPlayerEngine {
    return new AVPlayerEngine();
  },
};

// ============= VLC Engine (Cross-platform fallback) =============

export class VlcEngine extends BaseEngine {
  readonly id = 'vlc';
  readonly displayName = 'VLC (Compatibility)';
  readonly supports: EngineCapabilities = {
    live: true,
    vod: true,
    casting: false,
    externalSubtitles: true,
    embeddedSubtitles: true,
    drm: false,
    adaptiveBitrate: true,
    pip: true,
  };
  
  async load(source: MediaSource): Promise<void> {
    console.log('[VlcEngine] TODO: Bridge to VLC', source.url);
    this.source = source;
    this.setStatus('loading');
    
    setTimeout(() => {
      this.setError(this.createError(
        'BRIDGE_NOT_IMPLEMENTED',
        'VLC bridge not yet implemented',
        true
      ));
    }, 100);
  }
  
  async play(): Promise<void> {
    console.log('[VlcEngine] TODO: Bridge play()');
  }
  
  async pause(): Promise<void> {
    console.log('[VlcEngine] TODO: Bridge pause()');
  }
  
  async stop(): Promise<void> {
    console.log('[VlcEngine] TODO: Bridge stop()');
    this.setStatus('idle');
  }
  
  async seek(seconds: number): Promise<void> {
    console.log('[VlcEngine] TODO: Bridge seek()', seconds);
  }
  
  setVolume(volume: number): void {
    console.log('[VlcEngine] TODO: Bridge setVolume()', volume);
  }
  
  setMuted(muted: boolean): void {
    console.log('[VlcEngine] TODO: Bridge setMuted()', muted);
  }
  
  setPlaybackRate(rate: number): void {
    console.log('[VlcEngine] TODO: Bridge setPlaybackRate()', rate);
  }
  
  async destroy(): Promise<void> {
    console.log('[VlcEngine] TODO: Bridge destroy()');
    this.stateListeners.clear();
  }
}

export const VlcEngineFactory: EngineFactory = {
  id: 'vlc',
  displayName: 'VLC (Compatibility)',
  priority: 50, // Lower priority - compatibility mode
  
  isAvailable(): boolean {
    // VLC would be available via a native plugin
    // For now, only on native platforms
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return cap?.isNativePlatform?.() === true;
  },
  
  supportsSource(_source: MediaSource): boolean {
    return true; // VLC can play almost anything
  },
  
  create(): VlcEngine {
    return new VlcEngine();
  },
};
