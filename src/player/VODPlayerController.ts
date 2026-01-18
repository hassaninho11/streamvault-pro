/**
 * VODPlayerController - Specialized controller for VOD (Movies & Series)
 * Handles resume playback, auto-next, skip intro/recap, and watch progress
 */

import { 
  UnifiedPlayerController, 
  getPlayerController,
  PlayerControllerEvents,
} from './UnifiedPlayerController';
import { PlayerSettings, PlayerState, MediaSource } from './types';
import { useVodStore } from '@/data/stores/vodStore';
import { Episode, Movie, Series, Season, WatchProgress, IntroMarker } from '@/types/vod';
import { toast } from 'sonner';

export interface VODSource extends MediaSource {
  vodId: string;
  vodType: 'movie' | 'episode';
  title: string;
  seriesId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  duration?: number; // Duration in seconds if known
  resumePosition?: number; // Resume from this position
}

export interface VODPlayerEvents extends PlayerControllerEvents {
  onWatchProgressUpdate?: (progress: WatchProgress) => void;
  onEpisodeEnding?: (remainingSeconds: number) => void;
  onMarkAsWatched?: (vodId: string) => void;
  onAutoNextTriggered?: (nextEpisode: Episode) => void;
  onShowSkipIntro?: (marker: IntroMarker) => void;
  onShowSkipRecap?: (marker: IntroMarker) => void;
}

export interface VODPlayerSettings extends PlayerSettings {
  autoPlayNext: boolean;
  upNextCountdown: number; // seconds (10, 5, 0=disabled)
  markAsWatchedThreshold: number; // percentage (default 90)
  rememberPosition: boolean;
  preferredSubtitleLanguage?: string;
  preferredAudioLanguage?: string;
}

const DEFAULT_VOD_SETTINGS: VODPlayerSettings = {
  preferredEngine: 'auto',
  bufferMode: 'balanced',
  maxRetries: 2,
  retryDelay: 2000,
  autoPlayNext: true,
  upNextCountdown: 10,
  markAsWatchedThreshold: 90,
  rememberPosition: true,
};

export class VODPlayerController {
  private playerController: UnifiedPlayerController;
  private settings: VODPlayerSettings;
  private events: VODPlayerEvents;
  
  private currentSource: VODSource | null = null;
  private progressInterval: number | null = null;
  private lastProgressUpdate = 0;
  private hasTriggeredEnding = false;
  private hasMarkedAsWatched = false;
  
  // Intro/Recap markers
  private introMarkers: Map<string, IntroMarker[]> = new Map();
  private currentMarkerShowing: 'intro' | 'recap' | null = null;
  
  constructor(
    settings?: Partial<VODPlayerSettings>,
    events?: VODPlayerEvents
  ) {
    this.settings = { ...DEFAULT_VOD_SETTINGS, ...settings };
    this.events = events || {};
    
    // Create or get the unified player controller
    this.playerController = getPlayerController(this.settings, {
      ...events,
      onStateChange: this.handleStateChange.bind(this),
    });
    
    // Load intro markers from localStorage
    this.loadIntroMarkers();
  }
  
  /**
   * Load VOD content with resume support
   */
  async loadVOD(source: VODSource): Promise<void> {
    this.currentSource = source;
    this.hasTriggeredEnding = false;
    this.hasMarkedAsWatched = false;
    this.currentMarkerShowing = null;
    
    // Load the media
    await this.playerController.load(source);
    
    // Handle resume position
    if (this.settings.rememberPosition && source.resumePosition && source.resumePosition > 5) {
      // Wait for playback to start before seeking
      setTimeout(async () => {
        try {
          await this.playerController.seek(source.resumePosition!);
          console.log(`[VODPlayer] Resumed at ${source.resumePosition}s`);
        } catch (e) {
          console.warn('[VODPlayer] Could not resume position:', e);
        }
      }, 500);
    }
    
    // Start progress tracking
    this.startProgressTracking();
  }
  
  /**
   * Get resume position for a VOD item
   */
  static getResumePosition(vodId: string): number | undefined {
    const store = useVodStore.getState();
    const progress = store.getWatchProgress(vodId);
    
    if (progress && !progress.completed && progress.progress > 5 && progress.progress < 95) {
      return progress.currentTime;
    }
    
    return undefined;
  }
  
