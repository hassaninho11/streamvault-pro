/**
 * AndroidPlaybackController - Unified controller for Android native playback
 * Handles ExoPlayer as primary engine with automatic VLC fallback for unsupported formats
 */

import { MediaSource, PlayerState, PlayerSettings, PlayerDiagnostics, DEFAULT_PLAYER_SETTINGS } from './types';
import { ExoPlayerBridgeEngine, ExoPlayerBridgeEngineFactory } from './engines/ExoPlayerBridgeEngine';
import { VlcBridgeEngine, VlcBridgeEngineFactory } from './engines/VlcBridgeEngine';
import { isNativePlatform, getPlatform } from './NativePlaybackPlugin';
import { localStore } from '@/data/stores/localStore';
import { toast } from 'sonner';

// ============= Types =============

export interface AndroidPlaybackEvents {
  onStateChange?: (state: PlayerState) => void;
  onEngineChange?: (engineId: string, reason: 'initial' | 'fallback' | 'user') => void;
  onError?: (error: { code: string; message: string; recoverable: boolean }) => void;
}

export type AndroidEngineType = 'exo' | 'vlc' | 'auto';

// ============= Unsupported Format Detection =============

const UNSUPPORTED_BY_EXOPLAYER = ['.rmvb', '.rm', '.mov'];
const PREFER_VLC_FORMATS = ['.mkv', '.avi', '.wmv', '.flv', '.webm'];

function detectContainerFromUrl(url: string): string {
  const lower = url.toLowerCase();
  const match = lower.match(/\.([a-z0-9]+)(?:\?|$)/);
  return match ? match[1] : 'unknown';
}

function shouldPreferVlc(url: string): boolean {
  const lower = url.toLowerCase();
  return PREFER_VLC_FORMATS.some(ext => lower.includes(ext));
}

function isUnsupportedByExoPlayer(url: string): boolean {
  const lower = url.toLowerCase();
  return UNSUPPORTED_BY_EXOPLAYER.some(ext => lower.includes(ext));
}

// ============= Android Playback Controller =============

export class AndroidPlaybackController {
  private currentEngine: ExoPlayerBridgeEngine | VlcBridgeEngine | null = null;
  private currentSource: MediaSource | null = null;
  private events: AndroidPlaybackEvents;
  private settings: PlayerSettings;
  private stateUnsubscribe: (() => void) | null = null;
  
  // Retry/fallback tracking
  private fallbackAttempted = false;
  private diagnostics: PlayerDiagnostics = {
    currentEngine: 'none',
    fallbackCount: 0,
    lastErrorCode: null,
    loadLatencyMs: 0,
    playLatencyMs: 0,
    bufferingEvents: 0,
    totalBufferingMs: 0,
  };
  
  constructor(events?: AndroidPlaybackEvents, settings?: Partial<PlayerSettings>) {
    this.events = events || {};
    this.settings = { ...DEFAULT_PLAYER_SETTINGS, ...settings };
  }
  
  // ============= Engine Selection =============
  
  private async selectEngine(source: MediaSource): Promise<'exo' | 'vlc'> {
    // Check user preference from settings
    const localSettings = await localStore.getSettings();
    const mkvPreference = (localSettings as { mkvPlayerPreference?: string }).mkvPlayerPreference || 'auto';
    
    const container = detectContainerFromUrl(source.url);
    const isMkvOrSimilar = PREFER_VLC_FORMATS.some(ext => ext.includes(container));
    
    // If user explicitly chose VLC for MKV-type files
    if (isMkvOrSimilar && mkvPreference === 'vlc') {
      console.log('[AndroidPlayback] User preference: VLC for', container);
      return 'vlc';
    }
    
    // If format is completely unsupported by ExoPlayer
    if (isUnsupportedByExoPlayer(source.url)) {
      console.log('[AndroidPlayback] Format unsupported by ExoPlayer, using VLC');
      return 'vlc';
    }
    
    // If auto and it's a format that might have issues, try ExoPlayer first
    // but be ready to fallback
    if (mkvPreference === 'auto' && isMkvOrSimilar) {
      console.log('[AndroidPlayback] Auto mode: trying ExoPlayer first for', container);
      return 'exo';
    }
    
    // Default to ExoPlayer
    return 'exo';
  }
  
  private createEngine(type: 'exo' | 'vlc'): ExoPlayerBridgeEngine | VlcBridgeEngine {
    if (type === 'vlc') {
      return new VlcBridgeEngine();
    }
    return new ExoPlayerBridgeEngine();
  }
  
  // ============= Playback Control =============
  
  async load(source: MediaSource): Promise<void> {
    console.log('[AndroidPlayback] Loading:', source.url.substring(0, 80));
    
    // Clean up previous playback
    await this.cleanup();
    
    this.currentSource = source;
    this.fallbackAttempted = false;
    
    // Select appropriate engine
    const engineType = await this.selectEngine(source);
    console.log('[AndroidPlayback] Selected engine:', engineType);
    
    await this.loadWithEngine(source, engineType, 'initial');
  }
  
