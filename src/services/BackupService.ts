/**
 * BackupService - Handles encrypted backup export/import
 * Supports both encrypted and unencrypted backups
 */

import { localStore, LocalProvider, LocalFavorite, LocalRecent, LocalSettings } from '@/data/stores/localStore';
import { cryptoService, EncryptedPayload } from './CryptoService';

export interface BackupData {
  version: number;
  exportedAt: number;
  deviceId: string;
  providers: LocalProvider[];
  favorites: LocalFavorite[];
  recents: LocalRecent[];
  settings: LocalSettings | null;
}

export interface EncryptedBackup {
  format: 'streamvault-encrypted';
  version: number;
  createdAt: string;
  payload: EncryptedPayload;
}

export interface UnencryptedBackup {
  format: 'streamvault-plain';
  version: number;
  createdAt: string;
  data: BackupData;
}

export type Backup = EncryptedBackup | UnencryptedBackup;

class BackupService {
  private readonly BACKUP_VERSION = 1;

  /**
   * Export all local data as encrypted backup
   */
  async exportEncrypted(): Promise<string> {
    const data = await this.gatherBackupData();
    
    const encryptedPayload = await cryptoService.encrypt(JSON.stringify(data));
    
    const backup: EncryptedBackup = {
      format: 'streamvault-encrypted',
      version: this.BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      payload: encryptedPayload,
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Export all local data as unencrypted backup (with warning)
   */
  async exportUnencrypted(): Promise<string> {
    const data = await this.gatherBackupData();
    
    const backup: UnencryptedBackup = {
      format: 'streamvault-plain',
      version: this.BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      data,
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import backup (auto-detects encrypted vs unencrypted)
   */
  async importBackup(backupContent: string): Promise<{ 
    success: boolean; 
    error?: string;
    stats?: { providers: number; favorites: number; recents: number };
  }> {
    try {
      const backup = JSON.parse(backupContent);
      
      // Validate backup format
      if (!backup.format || !backup.version) {
        // Try legacy format (raw localStore export)
        if (backup.providers && backup.version === 1) {
          return this.importLegacyBackup(backup);
        }
        return { success: false, error: 'Invalid backup file format' };
      }

      let data: BackupData;

      if (backup.format === 'streamvault-encrypted') {
        // Decrypt the payload
        try {
          const decrypted = await cryptoService.decrypt(backup.payload);
          data = JSON.parse(decrypted);
        } catch (decryptError) {
          return { 
            success: false, 
            error: 'Failed to decrypt backup. This backup may have been created on a different device with a different encryption key.' 
          };
        }
      } else if (backup.format === 'streamvault-plain') {
        data = backup.data;
      } else {
        return { success: false, error: 'Unknown backup format' };
      }

      // Import the data
      await localStore.importAll({
        providers: data.providers,
        favorites: data.favorites,
        recents: data.recents,
        settings: data.settings || undefined,
      });

      return {
        success: true,
        stats: {
          providers: data.providers?.length || 0,
          favorites: data.favorites?.length || 0,
          recents: data.recents?.length || 0,
        },
      };
    } catch (error) {
      console.error('Import error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to parse backup file' 
      };
    }
  }

  /**
   * Import legacy backup format (pre-encryption)
   */
  private async importLegacyBackup(data: BackupData): Promise<{ 
    success: boolean; 
    error?: string;
    stats?: { providers: number; favorites: number; recents: number };
  }> {
    await localStore.importAll({
      providers: data.providers,
      favorites: data.favorites,
      recents: data.recents,
      settings: data.settings || undefined,
    });

    return {
      success: true,
      stats: {
        providers: data.providers?.length || 0,
        favorites: data.favorites?.length || 0,
        recents: data.recents?.length || 0,
      },
    };
  }

  /**
   * Gather all data for backup
   */
  private async gatherBackupData(): Promise<BackupData> {
    const [providers, favorites, recents, settings, deviceId] = await Promise.all([
      localStore.getProviders(),
      localStore.getFavorites(),
      localStore.getRecents(),
      localStore.getSettings(),
      localStore.getDeviceId(),
    ]);

    return {
      version: this.BACKUP_VERSION,
      exportedAt: Date.now(),
      deviceId,
      providers,
      favorites,
      recents,
      settings,
    };
  }

  /**
   * Download backup as file
   */
  downloadBackup(content: string, encrypted: boolean): void {
    const date = new Date().toISOString().split('T')[0];
    const suffix = encrypted ? 'encrypted' : 'plain';
    const filename = `streamvault-backup-${date}-${suffix}.json`;
    
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Check if backup is encrypted
   */
  isEncryptedBackup(content: string): boolean {
    try {
      const backup = JSON.parse(content);
      return backup.format === 'streamvault-encrypted';
    } catch {
      return false;
    }
  }
}

export const backupService = new BackupService();
export default backupService;