  /**
   * Handle player state changes
   */
  private handleStateChange(state: PlayerState): void {
    // Forward to external listener
    this.events.onStateChange?.(state);
    
    // Check for episode ending (for auto-next)
    if (state.status === 'playing' && state.duration > 0) {
      const remainingSeconds = state.duration - state.currentTime;
      const progressPercent = (state.currentTime / state.duration) * 100;
      
      // Trigger "ending" event when we're in the last 60 seconds
      if (remainingSeconds <= 60 && !this.hasTriggeredEnding) {
        this.hasTriggeredEnding = true;
        this.events.onEpisodeEnding?.(remainingSeconds);
      }
      
      // Mark as watched when threshold reached
      if (progressPercent >= this.settings.markAsWatchedThreshold && !this.hasMarkedAsWatched) {
        this.hasMarkedAsWatched = true;
        this.markAsWatched();
      }
      
      // Check for intro/recap markers
      this.checkMarkers(state.currentTime);
    }
    
    // Handle ended state for auto-next
    if (state.status === 'ended' && this.settings.autoPlayNext) {
      this.handlePlaybackEnded();
    }
  }
  
  /**
   * Start progress tracking interval
   */
  private startProgressTracking(): void {
    this.stopProgressTracking();
    
    this.progressInterval = window.setInterval(() => {
      this.updateWatchProgress();
    }, 5000); // Update every 5 seconds
  }
  
