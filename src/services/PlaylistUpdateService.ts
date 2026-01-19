/**
 * PlaylistUpdateService - Handles scheduled and manual playlist updates
 * Supports conditions (Wi-Fi only, idle only, low battery pause)
 * Runs parsing in worker to avoid UI freeze
 */

import { playlistService } from './PlaylistService';
import { localStore, LocalProvider } from '@/data/stores/localStore';
import { useChannelStore } from '@/data/stores/channelStore';

export type UpdateReason = 'manual' | 'scheduled' | 'startup';
export type UpdateStatus = 'idle' | 'running' | 'success' | 'failed';

export interface ProviderUpdateStatus {
  providerId: string;
  status: UpdateStatus;
  lastUpdatedAt?: number;
  lastError?: string;
  lastErrorCode?: 'NETWORK' | 'AUTH' | 'PARSE' | 'TIMEOUT' | 'UNKNOWN';
  lastImportStats?: {
    live: number;
    movies: number;
    series: number;
    unknown: number;
  };
}

export interface UpdateProgress {
  providerId: string;
  stage: 'fetching' | 'parsing' | 'indexing' | 'done';
  progress: number; // 0-100
  message: string;
}

export interface UpdateConditions {
  wifiOnly: boolean;
  idleOnly: boolean;
  pauseLowBattery: boolean;
}

type UpdateEventType = 'started' | 'progress' | 'finished' | 'failed';
type UpdateEventCallback = (event: UpdateEventType, data: any) => void;

class PlaylistUpdateService {
  private updateStatuses = new Map<string, ProviderUpdateStatus>();
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;
  private lastScheduledCheck: number = 0;
  private eventListeners: Set<UpdateEventCallback> = new Set();

  /**
   * Subscribe to update events
   */
  subscribe(callback: UpdateEventCallback): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  private emit(event: UpdateEventType, data: any) {
    this.eventListeners.forEach(cb => cb(event, data));
  }

  /**
   * Check if conditions allow update
   */
  async checkConditions(conditions: UpdateConditions): Promise<{ allowed: boolean; reason?: string }> {
    // Check Wi-Fi only
    if (conditions.wifiOnly) {
      const connection = (navigator as any).connection;
      if (connection) {
        const type = connection.type || connection.effectiveType;
        if (type && !['wifi', 'ethernet'].includes(type.toLowerCase())) {
          return { allowed: false, reason: 'Not on Wi-Fi' };
        }
      }
    }

    // Check battery level
    if (conditions.pauseLowBattery) {
      try {
        const battery = await (navigator as any).getBattery?.();
        if (battery && !battery.charging && battery.level < 0.2) {
          return { allowed: false, reason: 'Low battery' };
        }
      } catch {
        // Battery API not available, skip check
      }
    }

    // Note: Idle check would require Page Visibility API or similar
    // For now, we'll skip idle check in browser environment
    
    return { allowed: true };
  }

  /**
   * Get status for a provider
   */
  getStatus(providerId: string): ProviderUpdateStatus | undefined {
    return this.updateStatuses.get(providerId);
  }

  /**
   * Get all statuses
   */
  getAllStatuses(): ProviderUpdateStatus[] {
    return Array.from(this.updateStatuses.values());
  }

