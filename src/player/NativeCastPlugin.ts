/**
 * NativeCast Plugin - Capacitor bridge for native Chromecast on Android
 * 
 * This plugin provides native Chromecast integration using Media3 Cast,
 * bypassing WebView limitations and providing a seamless casting experience.
 */

import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

// ============= Types =============

export type CastState = 'no_devices' | 'not_connected' | 'connecting' | 'connected' | 'unknown';

export interface CastStateInfo {
  state: CastState;
  isConnected: boolean;
  deviceName?: string;
}

export interface CastSessionEvent {
  event: 'starting' | 'started' | 'startFailed' | 'ending' | 'ended' | 'resuming' | 'resumed' | 'resumeFailed' | 'suspended';
  sessionId?: string;
  deviceName?: string;
  errorCode?: number;
  wasSuspended?: boolean;
  reason?: number;
}

export interface CastPlaybackState {
  state: 'idle' | 'buffering' | 'playing' | 'paused' | 'ended';
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

export interface CastTimeUpdate {
  currentTime: number;
  duration: number;
  bufferedPosition: number;
}

export interface LoadMediaOptions {
  url: string;
  title?: string;
  subtitle?: string;
  posterUrl?: string;
  isLive?: boolean;
  startPosition?: number;
}

// ============= Plugin Interface =============

export interface NativeCastPlugin {
  /**
   * Check if Chromecast is available on this device
   */
  isAvailable(): Promise<{ available: boolean }>;
  
  /**
   * Get current cast connection state
   */
  getCastState(): Promise<CastStateInfo>;
  
  /**
   * Show the system cast device picker dialog
   */
  showCastDialog(): Promise<void>;
  
  /**
   * Load and play media on the connected Cast device
   */
  loadMedia(options: LoadMediaOptions): Promise<{ success: boolean }>;
  
  /**
   * Start/resume playback on Cast device
   */
  play(): Promise<void>;
  
  /**
   * Pause playback on Cast device
   */
  pause(): Promise<void>;
  
  /**
   * Stop playback on Cast device
   */
  stop(): Promise<void>;
  
  /**
   * Seek to position (in seconds) on Cast device
   */
  seek(options: { position: number }): Promise<void>;
  
  /**
   * Set volume on Cast device (0.0 - 1.0)
   */
  setVolume(options: { volume: number }): Promise<void>;
  
  /**
   * Set muted state on Cast device
   */
  setMuted(options: { muted: boolean }): Promise<void>;
  
  /**
   * Get current playback state from Cast device
   */
  getPlaybackState(): Promise<CastPlaybackState>;
  
  /**
   * Disconnect from current Cast session
   */
  disconnect(): Promise<void>;
  
  // Event listeners
  addListener(
    eventName: 'castStateChange',
    listenerFunc: (event: CastStateInfo) => void
  ): Promise<PluginListenerHandle>;
  
  addListener(
    eventName: 'sessionEvent',
    listenerFunc: (event: CastSessionEvent) => void
  ): Promise<PluginListenerHandle>;
  
  addListener(
    eventName: 'playbackStateChange',
    listenerFunc: (event: { state: string }) => void
  ): Promise<PluginListenerHandle>;
  
  addListener(
    eventName: 'timeUpdate',
    listenerFunc: (event: CastTimeUpdate) => void
  ): Promise<PluginListenerHandle>;
  
  removeAllListeners(): Promise<void>;
}

// ============= Web Fallback =============

class NativeCastWeb implements NativeCastPlugin {
  async isAvailable(): Promise<{ available: boolean }> {
    // On web, Cast is handled by the existing CastController via Google Cast SDK
    return { available: false };
  }
  
  async getCastState(): Promise<CastStateInfo> {
    return { state: 'no_devices', isConnected: false };
  }
  
  async showCastDialog(): Promise<void> {
    console.warn('[NativeCast] showCastDialog not available on web - use CastController');
  }
  
  async loadMedia(_options: LoadMediaOptions): Promise<{ success: boolean }> {
    console.warn('[NativeCast] loadMedia not available on web - use CastController');
    return { success: false };
  }
  
  async play(): Promise<void> {
    console.warn('[NativeCast] play not available on web');
  }
  
  async pause(): Promise<void> {
    console.warn('[NativeCast] pause not available on web');
  }
  
  async stop(): Promise<void> {
    console.warn('[NativeCast] stop not available on web');
  }
  
  async seek(_options: { position: number }): Promise<void> {
    console.warn('[NativeCast] seek not available on web');
  }
  
  async setVolume(_options: { volume: number }): Promise<void> {
    console.warn('[NativeCast] setVolume not available on web');
  }
  
  async setMuted(_options: { muted: boolean }): Promise<void> {
    console.warn('[NativeCast] setMuted not available on web');
  }
  
  async getPlaybackState(): Promise<CastPlaybackState> {
    return {
      state: 'idle',
      currentTime: 0,
      duration: 0,
      volume: 1,
      isMuted: false,
    };
  }
  
  async disconnect(): Promise<void> {
    console.warn('[NativeCast] disconnect not available on web');
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async addListener(_eventName: string, _listenerFunc: (...args: any[]) => void): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  }
  
  async removeAllListeners(): Promise<void> {}
}

// ============= Register Plugin =============

/**
 * The NativeCast Capacitor plugin for Android Chromecast.
 * 
 * On Android: Uses Media3 CastPlayer via NativeCastPlugin.kt
 * On Web: Falls back to stub (use CastController for web casting)
 */
const NativeCast = registerPlugin<NativeCastPlugin>('NativeCast', {
  web: () => Promise.resolve(new NativeCastWeb()),
});

export { NativeCast };

// ============= Utility Functions =============

/**
 * Check if native casting is available (Android only)
 */
export async function isNativeCastAvailable(): Promise<boolean> {
  try {
    const { available } = await NativeCast.isAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Get the platform for casting decisions
 */
export function getCastPlatform(): 'android' | 'ios' | 'web' {
  const cap = (window as unknown as { 
    Capacitor?: { 
      getPlatform?: () => string;
    } 
  }).Capacitor;
  const platform = cap?.getPlatform?.();
  if (platform === 'android') return 'android';
  if (platform === 'ios') return 'ios';
  return 'web';
}
