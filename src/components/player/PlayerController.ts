/**
 * PlayerController - Robust video player controller with retry/backoff
 * Handles stream failures, network changes, and recovery
 */

export interface PlayerState {
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  error: string | null;
  errorCode: PlayerErrorCode | null;
  retryCount: number;
  currentTime: number;
  duration: number;
}

export enum PlayerErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  DECODE_ERROR = 'DECODE_ERROR',
  SOURCE_NOT_SUPPORTED = 'SOURCE_NOT_SUPPORTED',
  ABORTED = 'ABORTED',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

export interface PlayerControllerConfig {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  timeoutMs: number;
  onStateChange?: (state: PlayerState) => void;
  onError?: (error: PlayerErrorCode, message: string) => void;
  onMetrics?: (metrics: PlayerMetrics) => void;
}

export interface PlayerMetrics {
  bufferingDuration: number;
  playbackStartTime: number;
  errorCount: number;
  reconnectCount: number;
}

const DEFAULT_CONFIG: PlayerControllerConfig = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
  timeoutMs: 15000,
};

export class PlayerController {
  private video: HTMLVideoElement | null = null;
  private config: PlayerControllerConfig;
  private state: PlayerState;
  private metrics: PlayerMetrics;
  private retryTimeoutId: number | null = null;
  private loadTimeoutId: number | null = null;
  private currentUrl: string | null = null;
  private abortController: AbortController | null = null;

  constructor(config: Partial<PlayerControllerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.getInitialState();
    this.metrics = this.getInitialMetrics();
  }

  private getInitialState(): PlayerState {
    return {
      isPlaying: false,
      isBuffering: false,
      isMuted: false,
      volume: 1,
      error: null,
      errorCode: null,
      retryCount: 0,
      currentTime: 0,
      duration: 0,
    };
  }

  private getInitialMetrics(): PlayerMetrics {
    return {
      bufferingDuration: 0,
      playbackStartTime: 0,
      errorCount: 0,
      reconnectCount: 0,
    };
  }

  attach(videoElement: HTMLVideoElement): void {
    this.detach();
    this.video = videoElement;
    this.setupEventListeners();
  }

  detach(): void {
    if (this.video) {
      this.removeEventListeners();
      this.video = null;
    }
    this.cancelRetry();
    this.cancelLoadTimeout();
    this.abortController?.abort();
  }

  private setupEventListeners(): void {
    if (!this.video) return;

    this.video.addEventListener('play', this.handlePlay);
    this.video.addEventListener('pause', this.handlePause);
    this.video.addEventListener('waiting', this.handleWaiting);
    this.video.addEventListener('canplay', this.handleCanPlay);
    this.video.addEventListener('error', this.handleError);
    this.video.addEventListener('timeupdate', this.handleTimeUpdate);
    this.video.addEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.video.addEventListener('stalled', this.handleStalled);

    // Network change detection
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      (navigator as Navigator & { connection: EventTarget }).connection?.addEventListener(
        'change',
        this.handleNetworkChange
      );
    }
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private removeEventListeners(): void {
    if (!this.video) return;

    this.video.removeEventListener('play', this.handlePlay);
    this.video.removeEventListener('pause', this.handlePause);
    this.video.removeEventListener('waiting', this.handleWaiting);
    this.video.removeEventListener('canplay', this.handleCanPlay);
    this.video.removeEventListener('error', this.handleError);
    this.video.removeEventListener('timeupdate', this.handleTimeUpdate);
    this.video.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.video.removeEventListener('stalled', this.handleStalled);

    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      (navigator as Navigator & { connection: EventTarget }).connection?.removeEventListener(
        'change',
        this.handleNetworkChange
      );
    }
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  // Event handlers
  private handlePlay = (): void => {
    this.updateState({ isPlaying: true, isBuffering: false, error: null, errorCode: null });
  };

  private handlePause = (): void => {
    this.updateState({ isPlaying: false });
  };

  private handleWaiting = (): void => {
    this.updateState({ isBuffering: true });
  };

  private handleCanPlay = (): void => {
    this.updateState({ isBuffering: false });
    if (this.state.retryCount > 0) {
      this.metrics.reconnectCount++;
    }
    this.updateState({ retryCount: 0 });
    this.cancelLoadTimeout();
  };

  private handleError = (): void => {
    const error = this.video?.error;
    const errorCode = this.mapMediaError(error?.code);
    const message = error?.message || 'Unknown playback error';

    this.metrics.errorCount++;
    this.updateState({
      error: message,
      errorCode,
      isPlaying: false,
      isBuffering: false,
    });

    this.config.onError?.(errorCode, message);
    this.scheduleRetry();
  };

  private handleTimeUpdate = (): void => {
    if (this.video) {
      this.updateState({
        currentTime: this.video.currentTime,
        duration: this.video.duration || 0,
      });
    }
  };