  private async loadWithEngine(
    source: MediaSource, 
    engineType: 'exo' | 'vlc',
    reason: 'initial' | 'fallback' | 'user'
  ): Promise<void> {
    // Create engine
    this.currentEngine = this.createEngine(engineType);
    this.diagnostics.currentEngine = engineType === 'vlc' ? 'VLC' : 'ExoPlayer';
    
    // Subscribe to state changes
    this.stateUnsubscribe = this.currentEngine.onStateChange((state) => {
      this.handleStateChange(state);
    });
    
    // Notify engine change
    this.events.onEngineChange?.(this.currentEngine.id, reason);
    
    if (reason === 'fallback') {
      toast.info('Bytte till kompatibelt läge (VLC)', {
        duration: 2000,
      });
    }
    
    try {
      await this.currentEngine.load(source);
    } catch (error) {
      console.error('[AndroidPlayback] Load failed:', error);
      
      // Try fallback if we haven't already
      if (!this.fallbackAttempted && engineType === 'exo') {
        await this.attemptVlcFallback(source);
      } else {
        this.events.onError?.({
          code: 'LOAD_FAILED',
          message: error instanceof Error ? error.message : 'Kunde inte spela upp videon',
          recoverable: false,
        });
      }
    }
  }
  
  private handleStateChange(state: PlayerState): void {
    // Check for errors that might warrant fallback
    if (state.status === 'error' && state.error && !this.fallbackAttempted) {
      const recoverable = state.error.recoverable;
      const isSourceError = state.error.code.includes('SOURCE') || 
                            state.error.code.includes('DECODER') ||
                            state.error.code.includes('UNSUPPORTED');
      
      // If it's a source/decoder error and we're on ExoPlayer, try VLC
      if (isSourceError && this.currentEngine?.id === 'exo-bridge' && this.currentSource) {
        console.log('[AndroidPlayback] Source error on ExoPlayer, attempting VLC fallback');
        this.attemptVlcFallback(this.currentSource);
        return;
      }
    }
    
    // Forward state to listeners
    this.events.onStateChange?.(state);
  }
  
  private async attemptVlcFallback(source: MediaSource): Promise<void> {
    console.log('[AndroidPlayback] Attempting VLC fallback');
    this.fallbackAttempted = true;
    
    // Clean up current engine
    if (this.currentEngine) {
      try {
        await this.currentEngine.destroy();
      } catch (e) {
        console.warn('[AndroidPlayback] Error destroying engine:', e);
      }
    }
    
    // Load with VLC
    await this.loadWithEngine(source, 'vlc', 'fallback');
  }
  
  async play(): Promise<void> {
    await this.currentEngine?.play();
  }
  
  async pause(): Promise<void> {
    await this.currentEngine?.pause();
  }
  
  async stop(): Promise<void> {
    await this.currentEngine?.stop();
  }
  
  async seek(seconds: number): Promise<void> {
    await this.currentEngine?.seek(seconds);
  }
  
  setVolume(volume: number): void {
    this.currentEngine?.setVolume(volume);
  }
  
  setMuted(muted: boolean): void {
    this.currentEngine?.setMuted(muted);
  }
  
  toggleMute(): void {
    const state = this.currentEngine?.getState();
    if (state) {
      this.setMuted(!state.isMuted);
    }
  }
  
  setPlaybackRate(rate: number): void {
    this.currentEngine?.setPlaybackRate(rate);
  }
  
  // ============= Track Management =============
  
  listSubtitles() {
    return this.currentEngine?.listSubtitles() || [];
  }
  
  async setSubtitle(id?: string): Promise<void> {
    await this.currentEngine?.setSubtitle(id);
  }
  
  listAudioTracks() {
    return this.currentEngine?.listAudioTracks() || [];
  }
  
  async setAudioTrack(id?: string): Promise<void> {
    await this.currentEngine?.setAudioTrack(id);
  }
  
  // ============= State & Diagnostics =============
  
  getState(): PlayerState {
    return this.currentEngine?.getState() || {
      status: 'idle',
      currentTime: 0,
      duration: 0,
      buffered: 0,
      volume: 1,
      isMuted: false,
      playbackRate: 1,
      error: null,
    };
  }
  
  getDiagnostics(): PlayerDiagnostics {
    return { ...this.diagnostics };
  }
  
  getCurrentEngine(): string {
    return this.currentEngine?.id || 'none';
  }
  
  // ============= Manual Engine Switch =============
  
  async switchToVlc(): Promise<void> {
    if (!this.currentSource) return;
    
    console.log('[AndroidPlayback] Manual switch to VLC');
    await this.cleanup();
    this.fallbackAttempted = true; // Don't auto-fallback again
    await this.loadWithEngine(this.currentSource, 'vlc', 'user');
  }
  
  async switchToExoPlayer(): Promise<void> {
    if (!this.currentSource) return;
    
    console.log('[AndroidPlayback] Manual switch to ExoPlayer');
    await this.cleanup();
    await this.loadWithEngine(this.currentSource, 'exo', 'user');
  }
  
  // ============= Cleanup =============
  
  private async cleanup(): Promise<void> {
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }
    
    if (this.currentEngine) {
      try {
        await this.currentEngine.destroy();
      } catch (e) {
        console.warn('[AndroidPlayback] Error during cleanup:', e);
      }
      this.currentEngine = null;
    }
  }
  
  async destroy(): Promise<void> {
    console.log('[AndroidPlayback] Destroying controller');
    await this.cleanup();
    this.currentSource = null;
  }
}

// ============= Singleton =============

let androidController: AndroidPlaybackController | null = null;

export function getAndroidPlaybackController(
  events?: AndroidPlaybackEvents,
  settings?: Partial<PlayerSettings>
): AndroidPlaybackController {
  // Only create on Android
  if (!isNativePlatform() || getPlatform() !== 'android') {
    throw new Error('AndroidPlaybackController is only available on Android');
  }
  
  if (!androidController) {
    androidController = new AndroidPlaybackController(events, settings);
  }
  return androidController;
}

export function resetAndroidPlaybackController(): void {
  if (androidController) {
    androidController.destroy();
    androidController = null;
  }
}

export function isAndroidPlaybackAvailable(): boolean {
  return isNativePlatform() && getPlatform() === 'android';
}
