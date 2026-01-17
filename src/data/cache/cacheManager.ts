/**
 * IndexedDB Cache Layer - Persistent storage for channels, EPG, and logos
 * Implements stale-while-revalidate pattern
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { CoreChannel, CoreEpgProgram, CoreProvider } from '../../core/types';

interface StreamVaultDB extends DBSchema {
  channels: {
    key: string;
    value: {
      providerId: string;
      channels: CoreChannel[];
      hash: string;
      updatedAt: number;
    };
    indexes: { 'by-provider': string };
  };
  epg: {
    key: string; // "providerId:YYYY-MM-DD"
    value: {
      key: string;
      providerId: string;
      date: string;
      programs: CoreEpgProgram[];
      etag?: string;
      updatedAt: number;
    };
    indexes: { 'by-provider': string; 'by-date': string };
  };
  logos: {
    key: string; // URL
    value: {
      url: string;
      blob: Blob;
      updatedAt: number;
    };
  };
  providers: {
    key: string;
    value: CoreProvider & { updatedAt: number };
  };
  meta: {
    key: string;
    value: {
      key: string;
      value: unknown;
      updatedAt: number;
    };
  };
}

const DB_NAME = 'streamvault-cache';
const DB_VERSION = 1;

class CacheManager {
  private db: IDBPDatabase<StreamVaultDB> | null = null;
  private dbPromise: Promise<IDBPDatabase<StreamVaultDB>> | null = null;
  
  private hits = 0;
  private misses = 0;
  
  async getDB(): Promise<IDBPDatabase<StreamVaultDB>> {
    if (this.db) return this.db;
    
    if (!this.dbPromise) {
      this.dbPromise = openDB<StreamVaultDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Channels store
          if (!db.objectStoreNames.contains('channels')) {
            const channelStore = db.createObjectStore('channels', { keyPath: 'providerId' });
            channelStore.createIndex('by-provider', 'providerId');
          }
          
          // EPG store
          if (!db.objectStoreNames.contains('epg')) {
            const epgStore = db.createObjectStore('epg', { keyPath: 'key' });
            epgStore.createIndex('by-provider', 'providerId');
            epgStore.createIndex('by-date', 'date');
          }
          
          // Logos store
          if (!db.objectStoreNames.contains('logos')) {
            db.createObjectStore('logos', { keyPath: 'url' });
          }
          
          // Providers store
          if (!db.objectStoreNames.contains('providers')) {
            db.createObjectStore('providers', { keyPath: 'id' });
          }
          
          // Meta store
          if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta', { keyPath: 'key' });
          }
        },
      });
    }
    
    this.db = await this.dbPromise;
    return this.db;
  }
  
  // ============= Channels =============
  
  async getCachedChannels(providerId: string): Promise<{ channels: CoreChannel[]; hash: string } | null> {
    try {
      const db = await this.getDB();
      const cached = await db.get('channels', providerId);
      
      if (cached) {
        this.hits++;
        return { channels: cached.channels, hash: cached.hash };
      }
      
      this.misses++;
      return null;
    } catch (error) {
      console.error('[Cache] Error getting channels:', error);
      this.misses++;
      return null;
    }
  }
  
  async setCachedChannels(providerId: string, channels: CoreChannel[], hash: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('channels', {
        providerId,
        channels,
        hash,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('[Cache] Error setting channels:', error);
    }
  }
  
  // ============= EPG =============
  
  async getCachedEpg(providerId: string, date: string): Promise<CoreEpgProgram[] | null> {
    try {
      const db = await this.getDB();
      const key = `${providerId}:${date}`;
      const cached = await db.get('epg', key);
      
      if (cached) {
        this.hits++;
        return cached.programs;
      }
      
      this.misses++;
      return null;
    } catch (error) {
      console.error('[Cache] Error getting EPG:', error);
      this.misses++;
      return null;
    }
  }
  
  async setCachedEpg(providerId: string, date: string, programs: CoreEpgProgram[], etag?: string): Promise<void> {
    try {
      const db = await this.getDB();
      const key = `${providerId}:${date}`;
      await db.put('epg', {
        key,
        providerId,
        date,
        programs,
        etag,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('[Cache] Error setting EPG:', error);
    }
  }
  
  async cleanOldEpg(retentionDays: number = 7): Promise<void> {
    try {
      const db = await this.getDB();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retentionDays);
      const cutoffDate = cutoff.toISOString().split('T')[0];
      
      const tx = db.transaction('epg', 'readwrite');
      const index = tx.store.index('by-date');
      
      let cursor = await index.openCursor();
      let deleted = 0;
      
      while (cursor) {
        if (cursor.value.date < cutoffDate) {
          await cursor.delete();
          deleted++;
        }
        cursor = await cursor.continue();
      }
      
      await tx.done;
      console.log(`[Cache] Cleaned ${deleted} old EPG entries`);
    } catch (error) {
      console.error('[Cache] Error cleaning EPG:', error);
    }
  }
  
  // ============= Logos =============
  
  async getCachedLogo(url: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      const cached = await db.get('logos', url);
      
      if (cached) {
        this.hits++;
        return URL.createObjectURL(cached.blob);
      }
      
      this.misses++;
      return null;
    } catch (error) {
      console.error('[Cache] Error getting logo:', error);
      this.misses++;
      return null;
    }
  }
  
  async setCachedLogo(url: string, blob: Blob): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('logos', {
        url,
        blob,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('[Cache] Error setting logo:', error);
    }
  }
  
  // ============= Stats =============
  
  getCacheStats(): { hits: number; misses: number; hitRatio: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? this.hits / total : 0,
    };
  }
  
  /**
   * Get detailed cache statistics including size estimates
   */
  async getDetailedStats(): Promise<{
    channels: { count: number; providers: number; estimatedSize: number };
    epg: { count: number; days: number; estimatedSize: number };
    logos: { count: number; estimatedSize: number };
    total: { estimatedSize: number };
    lastUpdated: { channels?: number; epg?: number };
  }> {
    try {
      const db = await this.getDB();
      
      // Get channels stats
      const channelEntries = await db.getAll('channels');
      let channelCount = 0;
      let latestChannelUpdate = 0;
      for (const entry of channelEntries) {
        channelCount += entry.channels.length;
        if (entry.updatedAt > latestChannelUpdate) {
          latestChannelUpdate = entry.updatedAt;
        }
      }
      const channelSize = channelCount * 500; // ~500 bytes per channel estimate
      
      // Get EPG stats
      const epgEntries = await db.getAll('epg');
      let epgProgramCount = 0;
      let latestEpgUpdate = 0;
      const uniqueDates = new Set<string>();
      for (const entry of epgEntries) {
        epgProgramCount += entry.programs.length;
        uniqueDates.add(entry.date);
        if (entry.updatedAt > latestEpgUpdate) {
          latestEpgUpdate = entry.updatedAt;
        }
      }
      const epgSize = epgProgramCount * 200; // ~200 bytes per program estimate
      
      // Get logos stats
      const logoEntries = await db.getAll('logos');
      let logoSize = 0;
      for (const entry of logoEntries) {
        logoSize += entry.blob.size;
      }
      
      return {
        channels: {
          count: channelCount,
          providers: channelEntries.length,
          estimatedSize: channelSize,
        },
        epg: {
          count: epgProgramCount,
          days: uniqueDates.size,
          estimatedSize: epgSize,
        },
        logos: {
          count: logoEntries.length,
          estimatedSize: logoSize,
        },
        total: {
          estimatedSize: channelSize + epgSize + logoSize,
        },
        lastUpdated: {
          channels: latestChannelUpdate || undefined,
          epg: latestEpgUpdate || undefined,
        },
      };
    } catch (error) {
      console.error('[Cache] Error getting detailed stats:', error);
      return {
        channels: { count: 0, providers: 0, estimatedSize: 0 },
        epg: { count: 0, days: 0, estimatedSize: 0 },
        logos: { count: 0, estimatedSize: 0 },
        total: { estimatedSize: 0 },
        lastUpdated: {},
      };
    }
  }
  
  /**
   * Clear specific cache type
   */
  async clearByType(type: 'channels' | 'epg' | 'logos'): Promise<void> {
    try {
      const db = await this.getDB();
      await db.clear(type);
      console.log(`[Cache] Cleared ${type} cache`);
    } catch (error) {
      console.error(`[Cache] Error clearing ${type}:`, error);
    }
  }
  
  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      await Promise.all([
        db.clear('channels'),
        db.clear('epg'),
        db.clear('logos'),
        db.clear('providers'),
        db.clear('meta'),
      ]);
      this.hits = 0;
      this.misses = 0;
      console.log('[Cache] Cleared all caches');
    } catch (error) {
      console.error('[Cache] Error clearing cache:', error);
    }
  }
}

export const cacheManager = new CacheManager();
