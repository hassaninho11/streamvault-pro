import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface DbFavorite {
  id: string;
  user_id: string;
  channel_id: string;
  provider_id: string | null;
  created_at: string;
}

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<DbFavorite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("favorites")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFavorites((data || []) as DbFavorite[]);
    } catch (err) {
      console.error("Error fetching favorites:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const isFavorite = useCallback(
    (channelId: string) => favorites.some((f) => f.channel_id === channelId),
    [favorites]
  );

  const addFavorite = async (channelId: string, providerId?: string): Promise<boolean> => {
    if (!user) {
      toast.error("You must be logged in");
      return false;
    }

    try {
      const { error } = await supabase.from("favorites").insert({
        user_id: user.id,
        channel_id: channelId,
        provider_id: providerId || null,
      });

      if (error) throw error;
      await fetchFavorites();
      toast.success("Added to favorites");
      return true;
    } catch (err) {
      console.error("Error adding favorite:", err);
      toast.error("Failed to add favorite");
      return false;
    }
  };

  const removeFavorite = async (channelId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("channel_id", channelId);

      if (error) throw error;
      setFavorites((prev) => prev.filter((f) => f.channel_id !== channelId));
      toast.success("Removed from favorites");
      return true;
    } catch (err) {
      console.error("Error removing favorite:", err);
      toast.error("Failed to remove favorite");
      return false;
    }
  };

  const toggleFavorite = async (channelId: string, providerId?: string): Promise<boolean> => {
    if (isFavorite(channelId)) {
      return removeFavorite(channelId);
    } else {
      return addFavorite(channelId, providerId);
    }
  };

  return {
    favorites,
    loading,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    refetch: fetchFavorites,
  };
}
