/**
 * useLocalProviders - Hook for managing providers in local-first/guest mode
 * Encrypts sensitive data before storage
 */

import { useState, useEffect, useCallback } from "react";
import { localStore, LocalProvider } from "@/data/stores/localStore";
import { cryptoService, EncryptedPayload } from "@/services/CryptoService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface SecureProvider {
  id: string;
  name: string;
  type: 'm3u' | 'xtream';
  channelCount: number;
  isActive: boolean;
  lastSync?: number;
  createdAt: number;
  updatedAt: number;
  // Masked versions for display
  maskedUrl?: string;
  maskedUsername?: string;
  // Status
  hasCredentials: boolean;
}

export interface CreateLocalProviderData {
  name: string;
  type: 'm3u' | 'xtream';
  m3uUrl?: string;
  xtreamHost?: string;
  xtreamUser?: string;
  xtreamPass?: string;
  epgUrl?: string;
}

interface EncryptedCredentials {
  m3uUrl?: EncryptedPayload;
  xtreamHost?: EncryptedPayload;
  xtreamUser?: EncryptedPayload;
  xtreamPass?: EncryptedPayload;
  epgUrl?: EncryptedPayload;
}

export function useLocalProviders() {
  const { isGuest } = useAuth();
  const [providers, setProviders] = useState<SecureProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);
      const localProviders = await localStore.getProviders();
      
      // Convert to secure display format
      const secureProviders: SecureProvider[] = localProviders.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        channelCount: p.channelCount,
        isActive: p.isActive,
        lastSync: p.lastSync,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        maskedUrl: p.m3uUrl ? cryptoService.maskUrl(p.m3uUrl) : undefined,
        maskedUsername: p.xtreamUser ? cryptoService.maskUsername(p.xtreamUser) : undefined,
        hasCredentials: !!(p.m3uUrl || p.xtreamHost),
      }));

      setProviders(secureProviders);
      setError(null);
    } catch (err) {
      console.error("Error loading providers:", err);
      setError("Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const addProvider = async (data: CreateLocalProviderData): Promise<boolean> => {
    try {
      // Encrypt sensitive fields
      const encrypted: EncryptedCredentials = {};
      
      if (data.m3uUrl) {
        encrypted.m3uUrl = await cryptoService.encrypt(data.m3uUrl);
      }
      if (data.xtreamHost) {
        encrypted.xtreamHost = await cryptoService.encrypt(data.xtreamHost);
      }
      if (data.xtreamUser) {
        encrypted.xtreamUser = await cryptoService.encrypt(data.xtreamUser);
      }
      if (data.xtreamPass) {
        encrypted.xtreamPass = await cryptoService.encrypt(data.xtreamPass);
      }
      if (data.epgUrl) {
        encrypted.epgUrl = await cryptoService.encrypt(data.epgUrl);
      }

      // Store with encrypted data as JSON string
      await localStore.saveProvider({
        name: data.name,
        type: data.type,
        m3uUrl: data.m3uUrl ? JSON.stringify(encrypted.m3uUrl) : undefined,
        xtreamHost: data.xtreamHost ? JSON.stringify(encrypted.xtreamHost) : undefined,
        xtreamUser: data.xtreamUser ? JSON.stringify(encrypted.xtreamUser) : undefined,
        xtreamPassEncrypted: data.xtreamPass ? JSON.stringify(encrypted.xtreamPass) : undefined,
        epgUrl: data.epgUrl ? JSON.stringify(encrypted.epgUrl) : undefined,
        channelCount: 0,
        isActive: true,
      });

      await loadProviders();
      toast.success("Provider added successfully!");
      return true;
    } catch (err) {
      console.error("Error adding provider:", err);
      toast.error("Failed to add provider");
      return false;
    }
  };

  const deleteProvider = async (id: string): Promise<boolean> => {
    try {
      await localStore.deleteProvider(id);
      setProviders((prev) => prev.filter((p) => p.id !== id));
      toast.success("Provider removed");
      return true;
    } catch (err) {
      console.error("Error deleting provider:", err);
      toast.error("Failed to delete provider");
      return false;
    }
  };

  const refreshProvider = async (id: string): Promise<boolean> => {
    try {
      const provider = await localStore.getProvider(id);
      if (provider) {
        await localStore.saveProvider({
          ...provider,
          lastSync: Date.now(),
        });
        await loadProviders();
        toast.success("Provider synced");
      }
      return true;
    } catch (err) {
      console.error("Error refreshing provider:", err);
      toast.error("Failed to sync provider");
      return false;
    }
  };

  /**
   * Helper to decrypt a field that might be encrypted JSON or plain text
   */
  const decryptField = async (value: string | undefined): Promise<string> => {
    if (!value) return '';
    
    // Try to parse as JSON (encrypted format)
    try {
      const parsed = JSON.parse(value);
      // Check if it looks like an EncryptedPayload
      if (parsed && typeof parsed === 'object' && parsed.data && parsed.iv) {
        return await cryptoService.decrypt(parsed);
      }
      // It's valid JSON but not encrypted format, return as string
      return typeof parsed === 'string' ? parsed : value;
    } catch {
      // Not valid JSON, return as plain text
      return value;
    }
  };

  /**
   * Get decrypted URL for playback (internal use only)
   * This should only be called when actually needing to play content
   */
  const getDecryptedUrl = async (providerId: string): Promise<string | null> => {
    try {
      const provider = await localStore.getProvider(providerId);
      if (!provider) return null;

      if (provider.m3uUrl) {
        return await decryptField(provider.m3uUrl);
      }

      return null;
    } catch (err) {
      console.error("Error decrypting URL:", err);
      return null;
    }
  };

  /**
   * Get decrypted Xtream credentials for playback (internal use only)
   */
  const getDecryptedXtreamCredentials = async (providerId: string): Promise<{
    host: string;
    user: string;
    pass: string;
  } | null> => {
    try {
      const provider = await localStore.getProvider(providerId);
      if (!provider || !provider.xtreamHost) return null;

      const host = await decryptField(provider.xtreamHost);
      const user = await decryptField(provider.xtreamUser);
      const pass = await decryptField(provider.xtreamPassEncrypted);

      return { host, user, pass };
    } catch (err) {
      console.error("Error decrypting Xtream credentials:", err);
      return null;
    }
  };

  return {
    providers,
    loading,
    error,
    addProvider,
    deleteProvider,
    refreshProvider,
    getDecryptedUrl,
    getDecryptedXtreamCredentials,
    refetch: loadProviders,
    isGuestMode: isGuest,
  };
}

export default useLocalProviders;
