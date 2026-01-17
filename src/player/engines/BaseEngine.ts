/**
 * BaseEngine - Abstract base class for player engines
 */

import {
  MediaPlayerEngine,
  MediaSource,
  PlayerState,
  PlayerStatus,
  EngineCapabilities,
  SubtitleTrack,
  AudioTrack,
  PlayerError,
} from '../types';

export abstract class BaseEngine implements MediaPlayerEngine {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly supports: EngineCapabilities;
  
  protected container: HTMLElement | null = null;
  protected source: MediaSource | null = null;
  protected stateListeners: Set<(state: PlayerState) => void> = new Set();
  protected subtitleTracks: SubtitleTrack[] = [];
  protected audioTracks: AudioTrack[] = [];
  
  protected state: PlayerState = {
    status: 'idle',
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    error: null,
  };
  
  attach(containerEl: HTMLElement): void {
    this.container = containerEl;
  }
  
  detach(): void {
    this.container = null;
  }
  
  abstract destroy(): Promise<void>;
  abstract load(source: MediaSource): Promise<void>;
  abstract play(): Promise<void>;
  abstract pause(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract seek(seconds: number): Promise<void>;
  abstract setVolume(volume: number): void;
  abstract setMuted(muted: boolean): void;
  abstract setPlaybackRate(rate: number): void;
  
  getState(): PlayerState {
    return { ...this.state };
  }
  
  onStateChange(callback: (state: PlayerState) => void): () => void {
    this.stateListeners.add(callback);
    // Immediately call with current state
    callback(this.getState());
    return () => {
      this.stateListeners.delete(callback);
    };
  }
  
  protected updateState(partial: Partial<PlayerState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyStateChange();
  }
  
  protected setStatus(status: PlayerStatus): void {
    this.updateState({ status });
  }
  
  protected setError(error: PlayerError | null): void {
    this.updateState({ 
      error,
      status: error ? 'error' : this.state.status,
    });
  }
  
  protected notifyStateChange(): void {
    const state = this.getState();
    this.stateListeners.forEach(cb => {
      try {
        cb(state);
      } catch (e) {
        console.error('[BaseEngine] State listener error:', e);
      }
    });
  }
  
  listSubtitles(): SubtitleTrack[] {
    return [...this.subtitleTracks];
  }
  
  async setSubtitle(id?: string): Promise<void> {
    this.updateState({ currentSubtitleId: id });
  }
  
  listAudioTracks(): AudioTrack[] {
    return [...this.audioTracks];
  }
  
  async setAudioTrack(id?: string): Promise<void> {
    this.updateState({ currentAudioId: id });
  }
  
  protected createError(
    code: string, 
    message: string, 
    recoverable = true, 
    details?: unknown
  ): PlayerError {
    return { code, message, recoverable, details };
  }
}