  /**
   * Stop progress tracking
   */
  private stopProgressTracking(): void {
    if (this.progressInterval) {
      window.clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
  
  /**
   * Update watch progress in store
   */
  private updateWatchProgress(): void {
    if (!this.currentSource) return;
    
    const state = this.playerController.getState();
    if (state.status !== 'playing' && state.status !== 'paused') return;
    if (state.duration <= 0) return;
    
    // Debounce - don't update too frequently
    const now = Date.now();
    if (now - this.lastProgressUpdate < 4000) return;
    this.lastProgressUpdate = now;
    
    const progress: WatchProgress = {
      itemId: this.currentSource.vodId,
      currentTime: state.currentTime,
      duration: state.duration,
      progress: (state.currentTime / state.duration) * 100,
      lastWatchedAt: new Date(),
      completed: state.currentTime >= state.duration * 0.9,
    };
    
    // Update store
    const store = useVodStore.getState();
    store.updateWatchProgress(progress);
    
    // Notify listener
    this.events.onWatchProgressUpdate?.(progress);
  }
  
  /**
   * Mark current item as watched
   */
  private markAsWatched(): void {
    if (!this.currentSource) return;
    
    const state = this.playerController.getState();
    const progress: WatchProgress = {
      itemId: this.currentSource.vodId,
      currentTime: state.duration,
      duration: state.duration,
      progress: 100,
      lastWatchedAt: new Date(),
      completed: true,
    };
    
    const store = useVodStore.getState();
    store.updateWatchProgress(progress);
    
    this.events.onMarkAsWatched?.(this.currentSource.vodId);
    
    console.log(`[VODPlayer] Marked as watched: ${this.currentSource.title}`);
  }
  
  /**
   * Handle playback ended - trigger auto-next if applicable
   */
  private handlePlaybackEnded(): void {
    if (!this.currentSource || this.currentSource.vodType !== 'episode') {
      return;
    }
    
    // Find next episode
    const nextEpisode = this.findNextEpisode();
    if (nextEpisode) {
      this.events.onAutoNextTriggered?.(nextEpisode);
    }
  }
  
  /**
   * Find the next episode in the series
   */
  findNextEpisode(): Episode | null {
    if (!this.currentSource || !this.currentSource.seriesId) return null;
    
    const store = useVodStore.getState();
    const series = store.series.find(s => s.id === this.currentSource!.seriesId);
    
    if (!series || !series.seasons) return null;
    
    const currentSeasonNum = this.currentSource.seasonNumber;
    const currentEpisodeNum = this.currentSource.episodeNumber;
    
    if (!currentSeasonNum || !currentEpisodeNum) return null;
    
    // Find current season
    const currentSeason = series.seasons.find(s => s.seasonNumber === currentSeasonNum);
    if (!currentSeason || !currentSeason.episodes) return null;
    
    // Try to find next episode in same season
    const nextEpisode = currentSeason.episodes.find(
      e => e.episodeNumber === currentEpisodeNum + 1
    );
    
    if (nextEpisode) return nextEpisode;
    
    // Try next season's first episode
    const nextSeason = series.seasons.find(s => s.seasonNumber === currentSeasonNum + 1);
    if (nextSeason && nextSeason.episodes && nextSeason.episodes.length > 0) {
      return nextSeason.episodes[0];
    }
    
    return null;
  }
  
  /**
   * Intro/Recap marker management
   */
  addIntroMarker(marker: IntroMarker): void {
    const key = marker.seasonNumber 
      ? `${marker.seriesId}_${marker.seasonNumber}`
      : marker.seriesId;
    
    const markers = this.introMarkers.get(key) || [];
    markers.push(marker);
    this.introMarkers.set(key, markers);
    this.saveIntroMarkers();
  }
  
  getIntroMarkers(seriesId: string, seasonNumber?: number): IntroMarker[] {
    const key = seasonNumber ? `${seriesId}_${seasonNumber}` : seriesId;
    return this.introMarkers.get(key) || [];
  }
  
  private loadIntroMarkers(): void {
    try {
      const saved = localStorage.getItem('vod_intro_markers');
      if (saved) {
        const entries = JSON.parse(saved);
        this.introMarkers = new Map(entries);
      }
    } catch (e) {
      console.warn('[VODPlayer] Could not load intro markers:', e);
    }
  }
  
  private saveIntroMarkers(): void {
    try {
      const entries = Array.from(this.introMarkers.entries());
      localStorage.setItem('vod_intro_markers', JSON.stringify(entries));
    } catch (e) {
      console.warn('[VODPlayer] Could not save intro markers:', e);
    }
  }
  
  private checkMarkers(currentTime: number): void {
    if (!this.currentSource?.seriesId) return;
    
    const markers = this.getIntroMarkers(
      this.currentSource.seriesId,
      this.currentSource.seasonNumber
    );
    
    for (const marker of markers) {
      if (currentTime >= marker.startTime && currentTime < marker.endTime) {
        if (this.currentMarkerShowing !== marker.type) {
          this.currentMarkerShowing = marker.type as 'intro' | 'recap';
          
          if (marker.type === 'intro') {
            this.events.onShowSkipIntro?.(marker);
          } else if (marker.type === 'recap') {
            this.events.onShowSkipRecap?.(marker);
          }
        }
        return;
      }
    }
    
    // No marker at current position
    this.currentMarkerShowing = null;
  }
  
  /**
   * Skip to end of intro/recap
   */
  async skipIntroRecap(marker: IntroMarker): Promise<void> {
    await this.playerController.seek(marker.endTime);
    this.currentMarkerShowing = null;
    toast.success(marker.type === 'intro' ? 'Hoppade över intro' : 'Hoppade över recap');
  }
  
  /**
   * Playback controls - forwarded to unified controller
   */
  async play(): Promise<void> {
    await this.playerController.play();
  }
  
  async pause(): Promise<void> {
    await this.playerController.pause();
  }
  
  async togglePlay(): Promise<void> {
    await this.playerController.togglePlay();
  }
  
  async seek(seconds: number): Promise<void> {
    await this.playerController.seek(seconds);
  }
  
  async seekRelative(deltaSeconds: number): Promise<void> {
    const state = this.playerController.getState();
    const newTime = Math.max(0, Math.min(state.duration, state.currentTime + deltaSeconds));
    await this.playerController.seek(newTime);
  }
  
  setVolume(volume: number): void {
    this.playerController.setVolume(volume);
  }
  
  setMuted(muted: boolean): void {
    this.playerController.setMuted(muted);
  }
  
  setPlaybackRate(rate: number): void {
    this.playerController.setPlaybackRate(rate);
  }
  
  /**
   * Track controls
   */
  listSubtitles() {
    return this.playerController.listSubtitles();
  }
  
  async setSubtitle(id?: string): Promise<void> {
    await this.playerController.setSubtitle(id);
  }
  
  listAudioTracks() {
    return this.playerController.listAudioTracks();
  }
  
  async setAudioTrack(id?: string): Promise<void> {
    await this.playerController.setAudioTrack(id);
  }
  
  /**
   * State and diagnostics
   */
  getState(): PlayerState {
    return this.playerController.getState();
  }
  
  getSource(): VODSource | null {
    return this.currentSource;
  }
  
  getSettings(): VODPlayerSettings {
    return { ...this.settings };
  }
  
  updateSettings(settings: Partial<VODPlayerSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.playerController.updateSettings(settings);
  }
  
  /**
   * Attach/Detach
   */
  attach(container: HTMLElement): void {
    this.playerController.attach(container);
  }
  
  detach(): void {
    this.playerController.detach();
  }
  
  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    // Save final progress before destroying
    this.updateWatchProgress();
    
    this.stopProgressTracking();
    await this.playerController.destroy();
    this.currentSource = null;
  }
}

// Global VOD player instance
let vodPlayerInstance: VODPlayerController | null = null;

export function getVODPlayerController(
  settings?: Partial<VODPlayerSettings>,
  events?: VODPlayerEvents
): VODPlayerController {
  if (!vodPlayerInstance) {
    vodPlayerInstance = new VODPlayerController(settings, events);
  }
  return vodPlayerInstance;
}

export function resetVODPlayerController(): void {
  if (vodPlayerInstance) {
    vodPlayerInstance.destroy();
    vodPlayerInstance = null;
  }
}
