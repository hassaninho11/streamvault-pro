/**
 * ShakaEngine - Shaka Player engine for HLS/DASH streams
 * 
 * Note: This uses dynamic import for shaka-player to avoid bundling it
 * if not used. For production, you'd install: npm install shaka-player
 */

import { BaseEngine } from './BaseEngine';
import { MediaSource, EngineCapabilities, AudioTrack, SubtitleTrack, BufferMode } from '../types';

// Type definitions for Shaka Player
interface ShakaPlayer {
  configure(config: Record<string, unknown>): void;
  load(uri: string, startTime?: number): Promise<void>;
  unload(): Promise<void>;
  play(): void;
  pause(): void;
  getMediaElement(): HTMLVideoElement | null;
  getTextTracks(): ShakaTextTrack[];
  getVariantTracks(): ShakaVariantTrack[];
  selectTextTrack(track: ShakaTextTrack): void;
  selectVariantTrack(track: ShakaVariantTrack, clearBuffer?: boolean): void;
  setTextTrackVisibility(visible: boolean): void;
  addEventListener(event: string, callback: (event: ShakaEvent) => void): void;
  removeEventListener(event: string, callback: (event: ShakaEvent) => void): void;
  destroy(): Promise<void>;
}

interface ShakaTextTrack {
  id: number;
  language: string;
  label: string;
  active: boolean;
}

interface ShakaVariantTrack {
  id: number;
  language: string;
  label: string | null;
  audioId: number;
}

interface ShakaEvent {
  type: string;
  detail?: unknown;
}

interface ShakaPlayerConstructor {
  new (video: HTMLVideoElement): ShakaPlayer;
  isBrowserSupported(): boolean;
}

interface ShakaModule {
  Player: ShakaPlayerConstructor;
  polyfill: {
    installAll(): void;
  };
}

export class ShakaEngine extends BaseEngine {
  readonly id = 'shaka';
  readonly displayName = 'Shaka Player';
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
  
  private video: HTMLVideoElement | null = null;
  private player: ShakaPlayer | null = null;
  private shaka: ShakaModule | null = null;
  private boundHandlers: Record<string, EventListener> = {};
  private bufferMode: BufferMode = 'balanced';
  
  static isSupported = false;
  static supportChecked = false;
  
  static async checkSupport(): Promise<boolean> {
    if (ShakaEngine.supportChecked) {
      return ShakaEngine.isSupported;
    }
    
    try {
      // Try to dynamically import shaka-player
      // In production, this would be: import('shaka-player')
      // For now, we'll check if it's globally available or simulate support
      const globalShaka = (window as unknown as { shaka?: ShakaModule }).shaka;
      if (globalShaka) {
        globalShaka.polyfill.installAll();
        ShakaEngine.isSupported = globalShaka.Player.isBrowserSupported();
      } else {
        // Shaka not available - use HTML5 fallback
        ShakaEngine.isSupported = false;
      }
    } catch {
      ShakaEngine.isSupported = false;
    }
    
    ShakaEngine.supportChecked = true;
    return ShakaEngine.isSupported;
  }
  
  setBufferMode(mode: BufferMode): void {
    this.bufferMode = mode;
    this.applyBufferConfig();
  }
  
  private applyBufferConfig(): void {
    if (!this.player) return;
    
    const configs: Record<BufferMode, Record<string, unknown>> = {
      'balanced': {
        streaming: {
          bufferingGoal: 30,
          rebufferingGoal: 5,
          bufferBehind: 30,
        },
      },
      'low-latency': {
        streaming: {
          bufferingGoal: 10,
          rebufferingGoal: 2,
          bufferBehind: 10,
          lowLatencyMode: true,
        },
      },
      'stability': {
        streaming: {
          bufferingGoal: 60,
          rebufferingGoal: 10,
          bufferBehind: 60,
        },
      },
    };
    
    this.player.configure(configs[this.bufferMode]);
  }
  
