/**
 * Html5Engine - Native HTML5 video player engine (fallback)
 */

import { BaseEngine } from './BaseEngine';
import { MediaSource, EngineCapabilities, SubtitleTrack, AudioTrack } from '../types';

export class Html5Engine extends BaseEngine {
  readonly id = 'html5';
  readonly displayName = 'HTML5 Player';
  readonly supports: EngineCapabilities = {
    live: true,
    vod: true,
    casting: false,
    externalSubtitles: true,
    embeddedSubtitles: false,
    drm: false,
    adaptiveBitrate: false,
    pip: true,
  };
  
  private video: HTMLVideoElement | null = null;
  private loadStartTime = 0;
  private boundHandlers: Record<string, EventListener> = {};
  
  attach(containerEl: HTMLElement): void {
    super.attach(containerEl);
    
    this.video = document.createElement('video');
    this.video.className = 'w-full h-full object-contain';
    this.video.playsInline = true;
    this.video.crossOrigin = 'anonymous';
    
    containerEl.appendChild(this.video);
    this.setupEventListeners();
  }
  
  detach(): void {
    this.removeEventListeners();
    if (this.video?.parentElement) {
      this.video.parentElement.removeChild(this.video);
    }
    this.video = null;
    super.detach();
  }
  
  async destroy(): Promise<void> {
    await this.stop();
    this.detach();
    this.stateListeners.clear();
  }
  
  private setupEventListeners(): void {
    if (!this.video) return;
    
    const handlers: Record<string, () => void> = {
      loadstart: () => {
        this.loadStartTime = performance.now();
        this.setStatus('loading');
      },
      loadedmetadata: () => {
        this.updateState({ 
          duration: this.video?.duration || 0,
        });
      },
      canplay: () => {
        if (this.state.status === 'loading' || this.state.status === 'buffering') {
          this.setStatus('paused');
        }
      },
      playing: () => {
        this.setStatus('playing');
        this.setError(null);
      },
      pause: () => {
        if (this.state.status !== 'error') {
          this.setStatus('paused');
        }
      },
      waiting: () => {
        this.setStatus('buffering');
      },
      ended: () => {
        this.setStatus('ended');
      },
      timeupdate: () => {
        this.updateState({ 
          currentTime: this.video?.currentTime || 0,
        });
      },
      progress: () => {
        const buffered = this.video?.buffered;
        if (buffered && buffered.length > 0) {
          this.updateState({ 
            buffered: buffered.end(buffered.length - 1),
          });
        }
      },
      volumechange: () => {
        this.updateState({
          volume: this.video?.volume || 1,
          isMuted: this.video?.muted || false,
        });
      },
      ratechange: () => {
        this.updateState({
          playbackRate: this.video?.playbackRate || 1,
        });
      },
      error: () => {
        const mediaError = this.video?.error;
        const code = this.mapMediaErrorCode(mediaError?.code);
        this.setError(this.createError(
          code,
          mediaError?.message || 'Playback error',
          code !== 'MEDIA_ERR_SRC_NOT_SUPPORTED',
          { mediaErrorCode: mediaError?.code }
        ));
      },
    };
    
    Object.entries(handlers).forEach(([event, handler]) => {
      this.boundHandlers[event] = handler as EventListener;
      this.video!.addEventListener(event, handler);
    });
  }
  
  private removeEventListeners(): void {
    if (!this.video) return;
    
    Object.entries(this.boundHandlers).forEach(([event, handler]) => {
      this.video!.removeEventListener(event, handler);
    });
    this.boundHandlers = {};
  }
  
  private mapMediaErrorCode(code?: number): string {
    switch (code) {
      case 1: return 'MEDIA_ERR_ABORTED';
      case 2: return 'MEDIA_ERR_NETWORK';
      case 3: return 'MEDIA_ERR_DECODE';
      case 4: return 'MEDIA_ERR_SRC_NOT_SUPPORTED';
      default: return 'MEDIA_ERR_UNKNOWN';
    }
  }
  
  async load(source: MediaSource): Promise<void> {
    if (!this.video) {
      throw new Error('Engine not attached');
    }
    
    this.source = source;
    this.setStatus('loading');
    this.setError(null);
    
    // Clear existing tracks
    this.subtitleTracks = [];
    this.audioTracks = [];
    
    // Set source
    this.video.src = source.url;
    
    // Add external subtitle tracks
    if (source.subtitleTracks) {
      source.subtitleTracks
        .filter(t => t.kind === 'external' && t.url)
        .forEach((track, index) => {
          const trackEl = document.createElement('track');
          trackEl.kind = 'subtitles';
          trackEl.label = track.label;
          trackEl.srclang = track.lang || 'und';
          trackEl.src = track.url!;
          if (index === 0) trackEl.default = true;
          this.video!.appendChild(trackEl);
          
          this.subtitleTracks.push(track);
        });
    }
    
    // Load video
    this.video.load();
    
    // Resume from position if specified
    if (source.startPosition && source.startPosition > 0) {
      this.video.currentTime = source.startPosition;
    }
  }
  
  async play(): Promise<void> {
    if (!this.video) return;
    
    try {
      await this.video.play();
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        this.setError(this.createError(
          'PLAY_FAILED',
          error.message,
          true
        ));
      }
    }
  }
  
  async pause(): Promise<void> {
    this.video?.pause();
  }
  
  async stop(): Promise<void> {
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.video.load();
    }
    this.setStatus('idle');
    this.source = null;
  }
  
  async seek(seconds: number): Promise<void> {
    if (this.video) {
      this.video.currentTime = Math.max(0, Math.min(seconds, this.state.duration));
    }
  }
  
  setVolume(volume: number): void {
    if (this.video) {
      this.video.volume = Math.max(0, Math.min(1, volume));
    }
  }
  
  setMuted(muted: boolean): void {
    if (this.video) {
      this.video.muted = muted;
    }
  }
  
  setPlaybackRate(rate: number): void {
    if (this.video) {
      this.video.playbackRate = rate;
    }
  }
  
  async setSubtitle(id?: string): Promise<void> {
    if (!this.video) return;
    
    const textTracks = Array.from(this.video.textTracks);
    textTracks.forEach((track, index) => {
      const trackId = this.subtitleTracks[index]?.id;
      track.mode = trackId === id ? 'showing' : 'hidden';
    });
    
    await super.setSubtitle(id);
  }
  
  listAudioTracks(): AudioTrack[] {
    // HTML5 video has limited audio track support
    // This would need MediaSource Extensions for full support
    return super.listAudioTracks();
  }
  
  // Expose video element for advanced use (PiP, etc.)
  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }
}

// Factory
export const Html5EngineFactory = {
  id: 'html5',
  displayName: 'HTML5 Player',
  priority: 100, // Low priority - fallback
  
  isAvailable(): boolean {
    return typeof HTMLVideoElement !== 'undefined';
  },
  
  supportsSource(_source: MediaSource): boolean {
    // HTML5 can attempt to play anything, but may fail
    return true;
  },
  
  create(): Html5Engine {
    return new Html5Engine();
  },
};
