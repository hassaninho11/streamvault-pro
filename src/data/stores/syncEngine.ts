/**
 * SyncEngine - Handles bidirectional sync between LocalStore and RemoteStore (Supabase)
 * Implements conflict resolution and merge strategies
 */

import { supabase } from '@/integrations/supabase/client';
import { localStore, LocalProvider, LocalFavorite, LocalRecent, LocalSettings } from './localStore';
import { APP_CONFIG } from '@/config/app';

export type SyncStrategy = 'keep_local' | 'keep_remote' | 'merge';
export type ConflictResolution = 'latest_wins' | 'local_wins' | 'remote_wins';

export interface SyncResult {
  success: boolean;
  providersUploaded: number;
  providersDownloaded: number;
  favoritesUploaded: number;
  favoritesDownloaded: number;
  recentsUploaded: number;
  recentsDownloaded: number;
  errors: string[];
  timestamp: number;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt?: number;
  pendingChanges: number;
  error?: string;
}

type SyncListener = (status: SyncStatus) => void;

class SyncEngine {
  private listeners: Set<SyncListener> = new Set();
  private syncInProgress = false;
  private autoSyncInterval: number | null = null;

  // ============= Status & Listeners =============

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(status: SyncStatus): void {
    this.listeners.forEach(l => l(status));
  }

  async getStatus(): Promise<SyncStatus> {
    const meta = await localStore.getSyncMeta();
    return {
      isSyncing: this.syncInProgress,
      lastSyncAt: meta.lastSyncAt,
      pendingChanges: meta.pendingChanges,
    };
  }

  // ============= Main Sync =============

