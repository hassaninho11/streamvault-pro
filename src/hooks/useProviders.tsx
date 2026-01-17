import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { localStore, LocalProvider } from "@/data/stores/localStore";
import { playlistService } from "@/services/PlaylistService";
import { toast } from "sonner";

export interface DbProvider {
  id: string;
  user_id: string;
  name: string;
  type: "m3u" | "xtream";
  m3u_url: string | null;
  xtream_host: string | null;
  xtream_user: string | null;
  xtream_pass_encrypted: string | null;
  epg_url: string | null;
  last_sync: string | null;
  channel_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Unified provider type for UI consumption
export interface Provider {
  id: string;
  name: string;
  type: "m3u" | "xtream";
  m3u_url: string | null;
  xtream_host: string | null;
  xtream_user: string | null;
  xtream_pass_encrypted: string | null;
  epg_url: string | null;
  last_sync: string | null;
  channel_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderData {
  name: string;
  type: "m3u" | "xtream";
  m3u_url?: string;
  xtream_host?: string;
  xtream_user?: string;
  xtream_pass?: string;
  epg_url?: string;
}

// Convert LocalProvider to unified Provider format
function localToProvider(local: LocalProvider): Provider {
  return {
    id: local.id,
    name: local.name,
    type: local.type,
    m3u_url: local.m3uUrl || null,
    xtream_host: local.xtreamHost || null,
    xtream_user: local.xtreamUser || null,
    xtream_pass_encrypted: local.xtreamPassEncrypted || null,
    epg_url: local.epgUrl || null,
    last_sync: local.lastSync ? new Date(local.lastSync).toISOString() : null,
    channel_count: local.channelCount,
    is_active: local.isActive,
    created_at: new Date(local.createdAt).toISOString(),
    updated_at: new Date(local.updatedAt).toISOString(),
  };
}

// Convert DbProvider to unified Provider format
function dbToProvider(db: DbProvider): Provider {
  return {
    id: db.id,
    name: db.name,
    type: db.type,
    m3u_url: db.m3u_url,
    xtream_host: db.xtream_host,
    xtream_user: db.xtream_user,
    xtream_pass_encrypted: db.xtream_pass_encrypted,
    epg_url: db.epg_url,
    last_sync: db.last_sync,
    channel_count: db.channel_count,
    is_active: db.is_active,
    created_at: db.created_at,
    updated_at: db.updated_at,
  };
}

export function useProviders() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      
      if (user) {
        // Logged in: fetch from Supabase
        const { data, error: fetchError } = await supabase
          .from("providers")
          .select("*")
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        setProviders((data || []).map(dbToProvider));
      } else {
        // Guest mode: fetch from local storage
        const localProviders = await localStore.getProviders();
        setProviders(localProviders.map(localToProvider));
      }
      