  attach(containerEl: HTMLElement): void {
    super.attach(containerEl);
    
    this.video = document.createElement('video');
    this.video.className = 'w-full h-full object-contain';
    this.video.playsInline = true;
    this.video.crossOrigin = 'anonymous';
    
    containerEl.appendChild(this.video);
    this.setupVideoListeners();
    this.initializePlayer();
  }
  
  private async initializePlayer(): Promise<void> {
    if (!this.video) return;
    
    try {
      const globalShaka = (window as unknown as { shaka?: ShakaModule }).shaka;
      if (!globalShaka) {
        console.warn('[ShakaEngine] Shaka Player not loaded, using stub mode');
        return;
      }
      
      this.shaka = globalShaka;
      this.player = new this.shaka.Player(this.video);
      
      this.applyBufferConfig();
      this.setupPlayerListeners();
    } catch (error) {
      console.error('[ShakaEngine] Failed to initialize:', error);
    }
  }
  
  private setupVideoListeners(): void {
    if (!this.video) return;
    
    const handlers: Record<string, () => void> = {
      playing: () => this.setStatus('playing'),
      pause: () => {
        if (this.state.status !== 'error') {
          this.setStatus('paused');
        }
      },
      waiting: () => this.setStatus('buffering'),
      ended: () => this.setStatus('ended'),
      timeupdate: () => {
        this.updateState({ 
          currentTime: this.video?.currentTime || 0,
        });
      },
      volumechange: () => {
        this.updateState({
          volume: this.video?.volume || 1,
          isMuted: this.video?.muted || false,
        });
      },
      durationchange: () => {
        this.updateState({ duration: this.video?.duration || 0 });
      },
    };
    
    Object.entries(handlers).forEach(([event, handler]) => {
      this.boundHandlers[event] = handler as EventListener;
      this.video!.addEventListener(event, handler);
    });
  }
  
  private setupPlayerListeners(): void {
    if (!this.player) return;
    
    this.player.addEventListener('error', (event) => {
      const detail = event.detail as { code?: number; message?: string } | undefined;
      this.setError(this.createError(
        `SHAKA_${detail?.code || 'UNKNOWN'}`,
        detail?.message || 'Shaka player error',
        true
      ));
    });
    
    this.player.addEventListener('buffering', (event) => {
      const detail = event.detail as { buffering?: boolean } | undefined;
      if (detail?.buffering) {
        this.setStatus('buffering');
      } else if (this.state.status === 'buffering') {
        this.setStatus('playing');
      }
    });
  }
  
  detach(): void {
    Object.entries(this.boundHandlers).forEach(([event, handler]) => {
      this.video?.removeEventListener(event, handler);
    });
    this.boundHandlers = {};
    
    if (this.video?.parentElement) {
      this.video.parentElement.removeChild(this.video);
    }
    this.video = null;
    super.detach();
  }
  
  async destroy(): Promise<void> {
    if (this.player) {
      await this.player.destroy();
      this.player = null;
    }
    this.detach();
    this.stateListeners.clear();
    this.shaka = null;
  }
  
  async load(source: MediaSource): Promise<void> {
    this.source = source;
    this.setStatus('loading');
    this.setError(null);
    
    // If Shaka not available, fall back to direct HTML5
    if (!this.player && this.video) {
      console.log('[ShakaEngine] No Shaka instance, using HTML5 fallback');
      this.video.src = source.url;
      this.video.load();
      if (source.startPosition) {
        this.video.currentTime = source.startPosition;
      }
      return;
    }
    
    if (!this.player) {
      throw new Error('Player not initialized');
    }
    
    try {
      // Configure DRM if provided
      if (source.drm) {
        const drmConfig: Record<string, unknown> = {
          drm: {
            servers: {
              [source.drm.scheme === 'widevine' ? 'com.widevine.alpha' : 
               source.drm.scheme === 'fairplay' ? 'com.apple.fps.1_0' : 
               'com.microsoft.playready']: source.drm.licenseUrl,
            },
          },
        };
        this.player.configure(drmConfig);
      }
      
      await this.player.load(source.url, source.startPosition || 0);
      
      // Populate tracks
      this.subtitleTracks = this.player.getTextTracks().map(t => ({
        id: String(t.id),
        label: t.label || t.language,
        lang: t.language,
        kind: 'embedded' as const,
      }));
      
      const audioTracks = this.player.getVariantTracks();
      const uniqueAudio = new Map<number, ShakaVariantTrack>();
      audioTracks.forEach(t => {
        if (!uniqueAudio.has(t.audioId)) {
          uniqueAudio.set(t.audioId, t);
        }
      });
      this.audioTracks = Array.from(uniqueAudio.values()).map(t => ({
        id: String(t.audioId),
        label: t.label || t.language,
        lang: t.language,
      }));
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Load failed';
      this.setError(this.createError('LOAD_FAILED', message, true));
      throw error;
    }
  }
  