  private handleLoadedMetadata = (): void => {
    if (this.video) {
      this.updateState({ duration: this.video.duration });
    }
    this.cancelLoadTimeout();
  };

  private handleStalled = (): void => {
    this.updateState({ isBuffering: true });
    // If stalled for too long, treat as error
    this.startLoadTimeout();
  };

  private handleNetworkChange = (): void => {
    // Network type changed, might need to reload
    console.log('[PlayerController] Network changed');
  };

  private handleOnline = (): void => {
    console.log('[PlayerController] Back online, attempting reconnect');
    if (this.state.error && this.currentUrl) {
      this.load(this.currentUrl);
    }
  };

  private handleOffline = (): void => {
    this.updateState({
      error: 'Network offline',
      errorCode: PlayerErrorCode.NETWORK_ERROR,
    });
  };

  // Map browser MediaError codes
  private mapMediaError(code?: number): PlayerErrorCode {
    switch (code) {
      case 1:
        return PlayerErrorCode.ABORTED;
      case 2:
        return PlayerErrorCode.NETWORK_ERROR;
      case 3:
        return PlayerErrorCode.DECODE_ERROR;
      case 4:
        return PlayerErrorCode.SOURCE_NOT_SUPPORTED;
      default:
        return PlayerErrorCode.UNKNOWN;
    }
  }

  // Retry logic with exponential backoff
  private scheduleRetry(): void {
    if (this.state.retryCount >= this.config.maxRetries) {
      console.log('[PlayerController] Max retries reached');
      return;
    }

    const backoff = Math.min(
      this.config.initialBackoffMs * Math.pow(2, this.state.retryCount),
      this.config.maxBackoffMs
    );

    console.log(`[PlayerController] Scheduling retry in ${backoff}ms (attempt ${this.state.retryCount + 1})`);

    this.retryTimeoutId = window.setTimeout(() => {
      this.updateState({ retryCount: this.state.retryCount + 1 });
      if (this.currentUrl) {
        this.load(this.currentUrl, true);
      }
    }, backoff);
  }

  private cancelRetry(): void {
    if (this.retryTimeoutId !== null) {
      window.clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  private startLoadTimeout(): void {
    this.cancelLoadTimeout();
    this.loadTimeoutId = window.setTimeout(() => {
      this.updateState({
        error: 'Stream timeout',
        errorCode: PlayerErrorCode.TIMEOUT,
      });
      this.scheduleRetry();
    }, this.config.timeoutMs);
  }

  private cancelLoadTimeout(): void {
    if (this.loadTimeoutId !== null) {
      window.clearTimeout(this.loadTimeoutId);
      this.loadTimeoutId = null;
    }
  }

  // State management
  private updateState(partial: Partial<PlayerState>): void {
    this.state = { ...this.state, ...partial };
    this.config.onStateChange?.(this.state);
  }

  // Public API
  async load(url: string, isRetry = false): Promise<void> {
    if (!this.video) return;

    this.cancelRetry();
    this.cancelLoadTimeout();
    this.currentUrl = url;

    if (!isRetry) {
      this.updateState({
        ...this.getInitialState(),
        volume: this.state.volume,
        isMuted: this.state.isMuted,
      });
    }

    this.updateState({ isBuffering: true });
    this.startLoadTimeout();

    try {
      this.video.src = url;
      this.video.load();
      await this.video.play();
    } catch (error) {
      console.error('[PlayerController] Load error:', error);
      // Error will be caught by handleError event
    }
  }

  play(): void {
    this.video?.play().catch(console.error);
  }

  pause(): void {
    this.video?.pause();
  }

  togglePlay(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  setVolume(volume: number): void {
    if (this.video) {
      this.video.volume = Math.max(0, Math.min(1, volume));
      this.updateState({ volume: this.video.volume });
    }
  }

  toggleMute(): void {
    if (this.video) {
      this.video.muted = !this.video.muted;
      this.updateState({ isMuted: this.video.muted });
    }
  }

  seek(time: number): void {
    if (this.video) {
      this.video.currentTime = Math.max(0, Math.min(time, this.state.duration));
    }
  }

  retry(): void {
    if (this.currentUrl) {
      this.updateState({ retryCount: 0 });
      this.load(this.currentUrl);
    }
  }

  getState(): PlayerState {
    return { ...this.state };
  }

  getMetrics(): PlayerMetrics {
    return { ...this.metrics };
  }

  destroy(): void {
    this.detach();
    this.metrics = this.getInitialMetrics();
    this.state = this.getInitialState();
  }
}

// Singleton instance
let playerControllerInstance: PlayerController | null = null;

export const getPlayerController = (config?: Partial<PlayerControllerConfig>): PlayerController => {
  if (!playerControllerInstance) {
    playerControllerInstance = new PlayerController(config);
  }
  return playerControllerInstance;
};

export default PlayerController;
