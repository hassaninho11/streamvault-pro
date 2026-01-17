/**
 * UnifiedPlayerController - Central controller with engine abstraction,
 * retry/fallback policy, and cast mode support
 */

import { 
  MediaPlayerEngine, 
  MediaSource, 
  PlayerState, 
  PlayerSettings, 
  DEFAULT_PLAYER_SETTINGS,
  PlayerDiagnostics,
  PlayerStatus,
} from './types';
import { PlayerEngineRegistry } from './PlayerEngineRegistry';
import { toast } from 'sonner';

export interface PlayerControllerEvents {
  onStateChange?: (state: PlayerState) => void;
  onEngineChange?: (engineId: string) => void;
  onCastStateChange?: (isCasting: boolean, deviceName?: string) => void;
  onError?: (error: { code: string; message: string }) => void;
}

interface RetryState {
  attempts: number;
  currentEngineIndex: number;
  lastErrorCode: string | null;
}

const INITIAL_PLAYER_STATE: PlayerState = {
  status: 'idle',
  currentTime: 0,
  duration: 0,
  buffered: 0,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  error: null,
};

export class UnifiedPlayerController {
  private engine: MediaPlayerEngine | null = null;
  private container: HTMLElement | null = null;
  private source: MediaSource | null = null;
  private settings: PlayerSettings;
  private events: PlayerControllerEvents;
  
  private state: PlayerState = { ...INITIAL_PLAYER_STATE };
  private retryState: RetryState = { attempts: 0, currentEngineIndex: 0, lastErrorCode: null };
  private availableEngines: string[] = [];
  
  private stateUnsubscribe: (() => void) | null = null;
  private retryTimeoutId: number | null = null;
  private debounceTimeoutId: number | null = null;
  
  // Diagnostics
  private diagnostics: PlayerDiagnostics = {
    currentEngine: '',
    fallbackCount: 0,
    lastErrorCode: null,
    loadLatencyMs: 0,
    playLatencyMs: 0,
    bufferingEvents: 0,
    totalBufferingMs: 0,
  };
  private loadStartTime = 0;
  private bufferingStartTime = 0;
  
  constructor(settings?: Partial<PlayerSettings>, events?: PlayerControllerEvents) {
    this.settings = { ...DEFAULT_PLAYER_SETTINGS, ...settings };
    this.events = events || {};
    
    // Pre-compute available engines
    this.availableEngines = PlayerEngineRegistry.getAvailableEngines().map(f => f.id);
  }
  
  /**
   * Attach to a container element
   */
  attach(containerEl: HTMLElement): void {
    this.container = containerEl;
    if (this.engine) {
      this.engine.attach(containerEl);
    }
  }
  
  /**
   * Detach from container
   */
  detach(): void {
    if (this.engine) {
      this.engine.detach();
    }
    this.container = null;
  }
  
  /**
   * Load and play a media source
   */
  async load(source: MediaSource): Promise<void> {
    this.source = source;
    this.loadStartTime = performance.now();
    this.retryState = { attempts: 0, currentEngineIndex: 0, lastErrorCode: null };
    
    // Clean up existing engine
    await this.destroyCurrentEngine();
    
    // Create engine based on settings
    await this.createAndAttachEngine(source);
    
    // Load source
    if (this.engine) {
      try {
        await this.engine.load(source);
        this.diagnostics.loadLatencyMs = performance.now() - this.loadStartTime;
      } catch (error) {
        // Error will be handled by state change listener
        console.error('[PlayerController] Load error:', error);
      }
    }
  }
  
  private async createAndAttachEngine(source: MediaSource): Promise<void> {
    const engineId = this.settings.preferredEngine === 'auto' 
      ? PlayerEngineRegistry.resolveAutoEngine(source).id
      : this.settings.preferredEngine;
    
    // Find engine index for fallback tracking
    this.retryState.currentEngineIndex = this.availableEngines.indexOf(engineId);
    if (this.retryState.currentEngineIndex === -1) {
      this.retryState.currentEngineIndex = 0;
    }
    
    await this.switchToEngine(engineId);
  }
  
