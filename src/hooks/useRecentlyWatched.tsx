import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DbRecentlyWatched {
  id: string;
  user_id: string;
  channel_id: string;
  provider_id: string | null;
  last_watched_at: string;
  watch_duration: number;
}

export function useRecentlyWatched() {
  const { user } = useAuth();
  const [recentlyWatched, setRecentlyWatched] = useState<DbRecentlyWatched[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentlyWatched = useCallback(async () => {
    if (!user) {
      setRecentlyWatched([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("recently_watched")
        .select("*")
        .order("last_watched_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setRecentlyWatched((data || []) as DbRecentlyWatched[]);
    } catch (err) {
      console.error("Error fetching recently watched:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRecentlyWatched();
  }, [fetchRecentlyWatched]);

  const addToRecentlyWatched = useCallback(async (
    channelId: string,
    providerId?: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Upsert - update if exists, insert if not
      const { error } = await supabase.from("recently_watched").upsert(
        {
          user_id: user.id,
          channel_id: channelId,
          provider_id: providerId || null,
          last_watched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,channel_id" }
      );

      if (error) throw error;
      // Don't refetch immediately - this can cause re-render loops
      // await fetchRecentlyWatched();
      return true;
    } catch (err) {
      console.error("Error adding to recently watched:", err);
      return false;
    }
  }, [user]);

  const updateWatchDuration = async (
    channelId: string,
    duration: number
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("recently_watched")
        .update({ watch_duration: duration })
        .eq("user_id", user.id)
        .eq("channel_id", channelId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error updating watch duration:", err);
      return false;
    }
  };

  const clearHistory = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("recently_watched")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      setRecentlyWatched([]);
      return true;
    } catch (err) {
      console.error("Error clearing history:", err);
      return false;
    }
  };

  return {
    recentlyWatched,
    loading,
    addToRecentlyWatched,
    updateWatchDuration,
    clearHistory,
    refetch: fetchRecentlyWatched,
  };
}