  async play(): Promise<void> {
    if (this.player) {
      const video = this.player.getMediaElement();
      if (video) {
        await video.play();
      }
    } else if (this.video) {
      await this.video.play();
    }
  }
  
  async pause(): Promise<void> {
    if (this.player) {
      const video = this.player.getMediaElement();
      video?.pause();
    } else {
      this.video?.pause();
    }
  }
  
  async stop(): Promise<void> {
    if (this.player) {
      await this.player.unload();
    } else if (this.video) {
      this.video.pause();
      this.video.src = '';
    }
    this.setStatus('idle');
    this.source = null;
  }
  
  async seek(seconds: number): Promise<void> {
    const video = this.player?.getMediaElement() || this.video;
    if (video) {
      video.currentTime = Math.max(0, Math.min(seconds, this.state.duration || Infinity));
    }
  }
  
  setVolume(volume: number): void {
    const video = this.player?.getMediaElement() || this.video;
    if (video) {
      video.volume = Math.max(0, Math.min(1, volume));
    }
  }
  
  setMuted(muted: boolean): void {
    const video = this.player?.getMediaElement() || this.video;
    if (video) {
      video.muted = muted;
    }
  }
  
  setPlaybackRate(rate: number): void {
    const video = this.player?.getMediaElement() || this.video;
    if (video) {
      video.playbackRate = rate;
    }
  }
  
  async setSubtitle(id?: string): Promise<void> {
    if (!this.player) {
      await super.setSubtitle(id);
      return;
    }
    
    if (id) {
      const track = this.player.getTextTracks().find(t => String(t.id) === id);
      if (track) {
        this.player.selectTextTrack(track);
        this.player.setTextTrackVisibility(true);
      }
    } else {
      this.player.setTextTrackVisibility(false);
    }
    
    await super.setSubtitle(id);
  }
  
  async setAudioTrack(id?: string): Promise<void> {
    if (!this.player || !id) {
      await super.setAudioTrack(id);
      return;
    }
    
    const tracks = this.player.getVariantTracks();
    const track = tracks.find(t => String(t.audioId) === id);
    if (track) {
      this.player.selectVariantTrack(track, true);
    }
    
    await super.setAudioTrack(id);
  }
  
  getVideoElement(): HTMLVideoElement | null {
    return this.player?.getMediaElement() || this.video;
  }
}

// Factory
export const ShakaEngineFactory = {
  id: 'shaka',
  displayName: 'Shaka Player',
  priority: 10, // High priority for web
  
  isAvailable(): boolean {
    // Check if Shaka is loaded
    const globalShaka = (window as unknown as { shaka?: unknown }).shaka;
    return !!globalShaka || true; // We support fallback mode
  },
  
  supportsSource(source: MediaSource): boolean {
    const url = source.url.toLowerCase();
    // Shaka handles HLS, DASH, and smooth streaming
    return url.includes('.m3u8') || 
           url.includes('.mpd') || 
           url.includes('manifest') ||
           source.mimeHint?.includes('mpegurl') ||
           source.mimeHint?.includes('dash') ||
           true; // Can attempt any source
  },
  
  create(): ShakaEngine {
    return new ShakaEngine();
  },
};