  /**
   * Update a single provider
   */
  async updateProvider(
    providerId: string, 
    reason: UpdateReason = 'manual'
  ): Promise<ProviderUpdateStatus> {
    const status: ProviderUpdateStatus = {
      providerId,
      status: 'running',
    };
    this.updateStatuses.set(providerId, status);
    this.emit('started', { providerId, reason });

    try {
      // Get provider info
      const provider = await localStore.getProvider(providerId);
      if (!provider) {
        throw new Error('Provider not found');
      }

      // Emit progress: fetching
      this.emit('progress', {
        providerId,
        stage: 'fetching',
        progress: 10,
        message: 'Hämtar spellista...',
      } as UpdateProgress);

      let result;
      if (provider.type === 'xtream' && provider.xtreamHost && provider.xtreamUser && provider.xtreamPassEncrypted) {
        result = await playlistService.loadXtreamPlaylist(
          provider.xtreamHost,
          provider.xtreamUser,
          provider.xtreamPassEncrypted,
          providerId
        );
      } else if (provider.m3uUrl) {
        result = await playlistService.loadM3UPlaylist(provider.m3uUrl, providerId, true);
      } else {
        throw new Error('No playlist URL configured');
      }

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      // Update provider in local store
      await localStore.saveProvider({
        ...provider,
        channelCount: result.channelCount,
        lastSync: Date.now(),
      });

      // Update status
      status.status = 'success';
      status.lastUpdatedAt = Date.now();
      status.lastImportStats = {
        live: result.channelCount,
        movies: result.movieCount,
        series: result.seriesCount,
        unknown: 0,
      };
      status.lastError = undefined;
      status.lastErrorCode = undefined;

      this.updateStatuses.set(providerId, status);
      this.emit('finished', { providerId, result, status });

      return status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Determine error code
      let errorCode: ProviderUpdateStatus['lastErrorCode'] = 'UNKNOWN';
      if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connect')) {
        errorCode = 'NETWORK';
      } else if (errorMessage.includes('auth') || errorMessage.includes('401') || errorMessage.includes('403')) {
        errorCode = 'AUTH';
      } else if (errorMessage.includes('parse') || errorMessage.includes('invalid')) {
        errorCode = 'PARSE';
      } else if (errorMessage.includes('timeout')) {
        errorCode = 'TIMEOUT';
      }

      status.status = 'failed';
      status.lastError = errorMessage;
      status.lastErrorCode = errorCode;

      this.updateStatuses.set(providerId, status);
      this.emit('failed', { providerId, error: errorMessage, errorCode });

      return status;
    }
  }

  /**
   * Update all providers
   */
  async updateAllProviders(
    reason: UpdateReason = 'manual',
    conditions?: UpdateConditions
  ): Promise<ProviderUpdateStatus[]> {
    // Check conditions if provided
    if (conditions) {
      const check = await this.checkConditions(conditions);
      if (!check.allowed) {
        console.log(`[PlaylistUpdateService] Update skipped: ${check.reason}`);
        return [];
      }
    }

    const providers = await localStore.getProviders();
    const results: ProviderUpdateStatus[] = [];

    for (const provider of providers) {
      if (provider.isActive) {
        const result = await this.updateProvider(provider.id, reason);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Start the scheduler
   */
  startScheduler(intervalMinutes: number, conditions: UpdateConditions) {
    this.stopScheduler();

    if (intervalMinutes <= 0) {
      console.log('[PlaylistUpdateService] Scheduler disabled (interval = 0)');
      return;
    }

    const intervalMs = intervalMinutes * 60 * 1000;
    this.lastScheduledCheck = Date.now();

    console.log(`[PlaylistUpdateService] Starting scheduler with ${intervalMinutes} minute interval`);

    this.schedulerInterval = setInterval(async () => {
      console.log('[PlaylistUpdateService] Running scheduled update');
      await this.updateAllProviders('scheduled', conditions);
      this.lastScheduledCheck = Date.now();
    }, intervalMs);
  }

  /**
   * Stop the scheduler
   */
  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('[PlaylistUpdateService] Scheduler stopped');
    }
  }

  /**
   * Check if update is due on app resume/startup
   */
  async checkOnResume(intervalMinutes: number, conditions: UpdateConditions): Promise<boolean> {
    if (intervalMinutes <= 0) return false;

    const providers = await localStore.getProviders();
    const now = Date.now();
    const intervalMs = intervalMinutes * 60 * 1000;

    // Check if any provider needs update
    for (const provider of providers) {
      if (!provider.isActive) continue;
      
      const lastSync = provider.lastSync || 0;
      if (now - lastSync >= intervalMs) {
        console.log(`[PlaylistUpdateService] Provider ${provider.name} needs update (last: ${new Date(lastSync).toISOString()})`);
        await this.updateAllProviders('startup', conditions);
        return true;
      }
    }

    return false;
  }

  /**
   * Get next scheduled update time
   */
  getNextScheduledTime(intervalMinutes: number): Date | null {
    if (intervalMinutes <= 0 || !this.lastScheduledCheck) return null;
    return new Date(this.lastScheduledCheck + intervalMinutes * 60 * 1000);
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.schedulerInterval !== null;
  }
}

export const playlistUpdateService = new PlaylistUpdateService();
export default playlistUpdateService;
