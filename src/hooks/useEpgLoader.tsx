/**
 * useEpgLoader - Hook to load EPG data from providers
 */

import { useEffect, useRef, useState } from 'react';
import { useProviders } from './useProviders';
import { EpgService } from '@/services/EpgService';
import { useEpgStore } from '@/data/stores/epgStore';
import { useChannelStore } from '@/data/stores/channelStore';

export function useEpgLoader() {
  const { providers } = useProviders();
  const hasLoaded = useRef(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const isLoading = useEpgStore((state) => state.isLoading);
  const programCount = useEpgStore((state) => state.programs.length);
  const channelCount = useChannelStore((state) => state.channels.length);

  useEffect(() => {
    // Don't load if no channels yet or already loaded
    if (channelCount === 0 || hasLoaded.current) {
      return;
    }

    // Find providers with EPG URLs
    const providersWithEpg = providers.filter(p => p.epg_url && p.is_active);
    
    if (providersWithEpg.length === 0) {
      console.log('[useEpgLoader] No providers with EPG URLs found');
      return;
    }

    const loadEpg = async () => {
      hasLoaded.current = true;
      setStatus('loading');

      for (const provider of providersWithEpg) {
        if (!provider.epg_url) continue;

        try {
          console.log(`[useEpgLoader] Loading EPG for provider: ${provider.name}`);
          const result = await EpgService.loadEpg(provider.epg_url);
          
          if (result.success) {
            console.log(`[useEpgLoader] Loaded ${result.programCount} programs for ${result.channelCount} channels`);
            setStatus('success');
          } else {
            console.warn(`[useEpgLoader] Failed to load EPG: ${result.error}`);
            setError(result.error || 'Unknown error');
          }
        } catch (err) {
          console.error(`[useEpgLoader] Error loading EPG for ${provider.name}:`, err);
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      }
    };

    loadEpg();
  }, [providers, channelCount]);

  // Periodically refresh now/next cache
  useEffect(() => {
    const interval = setInterval(() => {
      if (programCount > 0) {
        EpgService.refreshNowNextCache();
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [programCount]);

  return {
    isLoading,
    status,
    error,
    programCount,
  };
}
