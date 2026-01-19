/**
 * LocalStore - IndexedDB-based local storage for guest mode and offline-first
 * Handles all local data persistence independent of account state
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ============= Types =============

export interface LocalProvider {
  id: string;
  name: string;
  type: 'm3u' | 'xtream';
  m3uUrl?: string;
  xtreamHost?: string;
  xtreamUser?: string;
  xtreamPassEncrypted?: string;
  epgUrl?: string;
  channelCount: number;
  isActive: boolean;
  lastSync?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number; // Soft delete for sync
}

export interface LocalFavorite {
  id: string;
  channelId: string;
  providerId: string;
  createdAt: number;
  deletedAt?: number;
}

export interface LocalRecent {
  id: string;
  channelId: string;
  providerId: string;
  lastWatchedAt: number;
  watchDuration: number;
  deletedAt?: number;
}

export interface LocalSettings {
  id: string;
  theme: 'dark' | 'light' | 'system';
  language: string;
  playerSettings: {
    autoplay: boolean;
    defaultQuality: 'auto' | 'high' | 'medium' | 'low';
    bufferSize: number;
    customProxyUrl?: string; // Custom stream proxy URL
    httpStreamStrategy?: 'auto' | 'proxy_https' | 'cast_chromecast' | 'external_player'; // Remember choice for HTTP streams
    mkvPlayerPreference?: 'auto' | 'native' | 'vlc'; // Preferred player for MKV files
  };
  selectedProfileId?: string;
  updatedAt: number;
}

export interface LocalEntitlement {
  id: string;
  deviceId: string;
  isPremium: boolean;
  isTrial: boolean;
  trialStartedAt?: number;
  trialEndsAt?: number;
  plan?: string;
  source: 'local' | 'stripe' | 'iap' | 'server';
  purchaseToken?: string;
  expiresAt?: number;
  updatedAt: number;
}

export interface SyncMeta {
  deviceId: string;
  lastSyncAt?: number;
  pendingChanges: number;
}

// ============= DB Schema =============

interface LocalStoreDB extends DBSchema {
  providers: {
    key: string;
    value: LocalProvider;
    indexes: { 'by-updated': number };
  };
  favorites: {
    key: string;
    value: LocalFavorite;
    indexes: { 'by-channel': string; 'by-updated': number };
  };
  recents: {
    key: string;
    value: LocalRecent;
    indexes: { 'by-channel': string; 'by-watched': number };
  };
  settings: {
    key: string;
    value: LocalSettings;
  };
  entitlements: {
    key: string;
    value: LocalEntitlement;
  };
  syncMeta: {
    key: string;
    value: SyncMeta;
  };
}

const DB_NAME = 'streamvault-local';
const DB_VERSION = 1;

// ============= LocalStore Class =============

class LocalStore {
  private db: IDBPDatabase<LocalStoreDB> | null = null;
  private dbPromise: Promise<IDBPDatabase<LocalStoreDB>> | null = null;
  private deviceId: string | null = null;

  async getDB(): Promise<IDBPDatabase<LocalStoreDB>> {
    if (this.db) return this.db;

    if (!this.dbPromise) {
      this.dbPromise = openDB<LocalStoreDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Providers store
          if (!db.objectStoreNames.contains('providers')) {
            const store = db.createObjectStore('providers', { keyPath: 'id' });
            store.createIndex('by-updated', 'updatedAt');
          }

          // Favorites store
          if (!db.objectStoreNames.contains('favorites')) {
            const store = db.createObjectStore('favorites', { keyPath: 'id' });
            store.createIndex('by-channel', 'channelId');
            store.createIndex('by-updated', 'createdAt');
          }

          // Recents store
          if (!db.objectStoreNames.contains('recents')) {
            const store = db.createObjectStore('recents', { keyPath: 'id' });
            store.createIndex('by-channel', 'channelId');
            store.createIndex('by-watched', 'lastWatchedAt');
          }

          // Settings store
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }

          // Entitlements store
          if (!db.objectStoreNames.contains('entitlements')) {
            db.createObjectStore('entitlements', { keyPath: 'id' });
          }

          // Sync meta store
          if (!db.objectStoreNames.contains('syncMeta')) {
            db.createObjectStore('syncMeta', { keyPath: 'deviceId' });
          }
        },
      });
    }

    this.db = await this.dbPromise;
    return this.db;
  }

  // ============= Device ID =============

  async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;

    const db = await this.getDB();
    const meta = await db.get('syncMeta', 'device');
    
    if (meta?.deviceId) {
      this.deviceId = meta.deviceId;
      return meta.deviceId;
    }

    // Generate new device ID
    const newId = crypto.randomUUID();
    await db.put('syncMeta', {
      deviceId: newId,
      pendingChanges: 0,
    });
    this.deviceId = newId;
    return newId;
  }

  // ============= Providers =============

  async getProviders(): Promise<LocalProvider[]> {
    const db = await this.getDB();
    const all = await db.getAll('providers');
    return all.filter(p => !p.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getProvider(id: string): Promise<LocalProvider | undefined> {
    const db = await this.getDB();
    const provider = await db.get('providers', id);
    return provider?.deletedAt ? undefined : provider;
  }

  async saveProvider(provider: Omit<LocalProvider, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<LocalProvider> {
    const db = await this.getDB();
    const now = Date.now();
    const existing = provider.id ? await db.get('providers', provider.id) : undefined;
    
    const record: LocalProvider = {
      ...provider,
      id: provider.id || crypto.randomUUID(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await db.put('providers', record);
    await this.incrementPendingChanges();
    return record;
  }

  async deleteProvider(id: string): Promise<void> {
    const db = await this.getDB();
    const provider = await db.get('providers', id);
    if (provider) {
      provider.deletedAt = Date.now();
      provider.updatedAt = Date.now();
      await db.put('providers', provider);
      await this.incrementPendingChanges();
    }
  }

  // ============= Favorites =============

  async getFavorites(): Promise<LocalFavorite[]> {
    const db = await this.getDB();
    const all = await db.getAll('favorites');
    return all.filter(f => !f.deletedAt).sort((a, b) => b.createdAt - a.createdAt);
  }

  async addFavorite(channelId: string, providerId: string): Promise<LocalFavorite> {
    const db = await this.getDB();
    const existing = await db.getFromIndex('favorites', 'by-channel', channelId);
    
    if (existing && !existing.deletedAt) {
      return existing;
    }

    const record: LocalFavorite = {
      id: existing?.id || crypto.randomUUID(),
      channelId,
      providerId,
      createdAt: Date.now(),
      deletedAt: undefined,
    };

    await db.put('favorites', record);
    await this.incrementPendingChanges();
    return record;
  }

  async removeFavorite(channelId: string): Promise<void> {
    const db = await this.getDB();
    const favorite = await db.getFromIndex('favorites', 'by-channel', channelId);
    if (favorite) {
      favorite.deletedAt = Date.now();
      await db.put('favorites', favorite);
      await this.incrementPendingChanges();
    }
  }

  async isFavorite(channelId: string): Promise<boolean> {
    const db = await this.getDB();
    const favorite = await db.getFromIndex('favorites', 'by-channel', channelId);
    return !!favorite && !favorite.deletedAt;
  }

  // ============= Recents =============

  async getRecents(limit = 50): Promise<LocalRecent[]> {
    const db = await this.getDB();
    const all = await db.getAllFromIndex('recents', 'by-watched');
    return all
      .filter(r => !r.deletedAt)
      .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)
      .slice(0, limit);
  }

  async addRecent(channelId: string, providerId: string): Promise<LocalRecent> {
    const db = await this.getDB();
    const existing = await db.getFromIndex('recents', 'by-channel', channelId);
    
    const record: LocalRecent = {
      id: existing?.id || crypto.randomUUID(),
      channelId,
      providerId,
      lastWatchedAt: Date.now(),
      watchDuration: existing?.watchDuration || 0,
      deletedAt: undefined,
    };

    await db.put('recents', record);
    await this.incrementPendingChanges();
    return record;
  }

  async updateWatchDuration(channelId: string, duration: number): Promise<void> {
    const db = await this.getDB();
    const recent = await db.getFromIndex('recents', 'by-channel', channelId);
    if (recent) {
      recent.watchDuration = duration;
      await db.put('recents', recent);
    }
  }

  async clearRecents(): Promise<void> {
    const db = await this.getDB();
    const all = await db.getAll('recents');
    const now = Date.now();
    for (const recent of all) {
      recent.deletedAt = now;
      await db.put('recents', recent);
    }
    await this.incrementPendingChanges();
  }

  // ============= Settings =============

  async getSettings(): Promise<LocalSettings> {
    const db = await this.getDB();
    const settings = await db.get('settings', 'default');
    return settings || this.getDefaultSettings();
  }

  async saveSettings(settings: Partial<LocalSettings>): Promise<LocalSettings> {
    const db = await this.getDB();
    const current = await this.getSettings();
    const updated: LocalSettings = {
      ...current,
      ...settings,
      id: 'default',
      updatedAt: Date.now(),
    };
    await db.put('settings', updated);
    await this.incrementPendingChanges();
    return updated;
  }

  private getDefaultSettings(): LocalSettings {
    return {
      id: 'default',
      theme: 'dark',
      language: 'en',
      playerSettings: {
        autoplay: true,
        defaultQuality: 'auto',
        bufferSize: 30,
      },
      updatedAt: Date.now(),
    };
  }

  // ============= Entitlements =============

  async getEntitlement(): Promise<LocalEntitlement | null> {
    const db = await this.getDB();
    const deviceId = await this.getDeviceId();
    return await db.get('entitlements', deviceId) || null;
  }

  async saveEntitlement(entitlement: Partial<LocalEntitlement>): Promise<LocalEntitlement> {
    const db = await this.getDB();
    const deviceId = await this.getDeviceId();
    const existing = await db.get('entitlements', deviceId);
    
    const record: LocalEntitlement = {
      id: deviceId,
      deviceId,
      isPremium: false,
      isTrial: false,
      source: 'local',
      ...existing,
      ...entitlement,
      updatedAt: Date.now(),
    };

    await db.put('entitlements', record);
    return record;
  }

  // ============= Sync Meta =============

  async getSyncMeta(): Promise<SyncMeta> {
    const db = await this.getDB();
    const deviceId = await this.getDeviceId();
    const meta = await db.get('syncMeta', deviceId);
    return meta || { deviceId, pendingChanges: 0 };
  }

  async updateSyncMeta(meta: Partial<SyncMeta>): Promise<void> {
    const db = await this.getDB();
    const deviceId = await this.getDeviceId();
    const current = await this.getSyncMeta();
    await db.put('syncMeta', { ...current, ...meta, deviceId });
  }

  private async incrementPendingChanges(): Promise<void> {
    const meta = await this.getSyncMeta();
    await this.updateSyncMeta({ pendingChanges: meta.pendingChanges + 1 });
  }

  async resetPendingChanges(): Promise<void> {
    await this.updateSyncMeta({ pendingChanges: 0, lastSyncAt: Date.now() });
  }

  // ============= Export/Import =============

  async exportAll(): Promise<object> {
    const db = await this.getDB();
    return {
      version: 1,
      exportedAt: Date.now(),
      deviceId: await this.getDeviceId(),
      providers: await db.getAll('providers'),
      favorites: await db.getAll('favorites'),
      recents: await db.getAll('recents'),
      settings: await db.get('settings', 'default'),
    };
  }

  async importAll(data: {
    providers?: LocalProvider[];
    favorites?: LocalFavorite[];
    recents?: LocalRecent[];
    settings?: LocalSettings;
  }): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['providers', 'favorites', 'recents', 'settings'], 'readwrite');

    if (data.providers) {
      for (const p of data.providers) {
        await tx.objectStore('providers').put(p);
      }
    }
    if (data.favorites) {
      for (const f of data.favorites) {
        await tx.objectStore('favorites').put(f);
      }
    }
    if (data.recents) {
      for (const r of data.recents) {
        await tx.objectStore('recents').put(r);
      }
    }
    if (data.settings) {
      await tx.objectStore('settings').put(data.settings);
    }

    await tx.done;
  }

  // ============= Clear All =============

  async clearAll(): Promise<void> {
    const db = await this.getDB();
    await Promise.all([
      db.clear('providers'),
      db.clear('favorites'),
      db.clear('recents'),
      db.clear('settings'),
      db.clear('entitlements'),
    ]);
  }
}

export const localStore = new LocalStore();
export default localStore;
