import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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

export interface CreateProviderData {
  name: string;
  type: "m3u" | "xtream";
  m3u_url?: string;
  xtream_host?: string;
  xtream_user?: string;
  xtream_pass?: string;
  epg_url?: string;
}

export function useProviders() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<DbProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    if (!user) {
      setProviders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("providers")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setProviders((data || []) as DbProvider[]);
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
    if (!user) {
      toast.error("You must be logged in to add a provider");
      return false;
    }

    try {
      const { error: insertError } = await supabase.from("providers").insert({
        user_id: user.id,
        name: data.name,
        type: data.type,
        m3u_url: data.m3u_url || null,
        xtream_host: data.xtream_host || null,
        xtream_user: data.xtream_user || null,
        xtream_pass_encrypted: data.xtream_pass || null, // TODO: Encrypt in edge function
        epg_url: data.epg_url || null,
        is_active: true,
        channel_count: 0,
      });

      if (insertError) throw insertError;

      await fetchProviders();
      toast.success("Provider added successfully!");
      return true;
    } catch (err) {
      console.error("Error adding provider:", err);
      toast.error("Failed to add provider");
      return false;
    }
  };

  const updateProvider = async (
    id: string,
    updates: Partial<Omit<DbProvider, "id" | "user_id" | "created_at" | "updated_at">>
  ): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from("providers")
        .update(updates)
        .eq("id", id);

      if (updateError) throw updateError;

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
      const { error: deleteError } = await supabase
        .from("providers")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

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
    // Mark as synced - actual channel sync would happen here
    return updateProvider(id, { last_sync: new Date().toISOString() });
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