  async sync(userId: string, strategy: SyncStrategy = 'merge'): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        providersUploaded: 0,
        providersDownloaded: 0,
        favoritesUploaded: 0,
        favoritesDownloaded: 0,
        recentsUploaded: 0,
        recentsDownloaded: 0,
        errors: ['Sync already in progress'],
        timestamp: Date.now(),
      };
    }

    this.syncInProgress = true;
    this.notifyListeners({ isSyncing: true, pendingChanges: 0 });

    const result: SyncResult = {
      success: true,
      providersUploaded: 0,
      providersDownloaded: 0,
      favoritesUploaded: 0,
      favoritesDownloaded: 0,
      recentsUploaded: 0,
      recentsDownloaded: 0,
      errors: [],
      timestamp: Date.now(),
    };

    try {
      const meta = await localStore.getSyncMeta();

      // Sync providers
      const providerResult = await this.syncProviders(userId, strategy, meta.lastSyncAt);
      result.providersUploaded = providerResult.uploaded;
      result.providersDownloaded = providerResult.downloaded;
      result.errors.push(...providerResult.errors);

      // Sync favorites
      const favResult = await this.syncFavorites(userId, strategy, meta.lastSyncAt);
      result.favoritesUploaded = favResult.uploaded;
      result.favoritesDownloaded = favResult.downloaded;
      result.errors.push(...favResult.errors);

      // Sync recents
      const recentResult = await this.syncRecents(userId, strategy, meta.lastSyncAt);
      result.recentsUploaded = recentResult.uploaded;
      result.recentsDownloaded = recentResult.downloaded;
      result.errors.push(...recentResult.errors);

      // Update sync meta
      await localStore.resetPendingChanges();

      result.success = result.errors.length === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    } finally {
      this.syncInProgress = false;
      const status = await this.getStatus();
      this.notifyListeners(status);
    }

    return result;
  }

  // ============= Providers Sync =============

  private async syncProviders(
    userId: string, 
    strategy: SyncStrategy, 
    lastSyncAt?: number
  ): Promise<{ uploaded: number; downloaded: number; errors: string[] }> {
    const errors: string[] = [];
    let uploaded = 0;
    let downloaded = 0;

    try {
      // Get local providers
      const localProviders = await localStore.getProviders();

      // Get remote providers
      const { data: remoteProviders, error } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        errors.push(`Failed to fetch remote providers: ${error.message}`);
        return { uploaded, downloaded, errors };
      }

      if (strategy === 'keep_local') {
        // Upload all local to remote
        for (const local of localProviders) {
          const result = await this.upsertRemoteProvider(userId, local);
          if (result.error) errors.push(result.error);
          else uploaded++;
        }
      } else if (strategy === 'keep_remote') {
        // Replace local with remote
        for (const remote of remoteProviders || []) {
          await localStore.saveProvider(this.remoteToLocalProvider(remote));
          downloaded++;
        }
      } else {
        // Merge: latest wins
        const remoteMap = new Map((remoteProviders || []).map(p => [p.id, p]));
        
        // Upload local changes
        for (const local of localProviders) {
          const remote = remoteMap.get(local.id);
          if (!remote || new Date(remote.updated_at).getTime() < local.updatedAt) {
            const result = await this.upsertRemoteProvider(userId, local);
            if (result.error) errors.push(result.error);
            else uploaded++;
          }
        }

        // Download remote changes
        for (const remote of remoteProviders || []) {
          const local = localProviders.find(p => p.id === remote.id);
          if (!local || local.updatedAt < new Date(remote.updated_at).getTime()) {
            await localStore.saveProvider(this.remoteToLocalProvider(remote));
            downloaded++;
          }
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Provider sync error');
    }

    return { uploaded, downloaded, errors };
  }

  private async upsertRemoteProvider(userId: string, local: LocalProvider): Promise<{ error?: string }> {
    const { error } = await supabase
      .from('providers')
      .upsert({
        id: local.id,
        user_id: userId,
        name: local.name,
        type: local.type,
        m3u_url: local.m3uUrl,
        xtream_host: local.xtreamHost,
        xtream_user: local.xtreamUser,
        xtream_pass_encrypted: local.xtreamPassEncrypted,
        epg_url: local.epgUrl,
        channel_count: local.channelCount,
        is_active: local.isActive,
        last_sync: local.lastSync ? new Date(local.lastSync).toISOString() : null,
        updated_at: new Date(local.updatedAt).toISOString(),
      });

    return { error: error?.message };
  }

  private remoteToLocalProvider(remote: Record<string, unknown>): LocalProvider {
    return {
      id: remote.id as string,
      name: remote.name as string,
      type: remote.type as 'm3u' | 'xtream',
      m3uUrl: remote.m3u_url as string | undefined,
      xtreamHost: remote.xtream_host as string | undefined,
      xtreamUser: remote.xtream_user as string | undefined,
      xtreamPassEncrypted: remote.xtream_pass_encrypted as string | undefined,
      epgUrl: remote.epg_url as string | undefined,
      channelCount: (remote.channel_count as number) || 0,
      isActive: (remote.is_active as boolean) ?? true,
      lastSync: remote.last_sync ? new Date(remote.last_sync as string).getTime() : undefined,
      createdAt: new Date(remote.created_at as string).getTime(),
      updatedAt: new Date(remote.updated_at as string).getTime(),
    };
  }

  // ============= Favorites Sync =============

  private async syncFavorites(
    userId: string,
    strategy: SyncStrategy,
    _lastSyncAt?: number
  ): Promise<{ uploaded: number; downloaded: number; errors: string[] }> {
    const errors: string[] = [];
    let uploaded = 0;
    let downloaded = 0;

    try {
      const localFavorites = await localStore.getFavorites();

      const { data: remoteFavorites, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        errors.push(`Failed to fetch remote favorites: ${error.message}`);
        return { uploaded, downloaded, errors };
      }

      if (strategy === 'keep_local') {
        for (const local of localFavorites) {
          const { error: upsertError } = await supabase
            .from('favorites')
            .upsert({
              id: local.id,
              user_id: userId,
              channel_id: local.channelId,
              provider_id: local.providerId,
            });
          if (upsertError) errors.push(upsertError.message);
          else uploaded++;
        }
      } else if (strategy === 'keep_remote') {
        for (const remote of remoteFavorites || []) {
          await localStore.addFavorite(remote.channel_id, remote.provider_id || '');
          downloaded++;
        }
      } else {
        // Merge: combine both sets
        const remoteSet = new Set((remoteFavorites || []).map(f => f.channel_id));
        const localSet = new Set(localFavorites.map(f => f.channelId));

        // Upload local-only favorites
        for (const local of localFavorites) {
          if (!remoteSet.has(local.channelId)) {
            const { error: upsertError } = await supabase
              .from('favorites')
              .upsert({
                id: local.id,
                user_id: userId,
                channel_id: local.channelId,
                provider_id: local.providerId,
              });
            if (upsertError) errors.push(upsertError.message);
            else uploaded++;
          }
        }

        // Download remote-only favorites
        for (const remote of remoteFavorites || []) {
          if (!localSet.has(remote.channel_id)) {
            await localStore.addFavorite(remote.channel_id, remote.provider_id || '');
            downloaded++;
          }
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Favorites sync error');
    }

    return { uploaded, downloaded, errors };
  }

  // ============= Recents Sync =============

  private async syncRecents(
    userId: string,
    strategy: SyncStrategy,
    _lastSyncAt?: number
  ): Promise<{ uploaded: number; downloaded: number; errors: string[] }> {
    const errors: string[] = [];
    let uploaded = 0;
    let downloaded = 0;

    try {
      const localRecents = await localStore.getRecents(100);

      const { data: remoteRecents, error } = await supabase
        .from('recently_watched')
        .select('*')
        .eq('user_id', userId)
        .order('last_watched_at', { ascending: false })
        .limit(100);

      if (error) {
        errors.push(`Failed to fetch remote recents: ${error.message}`);
        return { uploaded, downloaded, errors };
      }

      if (strategy === 'keep_local') {
        for (const local of localRecents) {
          const { error: upsertError } = await supabase
            .from('recently_watched')
            .upsert({
              id: local.id,
              user_id: userId,
              channel_id: local.channelId,
              provider_id: local.providerId,
              last_watched_at: new Date(local.lastWatchedAt).toISOString(),
              watch_duration: local.watchDuration,
            });
          if (upsertError) errors.push(upsertError.message);
          else uploaded++;
        }
      } else if (strategy === 'keep_remote') {
        await localStore.clearRecents();
        for (const remote of remoteRecents || []) {
          await localStore.addRecent(remote.channel_id, remote.provider_id || '');
          downloaded++;
        }
      } else {
        // Merge: take most recent from both
        const remoteMap = new Map((remoteRecents || []).map(r => [r.channel_id, r]));

        for (const local of localRecents) {
          const remote = remoteMap.get(local.channelId);
          if (!remote || new Date(remote.last_watched_at).getTime() < local.lastWatchedAt) {
            const { error: upsertError } = await supabase
              .from('recently_watched')
              .upsert({
                id: local.id,
                user_id: userId,
                channel_id: local.channelId,
                provider_id: local.providerId,
                last_watched_at: new Date(local.lastWatchedAt).toISOString(),
                watch_duration: local.watchDuration,
              });
            if (upsertError) errors.push(upsertError.message);
            else uploaded++;
          }
        }

        for (const remote of remoteRecents || []) {
          const local = localRecents.find(l => l.channelId === remote.channel_id);
          if (!local || local.lastWatchedAt < new Date(remote.last_watched_at).getTime()) {
            await localStore.addRecent(remote.channel_id, remote.provider_id || '');
            downloaded++;
          }
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Recents sync error');
    }

    return { uploaded, downloaded, errors };
  }

  // ============= Auto Sync =============

  startAutoSync(userId: string): void {
    this.stopAutoSync();
    this.autoSyncInterval = window.setInterval(() => {
      this.sync(userId, 'merge');
    }, APP_CONFIG.sync.autoSyncIntervalMs);
  }

  stopAutoSync(): void {
    if (this.autoSyncInterval !== null) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }
}

export const syncEngine = new SyncEngine();
export default syncEngine;
