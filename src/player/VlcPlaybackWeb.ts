/**
 * VlcPlaybackWeb - Web fallback for VLC plugin
 * Shows instructions to use external VLC player on web
 */

import type { PluginListenerHandle } from '@capacitor/core';

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

type StateChangeCallback = (event: { state: VlcPlaybackState }) => void;
type ErrorCallback = (event: { error: VlcError }) => void;
type TimeUpdateCallback = (event: { currentTime: number; duration: number }) => void;

export class VlcPlaybackWeb {
  private listeners: Map<string, Array<StateChangeCallback | ErrorCallback | TimeUpdateCallback>> = new Map();
  private currentUrl: string | null = null;
  
  async load(options: { 
    url: string; 
    headers?: Record<string, string>;
    startPosition?: number;
    autoPlay?: boolean;
  }): Promise<{ success: boolean }> {
    console.log('[VlcPlaybackWeb] VLC not available on web - opening in external player');
    this.currentUrl = options.url;
    
    // Notify error - VLC not available on web
    const errorListeners = this.listeners.get('error') as ErrorCallback[] | undefined;
    if (errorListeners) {
      errorListeners.forEach(cb => cb({
        error: {
          code: 'WEB_NOT_SUPPORTED',
          message: 'VLC är inte tillgängligt i webbläsaren. Använd Android/iOS-appen för VLC-uppspelning.',
        }
      }));
    }
    
    return { success: false };
  }
  
  async play(): Promise<void> {
    console.log('[VlcPlaybackWeb] Play not available on web');
  }
  
  async pause(): Promise<void> {
    console.log('[VlcPlaybackWeb] Pause not available on web');
  }
  
  async stop(): Promise<void> {
    console.log('[VlcPlaybackWeb] Stop not available on web');
  }
  
  async seek(_options: { position: number }): Promise<void> {
    console.log('[VlcPlaybackWeb] Seek not available on web');
  }
  
  async setVolume(_options: { volume: number }): Promise<void> {
    console.log('[VlcPlaybackWeb] SetVolume not available on web');
  }
  
  async setMuted(_options: { muted: boolean }): Promise<void> {
    console.log('[VlcPlaybackWeb] SetMuted not available on web');
  }
  
  async getState(): Promise<VlcPlaybackState> {
    return {
      status: 'error',
      currentTime: 0,
      duration: 0,
      buffered: 0,
      volume: 1,
      isMuted: false,
    };
  }
  
  async destroy(): Promise<void> {
    this.currentUrl = null;
    this.listeners.clear();
  }
  
  async addListener(
    event: 'stateChange' | 'error' | 'timeUpdate',
    callback: StateChangeCallback | ErrorCallback | TimeUpdateCallback
  ): Promise<PluginListenerHandle> {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    
    return {
      remove: async () => {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      }
    };
  }
  
  async removeAllListeners(): Promise<void> {
    this.listeners.clear();
  }
  
  getExternalPlayerUrl(): string | null {
    if (!this.currentUrl) return null;
    
    // Return VLC deep link
    return `vlc://${this.currentUrl}`;
  }
}