      setError(null);
    } catch (err) {
      console.error("Error fetching providers:", err);
      setError("Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const addProvider = async (data: CreateProviderData): Promise<boolean> => {
    try {
      let providerId: string;

      if (user) {
        // Logged in: save to Supabase
        const { data: insertedData, error: insertError } = await supabase
          .from("providers")
          .insert({
            user_id: user.id,
            name: data.name,
            type: data.type,
            m3u_url: data.m3u_url || null,
            xtream_host: data.xtream_host || null,
            xtream_user: data.xtream_user || null,
            xtream_pass_encrypted: data.xtream_pass || null,
            epg_url: data.epg_url || null,
            is_active: true,
            channel_count: 0,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        providerId = insertedData.id;
      } else {
        // Guest mode: save to local storage
        const savedProvider = await localStore.saveProvider({
          name: data.name,
          type: data.type,
          m3uUrl: data.m3u_url,
          xtreamHost: data.xtream_host,
          xtreamUser: data.xtream_user,
          xtreamPassEncrypted: data.xtream_pass,
          epgUrl: data.epg_url,
          isActive: true,
          channelCount: 0,
        });
        providerId = savedProvider.id;
      }

      // Now load and parse the playlist
      toast.loading("Loading channels...", { id: "loading-channels" });
      
      let result;
      if (data.type === 'xtream' && data.xtream_host && data.xtream_user && data.xtream_pass) {
        result = await playlistService.loadXtreamPlaylist(
          data.xtream_host,
          data.xtream_user,
          data.xtream_pass,
          providerId
        );
      } else if (data.m3u_url) {
        result = await playlistService.loadM3UPlaylist(data.m3u_url, providerId);
      }

      toast.dismiss("loading-channels");

      if (result?.success) {
        // Update channel count
        await updateProvider(providerId, { 
          channel_count: result.channelCount,
          last_sync: new Date().toISOString(),
        });
        toast.success(`Provider added with ${result.channelCount} channels!`);
      } else if (result) {
        toast.error(`Failed to load channels: ${result.error}`);
      }

      await fetchProviders();
      return true;
    } catch (err) {
      console.error("Error adding provider:", err);
      toast.dismiss("loading-channels");
      toast.error("Failed to add provider");
      return false;
    }
  };

  const updateProvider = async (
    id: string,
    updates: Partial<Omit<Provider, "id" | "created_at" | "updated_at">>
  ): Promise<boolean> => {
    try {
      if (user) {
        // Logged in: update in Supabase
        const { error: updateError } = await supabase
          .from("providers")
          .update(updates)
          .eq("id", id);

        if (updateError) throw updateError;
      } else {
        // Guest mode: update in local storage
        const existing = await localStore.getProvider(id);
        if (existing) {
          await localStore.saveProvider({
            ...existing,
            name: updates.name ?? existing.name,
            type: updates.type ?? existing.type,
            m3uUrl: updates.m3u_url ?? existing.m3uUrl,
            xtreamHost: updates.xtream_host ?? existing.xtreamHost,
            xtreamUser: updates.xtream_user ?? existing.xtreamUser,
            xtreamPassEncrypted: updates.xtream_pass_encrypted ?? existing.xtreamPassEncrypted,
            epgUrl: updates.epg_url ?? existing.epgUrl,
            isActive: updates.is_active ?? existing.isActive,
            channelCount: updates.channel_count ?? existing.channelCount,
            lastSync: updates.last_sync ? new Date(updates.last_sync).getTime() : existing.lastSync,
          });
        }
      }

      await fetchProviders();
      toast.success("Provider updated");
      return true;
    } catch (err) {
      console.error("Error updating provider:", err);
      toast.error("Failed to update provider");
      return false;
    }
  };

  const deleteProvider = async (id: string): Promise<boolean> => {
    try {
      if (user) {
        // Logged in: delete from Supabase
        const { error: deleteError } = await supabase
          .from("providers")
          .delete()
          .eq("id", id);

        if (deleteError) throw deleteError;
      } else {
        // Guest mode: delete from local storage
        await localStore.deleteProvider(id);
      }

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
    // Find the provider to get its URL/credentials
    const provider = providers.find(p => p.id === id);
    if (!provider) {
      toast.error("Provider not found");
      return false;
    }

    toast.loading("Refreshing channels...", { id: "refresh-channels" });

    try {
      let result;
      
      if (provider.type === 'xtream' && provider.xtream_host && provider.xtream_user && provider.xtream_pass_encrypted) {
        result = await playlistService.loadXtreamPlaylist(
          provider.xtream_host,
          provider.xtream_user,
          provider.xtream_pass_encrypted, // Note: in production, decrypt this first
          id
        );
      } else if (provider.m3u_url) {
        result = await playlistService.loadM3UPlaylist(provider.m3u_url, id);
      } else {
        toast.dismiss("refresh-channels");
        toast.error("No playlist URL configured");
        return false;
      }

      toast.dismiss("refresh-channels");

      if (result?.success) {
        await updateProvider(id, { 
          channel_count: result.channelCount,
          last_sync: new Date().toISOString(),
        });
        toast.success(`Refreshed: ${result.channelCount} channels loaded`);
        return true;
      } else {
        toast.error(`Refresh failed: ${result?.error || 'Unknown error'}`);
        return false;
      }
    } catch (err) {
      toast.dismiss("refresh-channels");
      toast.error("Failed to refresh provider");
      console.error("Refresh error:", err);
      return false;
    }
  };

  return {
    providers,
    loading,
    error,
    addProvider,
    updateProvider,
    deleteProvider,
    refreshProvider,
    refetch: fetchProviders,
  };
}
