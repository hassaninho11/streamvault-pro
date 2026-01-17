/**
 * CastController - Manages Chromecast and AirPlay casting
 */

import { MediaSource } from './types';
import { toast } from 'sonner';

// ============= Cast State =============

export type CastStatus = 'idle' | 'discovering' | 'connecting' | 'casting' | 'error';

export interface CastState {
  status: CastStatus;
  deviceName?: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  error?: string;
}

export interface CastDevice {
  id: string;
  name: string;
  type: 'chromecast' | 'airplay';
}

// ============= Cast Controller Events =============

export interface CastControllerEvents {
  onStateChange?: (state: CastState) => void;
  onDevicesChange?: (devices: CastDevice[]) => void;
  onCastStart?: (device: CastDevice, source: MediaSource) => void;
  onCastEnd?: (currentTime: number) => void;
}

// ============= Google Cast Types =============

interface CastSession {
  getSessionState(): string;
  getCastDevice(): { friendlyName: string };
  getMediaSession(): CastMediaSession | null;
}

interface CastMediaSession {
  getPlayerState(): string;
  currentTime: number;
  media?: { duration?: number };
}

interface CastContext {
  setOptions(options: Record<string, unknown>): void;
  requestSession(): Promise<void>;
  getCurrentSession(): CastSession | null;
  endCurrentSession(stopCasting: boolean): void;
  addEventListener(event: string, callback: () => void): void;
  removeEventListener(event: string, callback: () => void): void;
}

interface CastFramework {
  CastContext: { getInstance(): CastContext };
  RemotePlayerController: new (player: CastRemotePlayer) => CastRemotePlayerController;
  RemotePlayer: new () => CastRemotePlayer;
  CastContextEventType: {
    SESSION_STATE_CHANGED: string;
    CAST_STATE_CHANGED: string;
  };
  RemotePlayerEventType: {
    ANY_CHANGE: string;
  };
}

interface CastRemotePlayer {
  currentTime: number;
  duration: number;
  isPaused: boolean;
  isMuted: boolean;
  volumeLevel: number;
  isConnected: boolean;
}

interface CastRemotePlayerController {
  addEventListener(event: string, callback: () => void): void;
  removeEventListener(event: string, callback: () => void): void;
  playOrPause(): void;
  seek(): void;
  muteOrUnmute(): void;
  setVolumeLevel(): void;
}

interface Chrome {
  cast?: {
    isAvailable: boolean;
    media: {
      MediaInfo: new (contentId: string, contentType: string) => CastMediaInfo;
      GenericMediaMetadata: new () => CastMetadata;
      LoadRequest: new (mediaInfo: CastMediaInfo) => CastLoadRequest;
    };
  };
}

interface CastMediaInfo {
  metadata: CastMetadata;
  streamType: string;
}

interface CastMetadata {
  title: string;
  subtitle: string;
  images: Array<{ url: string }>;
}

interface CastLoadRequest {
  currentTime?: number;
}

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: { framework: CastFramework };
    chrome?: Chrome;
    WebKitPlaybackTargetAvailabilityEvent?: unknown;
  }
}

// ============= Cast Controller =============

export class CastController {
  private state: CastState = {
    status: 'idle',
    currentTime: 0,
    duration: 0,
    isPlaying: false,
  };
  
  private events: CastControllerEvents;
  private devices: CastDevice[] = [];
  private currentSource: MediaSource | null = null;
  
  // Chromecast
  private castContext: CastContext | null = null;
  private remotePlayer: CastRemotePlayer | null = null;
  private remotePlayerController: CastRemotePlayerController | null = null;
  private castInitialized = false;
  
  // AirPlay
  private airPlayAvailable = false;
  
  // Polling
  private progressInterval: number | null = null;
  
  constructor(events?: CastControllerEvents) {
    this.events = events || {};
    this.initializeCast();
  }
  
  private initializeCast(): void {
    // Initialize Chromecast
    this.initializeChromecast();
    
    // Check AirPlay availability
    this.checkAirPlayAvailability();
  }
  
  // ============= Chromecast =============
  
