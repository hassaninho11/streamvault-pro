/**
 * useChannelLoader - Hook to load channels from all providers on app start
 * Ensures channelStore is populated with real data
 */

import { useEffect, useRef } from 'react';
import { useProviders } from './useProviders';
import { playlistService } from '@/services/PlaylistService';
import { useChannelStore } from '@/data/stores/channelStore';

export function useChannelLoader() {
  const { providers, loading: providersLoading } = useProviders();
  const hasLoaded = useRef(false);
  const channelCount = useChannelStore((state) => state.channels.length);
  const isLoading = useChannelStore((state) => state.isLoading);

  useEffect(() => {
    // Don't run if providers are still loading, already loaded, or no providers
    if (providersLoading || hasLoaded.current || providers.length === 0) {
      return;
    }

    // Don't reload if we already have channels
    if (channelCount > 0) {
      hasLoaded.current = true;
      return;
    }

    const loadAllProviders = async () => {
      hasLoaded.current = true;
      
      for (const provider of providers) {
        if (!provider.is_active) continue;

        try {
          if (provider.type === 'xtream' && provider.xtream_host && provider.xtream_user && provider.xtream_pass_encrypted) {
            await playlistService.loadXtreamPlaylist(
              provider.xtream_host,
              provider.xtream_user,
              provider.xtream_pass_encrypted,
              provider.id
            );
          } else if (provider.m3u_url) {
            await playlistService.loadM3UPlaylist(provider.m3u_url, provider.id);
          }
        } catch (error) {
          console.error(`[useChannelLoader] Error loading provider ${provider.name}:`, error);
        }
      }
    };

    loadAllProviders();
  }, [providers, providersLoading, channelCount]);

  return {
    isLoading: providersLoading || isLoading,
    channelCount,
    providerCount: providers.length,
  };
}
