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
      providerId: string;
      date: string;
      programs: CoreEpgProgram[];
      etag?: string;
      updatedAt: number;
    };
    indexes: { 'by-provider': string };
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
      // Ignore logo cache errors
    }
  }
  
  // ============= Stats =============
  
  getCacheStats(): { hitRatio: number; hits: number; misses: number } {
    const total = this.hits + this.misses;
    return {
      hitRatio: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
    };
  }
  
  async clearAll(): Promise<void> {
    const db = await this.getDB();
    await db.clear('channels');
    await db.clear('epg');
    await db.clear('logos');
    await db.clear('providers');
    await db.clear('meta');
    this.hits = 0;
    this.misses = 0;
  }
}

export const cacheManager = new CacheManager();