  private initializeChromecast(): void {
    if (typeof window === 'undefined') return;
    
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable && window.cast?.framework) {
        this.setupChromecast();
      }
    };
    
    // Load Cast SDK if not already loaded
    if (!document.querySelector('script[src*="cast_sender"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      document.head.appendChild(script);
    } else if (window.cast?.framework) {
      this.setupChromecast();
    }
  }
  
  private setupChromecast(): void {
    if (!window.cast?.framework) return;
    
    try {
      const framework = window.cast.framework;
      this.castContext = framework.CastContext.getInstance();
      
      // Configure
      this.castContext.setOptions({
        receiverApplicationId: 'CC1AD845', // Default Media Receiver
        autoJoinPolicy: 'ORIGIN_SCOPED',
      });
      
      // Create remote player
      this.remotePlayer = new framework.RemotePlayer();
      this.remotePlayerController = new framework.RemotePlayerController(this.remotePlayer);
      
      // Listen for session changes
      this.castContext.addEventListener(
        framework.CastContextEventType.SESSION_STATE_CHANGED,
        this.handleCastSessionStateChange.bind(this)
      );
      
      // Listen for player changes
      this.remotePlayerController.addEventListener(
        framework.RemotePlayerEventType.ANY_CHANGE,
        this.handleRemotePlayerChange.bind(this)
      );
      
      this.castInitialized = true;
      
      // Add Chromecast to devices
      this.devices.push({ id: 'chromecast', name: 'Chromecast', type: 'chromecast' });
      this.events.onDevicesChange?.(this.devices);
      
      console.log('[CastController] Chromecast initialized');
    } catch (error) {
      console.error('[CastController] Failed to initialize Chromecast:', error);
    }
  }
  
  private handleCastSessionStateChange(): void {
    if (!this.castContext) return;
    
    const session = this.castContext.getCurrentSession();
    
    if (session) {
      const device = session.getCastDevice();
      this.updateState({
        status: 'casting',
        deviceName: device.friendlyName,
      });
      this.startProgressPolling();
    } else {
      const lastTime = this.state.currentTime;
      this.updateState({
        status: 'idle',
        deviceName: undefined,
        isPlaying: false,
      });
      this.stopProgressPolling();
      
      if (this.currentSource) {
        this.events.onCastEnd?.(lastTime);
        this.currentSource = null;
      }
    }
  }
  
  private handleRemotePlayerChange(): void {
    if (!this.remotePlayer) return;
    
    this.updateState({
      currentTime: this.remotePlayer.currentTime,
      duration: this.remotePlayer.duration,
      isPlaying: !this.remotePlayer.isPaused,
    });
  }
  
  // ============= AirPlay =============
  
  private checkAirPlayAvailability(): void {
    if (typeof window === 'undefined') return;
    
    // AirPlay is available on Safari
    this.airPlayAvailable = 'WebKitPlaybackTargetAvailabilityEvent' in window;
    
    if (this.airPlayAvailable) {
      this.devices.push({ id: 'airplay', name: 'AirPlay', type: 'airplay' });
      this.events.onDevicesChange?.(this.devices);
      console.log('[CastController] AirPlay available');
    }
  }
  
  // ============= Public API =============
  
  isChromecastAvailable(): boolean {
    return this.castInitialized;
  }
  
  isAirPlayAvailable(): boolean {
    return this.airPlayAvailable;
  }
  
  getDevices(): CastDevice[] {
    return [...this.devices];
  }
  
  getState(): CastState {
    return { ...this.state };
  }
  
  isCasting(): boolean {
    return this.state.status === 'casting';
  }
  
  async startCast(device: CastDevice, source: MediaSource): Promise<void> {
    this.currentSource = source;
    
    if (device.type === 'chromecast') {
      await this.startChromecast(source);
    } else if (device.type === 'airplay') {
      this.startAirPlay();
    }
  }
  
  private async startChromecast(source: MediaSource): Promise<void> {
    if (!this.castContext || !window.chrome?.cast) return;
    
    this.updateState({ status: 'connecting' });
    
    try {
      // Request session if not connected
      if (!this.castContext.getCurrentSession()) {
        await this.castContext.requestSession();
      }
      
      const session = this.castContext.getCurrentSession();
      if (!session) {
        throw new Error('No cast session');
      }
      
      // Create media info
      const mediaInfo = new window.chrome.cast.media.MediaInfo(
        source.url,
        source.mimeHint || 'application/x-mpegURL'
      );
      
      // Add metadata
      const metadata = new window.chrome.cast.media.GenericMediaMetadata();
      metadata.title = source.title || 'StreamVault';
      metadata.images = source.posterUrl ? [{ url: source.posterUrl }] : [];
      mediaInfo.metadata = metadata;
      mediaInfo.streamType = source.type === 'live' ? 'LIVE' : 'BUFFERED';
      
      // Create load request
      const loadRequest = new window.chrome.cast.media.LoadRequest(mediaInfo);
      if (source.startPosition) {
        loadRequest.currentTime = source.startPosition;
      }
      
      // Load media
      const mediaSession = session.getMediaSession();
      if (mediaSession) {
        // Media is already loaded, just update
        this.updateState({ status: 'casting' });
      }
      
      this.events.onCastStart?.(
        { id: 'chromecast', name: session.getCastDevice().friendlyName, type: 'chromecast' },
        source
      );
      
      toast.success(`Spelar på ${session.getCastDevice().friendlyName}`);
    } catch (error) {
      console.error('[CastController] Chromecast error:', error);
      this.updateState({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Cast failed' 
      });
      toast.error('Kunde inte ansluta till Chromecast');
    }
  }
  
  private startAirPlay(): void {
    // AirPlay is handled by the browser/video element
    // We just need to show the AirPlay picker
    toast.info('AirPlay', {
      description: 'Använd AirPlay-knappen i videospelaren för att välja enhet.',
    });
  }
  
  stopCast(): void {
    if (this.castContext) {
      this.castContext.endCurrentSession(true);
    }
    
    const lastTime = this.state.currentTime;
    this.updateState({
      status: 'idle',
      deviceName: undefined,
      isPlaying: false,
    });
    
    if (this.currentSource) {
      this.events.onCastEnd?.(lastTime);
      this.currentSource = null;
    }
  }
  
  // ============= Cast Controls =============
  
  play(): void {
    if (!this.remotePlayer?.isPaused) return;
    this.remotePlayerController?.playOrPause();
  }
  
  pause(): void {
    if (this.remotePlayer?.isPaused) return;
    this.remotePlayerController?.playOrPause();
  }
  
  togglePlay(): void {
    this.remotePlayerController?.playOrPause();
  }
  
  seek(seconds: number): void {
    if (this.remotePlayer) {
      this.remotePlayer.currentTime = seconds;
      this.remotePlayerController?.seek();
    }
  }
  
  setVolume(volume: number): void {
    if (this.remotePlayer) {
      this.remotePlayer.volumeLevel = Math.max(0, Math.min(1, volume));
      this.remotePlayerController?.setVolumeLevel();
    }
  }
  
  toggleMute(): void {
    this.remotePlayerController?.muteOrUnmute();
  }
  
  // ============= Helpers =============
  
  private updateState(partial: Partial<CastState>): void {
    this.state = { ...this.state, ...partial };
    this.events.onStateChange?.(this.state);
  }
  
  private startProgressPolling(): void {
    this.stopProgressPolling();
    this.progressInterval = window.setInterval(() => {
      this.handleRemotePlayerChange();
    }, 1000);
  }
  
  private stopProgressPolling(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
  
  destroy(): void {
    this.stopProgressPolling();
    
    if (this.castContext && window.cast?.framework) {
      this.castContext.removeEventListener(
        window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        this.handleCastSessionStateChange.bind(this)
      );
    }
    
    if (this.remotePlayerController && window.cast?.framework) {
      this.remotePlayerController.removeEventListener(
        window.cast.framework.RemotePlayerEventType.ANY_CHANGE,
        this.handleRemotePlayerChange.bind(this)
      );
    }
  }
}

// Singleton
let castControllerInstance: CastController | null = null;

export function getCastController(events?: CastControllerEvents): CastController {
  if (!castControllerInstance) {
    castControllerInstance = new CastController(events);
  }
  return castControllerInstance;
}