  private async switchToEngine(engineId: string): Promise<void> {
    // Destroy current
    await this.destroyCurrentEngine();
    
    try {
      this.engine = PlayerEngineRegistry.createEngine(engineId);
      this.diagnostics.currentEngine = engineId;
      
      if (this.container) {
        this.engine.attach(this.container);
      }
      
      // Subscribe to state changes
      this.stateUnsubscribe = this.engine.onStateChange(this.handleEngineStateChange.bind(this));
      
      this.events.onEngineChange?.(engineId);
      console.log(`[PlayerController] Switched to engine: ${engineId}`);
    } catch (error) {
      console.error(`[PlayerController] Failed to create engine ${engineId}:`, error);
      throw error;
    }
  }
  
  private async destroyCurrentEngine(): Promise<void> {
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = null;
    }
    
    if (this.engine) {
      try {
        await this.engine.destroy();
      } catch (e) {
        console.error('[PlayerController] Engine destroy error:', e);
      }
      this.engine = null;
    }
  }
  
  private handleEngineStateChange(engineState: PlayerState): void {
    const previousStatus = this.state.status;
    
    // Track buffering
    if (engineState.status === 'buffering' && previousStatus !== 'buffering') {
      this.bufferingStartTime = performance.now();
      this.diagnostics.bufferingEvents++;
    } else if (previousStatus === 'buffering' && engineState.status !== 'buffering') {
      this.diagnostics.totalBufferingMs += performance.now() - this.bufferingStartTime;
    }
    
    // Handle errors
    if (engineState.error && !this.state.error) {
      this.handlePlaybackError(engineState.error.code, engineState.error.message, engineState.error.recoverable);
      return;
    }
    
    // Debounce state updates
    this.debouncedStateUpdate(engineState);
  }
  
  private debouncedStateUpdate(engineState: PlayerState): void {
    if (this.debounceTimeoutId) {
      window.clearTimeout(this.debounceTimeoutId);
    }
    
    // Critical states update immediately
    const criticalStates: PlayerStatus[] = ['error', 'playing', 'paused', 'ended'];
    if (criticalStates.includes(engineState.status) || 
        Math.abs(engineState.currentTime - this.state.currentTime) > 1) {
      this.updateState(engineState);
      return;
    }
    
    // Debounce non-critical updates
    this.debounceTimeoutId = window.setTimeout(() => {
      this.updateState(engineState);
    }, 100);
  }
  
  private updateState(newState: PlayerState): void {
    this.state = { ...newState };
    this.events.onStateChange?.(this.state);
  }
  
  private handlePlaybackError(code: string, message: string, recoverable: boolean): void {
    console.error(`[PlayerController] Playback error: ${code} - ${message}`);
    
    this.diagnostics.lastErrorCode = code;
    this.retryState.lastErrorCode = code;
    
    if (!recoverable) {
      this.updateState({
        ...this.state,
        status: 'error',
        error: { code, message, recoverable, details: null },
      });
      this.events.onError?.({ code, message });
      return;
    }
    
    // Retry policy: First retry with same engine
    if (this.retryState.attempts < 1) {
      this.scheduleRetry();
      return;
    }
    
    // Fallback to next engine
    if (this.retryState.currentEngineIndex < this.availableEngines.length - 1) {
      this.fallbackToNextEngine();
      return;
    }
    
    // All engines failed
    this.updateState({
      ...this.state,
      status: 'error',
      error: { code, message, recoverable: false, details: 'All engines failed' },
    });
    
    toast.error('Uppspelning misslyckades', {
      description: 'Testa en annan spelare i inställningar.',
      action: {
        label: 'Inställningar',
        onClick: () => {
          // Navigate to settings - handled by UI
        },
      },
    });
  }
  
  private scheduleRetry(): void {
    if (this.retryTimeoutId) {
      window.clearTimeout(this.retryTimeoutId);
    }
    
    this.retryState.attempts++;
    console.log(`[PlayerController] Retry attempt ${this.retryState.attempts}`);
    
    this.retryTimeoutId = window.setTimeout(async () => {
      if (this.source && this.engine) {
        try {
          await this.engine.load(this.source);
        } catch (e) {
          // Will be handled by error listener
        }
      }
    }, this.settings.retryDelay);
  }
  
  private async fallbackToNextEngine(): Promise<void> {
    this.retryState.currentEngineIndex++;
    this.retryState.attempts = 0;
    this.diagnostics.fallbackCount++;
    
    const nextEngineId = this.availableEngines[this.retryState.currentEngineIndex];
    console.log(`[PlayerController] Falling back to engine: ${nextEngineId}`);
    
    toast.info('Byter spelare', {
      description: `Problem med uppspelning – bytte till ${PlayerEngineRegistry.getFactory(nextEngineId)?.displayName || nextEngineId}.`,
    });
    
    try {
      await this.switchToEngine(nextEngineId);
      if (this.source) {
        await this.engine?.load(this.source);
      }
    } catch (error) {
      // Recursive fallback
      this.handlePlaybackError('FALLBACK_FAILED', 'Engine switch failed', true);
    }
  }
  
  /**
   * Playback controls
   */
  async play(): Promise<void> {
    await this.engine?.play();
  }
  
  async pause(): Promise<void> {
    await this.engine?.pause();
  }
  
  async togglePlay(): Promise<void> {
    if (this.state.status === 'playing') {
      await this.pause();
    } else {
      await this.play();
    }
  }
  
  async stop(): Promise<void> {
    await this.engine?.stop();
    this.source = null;
  }
  
  async seek(seconds: number): Promise<void> {
    await this.engine?.seek(seconds);
  }
  
  setVolume(volume: number): void {
    this.engine?.setVolume(volume);
  }
  
  setMuted(muted: boolean): void {
    this.engine?.setMuted(muted);
  }
  
  toggleMute(): void {
    this.setMuted(!this.state.isMuted);
  }
  
  setPlaybackRate(rate: number): void {
    this.engine?.setPlaybackRate(rate);
  }
  
  /**
   * Track controls
   */
  listSubtitles() {
    return this.engine?.listSubtitles() || [];
  }
  
  async setSubtitle(id?: string): Promise<void> {
    await this.engine?.setSubtitle(id);
  }
  
  listAudioTracks() {
    return this.engine?.listAudioTracks() || [];
  }
  
  async setAudioTrack(id?: string): Promise<void> {
    await this.engine?.setAudioTrack(id);
  }
  
  /**
   * Settings
   */
  updateSettings(settings: Partial<PlayerSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
  
  getSettings(): PlayerSettings {
    return { ...this.settings };
  }
  
  /**
   * State and diagnostics
   */
  getState(): PlayerState {
    return { ...this.state };
  }
  
  getDiagnostics(): PlayerDiagnostics {
    return { ...this.diagnostics };
  }
  
  getCurrentEngineId(): string {
    return this.engine?.id || '';
  }
  
  /**
   * Manual retry
   */
  async retry(): Promise<void> {
    this.retryState = { attempts: 0, currentEngineIndex: 0, lastErrorCode: null };
    if (this.source) {
      await this.load(this.source);
    }
  }
  
  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    if (this.retryTimeoutId) {
      window.clearTimeout(this.retryTimeoutId);
    }
    if (this.debounceTimeoutId) {
      window.clearTimeout(this.debounceTimeoutId);
    }
    
    await this.destroyCurrentEngine();
    this.container = null;
    this.source = null;
  }
}

// Singleton for global access
let globalController: UnifiedPlayerController | null = null;

export function getPlayerController(
  settings?: Partial<PlayerSettings>,
  events?: PlayerControllerEvents
): UnifiedPlayerController {
  if (!globalController) {
    globalController = new UnifiedPlayerController(settings, events);
  }
  return globalController;
}

export function resetPlayerController(): void {
  if (globalController) {
    globalController.destroy();
    globalController = null;
  }
}
