/**
 * useVodLoader - Hook to load VOD (movies/series) from Xtream providers
 */

import { useEffect, useRef, useState } from 'react';
import { useProviders } from './useProviders';
import { useLocalProviders } from './useLocalProviders';
import { useAuth } from './useAuth';
import { VodService } from '@/services/VodService';
import { useVodStore } from '@/data/stores/vodStore';

export function useVodLoader() {
  const { user } = useAuth();
  const { providers } = useProviders();
  const { getDecryptedXtreamCredentials } = useLocalProviders();
  const hasLoaded = useRef(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const isLoading = useVodStore((state) => state.isLoading);
  const movieCount = useVodStore((state) => state.movies.length);
  const seriesCount = useVodStore((state) => state.series.length);

  useEffect(() => {
    // Only load once
    if (hasLoaded.current) {
      return;
    }

    // Find Xtream providers (they have VOD)
    const xtreamProviders = providers.filter(p => 
      p.type === 'xtream' && 
      p.xtream_host && 
      p.xtream_user && 
      p.xtream_pass_encrypted &&
      p.is_active
    );
    
    if (xtreamProviders.length === 0) {
      console.log('[useVodLoader] No Xtream providers found');
      return;
    }

    const loadVod = async () => {
      hasLoaded.current = true;
      setStatus('loading');

      for (const provider of xtreamProviders) {
        if (!provider.xtream_host || !provider.xtream_user || !provider.xtream_pass_encrypted) {
          continue;
        }

        try {
          console.log(`[useVodLoader] Loading VOD for provider: ${provider.name}`);
          
          // Get decrypted credentials
          let host: string;
          let username: string;
          let password: string;
          
          if (user) {
            // For logged-in users, credentials are stored as-is in Supabase
            host = provider.xtream_host;
            username = provider.xtream_user;
            password = provider.xtream_pass_encrypted;
          } else {
            // For guests, decrypt the credentials
            const creds = await getDecryptedXtreamCredentials(provider.id);
            if (!creds) {
              console.error(`[useVodLoader] Could not decrypt credentials for ${provider.name}`);
              continue;
            }
            host = creds.host;
            username = creds.user;
            password = creds.pass;
          }
          
          // Load movies
          const moviesResult = await VodService.loadMovies(
            host,
            username,
            password,
            provider.id
          );
          
          if (moviesResult.success) {
            console.log(`[useVodLoader] Loaded ${moviesResult.movieCount} movies`);
          }

          // Load series
          const seriesResult = await VodService.loadSeries(
            host,
            username,
            password,
            provider.id
          );
          
          if (seriesResult.success) {
            console.log(`[useVodLoader] Loaded ${seriesResult.seriesCount} series`);
          }

          setStatus('success');
        } catch (err) {
          console.error(`[useVodLoader] Error loading VOD for ${provider.name}:`, err);
          setError(err instanceof Error ? err.message : 'Unknown error');
          setStatus('error');
        }
      }
    };

    // Delay VOD loading slightly to prioritize live channels
    const timer = setTimeout(loadVod, 2000);
    return () => clearTimeout(timer);
  }, [providers, user, getDecryptedXtreamCredentials]);

  return {
    isLoading,
    status,
    error,
    movieCount,
    seriesCount,
  };
}
