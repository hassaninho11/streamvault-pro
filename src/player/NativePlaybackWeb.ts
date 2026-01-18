/**
 * Web fallback for NativePlaybackPlugin
 * This provides a stub implementation that throws helpful errors on web
 */

import { WebPlugin } from '@capacitor/core';
import type {
  NativePlaybackPlugin,
  PlaybackState,
  LoadOptions,
  QualityLevel,
  AudioTrack,
  SubtitleTrack,
} from './NativePlaybackPlugin';

export class NativePlaybackWeb extends WebPlugin implements NativePlaybackPlugin {
  private notAvailable(): Error {
    return new Error('NativePlayback is not available on web. Use Hls.js or Shaka instead.');
  }

  async load(_options: LoadOptions): Promise<{ success: boolean }> {
    console.warn('[NativePlaybackWeb] load() called on web - not available');
    throw this.notAvailable();
  }

  async play(): Promise<void> {
    throw this.notAvailable();
  }

  async pause(): Promise<void> {
    throw this.notAvailable();
  }

  async stop(): Promise<void> {
    throw this.notAvailable();
  }

  async seek(_options: { position: number }): Promise<void> {
    throw this.notAvailable();
  }

  async setVolume(_options: { volume: number }): Promise<void> {
    throw this.notAvailable();
  }

  async setMuted(_options: { muted: boolean }): Promise<void> {
    throw this.notAvailable();
  }

  async setPlaybackRate(_options: { rate: number }): Promise<void> {
    throw this.notAvailable();
  }

  async getState(): Promise<PlaybackState> {
    throw this.notAvailable();
  }

  async getQualityLevels(): Promise<{ levels: QualityLevel[] }> {
    throw this.notAvailable();
  }

  async setQualityLevel(_options: { levelId: string | 'auto' }): Promise<void> {
    throw this.notAvailable();
  }

  async getAudioTracks(): Promise<{ tracks: AudioTrack[] }> {
    throw this.notAvailable();
  }

  async setAudioTrack(_options: { trackId: string }): Promise<void> {
    throw this.notAvailable();
  }

  async getSubtitleTracks(): Promise<{ tracks: SubtitleTrack[] }> {
    throw this.notAvailable();
  }

  async setSubtitleTrack(_options: { trackId: string | null }): Promise<void> {
    throw this.notAvailable();
  }

  async isPipSupported(): Promise<{ supported: boolean }> {
    // Web may support PiP through Picture-in-Picture API
    return { 
      supported: 'pictureInPictureEnabled' in document 
    };
  }

  async enterPip(): Promise<void> {
    throw this.notAvailable();
  }

  async exitPip(): Promise<void> {
    throw this.notAvailable();
  }

  async getEngineInfo(): Promise<{ 
    name: string; 
    version: string; 
    platform: 'android' | 'ios' | 'web';
  }> {
    return {
      name: 'WebFallback',
      version: '0.0.0',
      platform: 'web',
    };
  }
}
