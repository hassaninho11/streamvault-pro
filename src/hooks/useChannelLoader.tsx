/**
 * useChannelLoader - Hook to load channels from all providers on app start
 * Implements stale-while-revalidate: loads from IndexedDB cache first, then refreshes in background
 */

import { useEffect, useRef, useState } from 'react';
import { useProviders } from './useProviders';
import { playlistService } from '@/services/PlaylistService';
import { useChannelStore } from '@/data/stores/channelStore';
import { cacheManager } from '@/data/cache/cacheManager';
import { useMetricsStore } from '@/data/stores/metricsStore';
import { useCategoryVisibilityStore } from '@/data/stores/categoryVisibilityStore';

export function useChannelLoader() {
  const { providers, loading: providersLoading } = useProviders();
  const hasLoaded = useRef(false);
  const channelCount = useChannelStore((state) => state.channels.length);
  const isLoading = useChannelStore((state) => state.isLoading);
  const index = useChannelStore((state) => state.index);
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0 });

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
      
      // Record metrics
      const metricsStore = useMetricsStore.getState();
      metricsStore.recordPlaylistLoadStart();
      
      const startTime = performance.now();
      let totalFromCache = 0;
      let totalFresh = 0;
      let totalChannels = 0;
      
      for (const provider of providers) {
        if (!provider.is_active) continue;

        try {
          let result;
          
          if (provider.type === 'xtream' && provider.xtream_host && provider.xtream_user && provider.xtream_pass_encrypted) {
            result = await playlistService.loadXtreamPlaylist(
              provider.xtream_host,
              provider.xtream_user,
              provider.xtream_pass_encrypted,
              provider.id
            );
          } else if (provider.m3u_url) {
            result = await playlistService.loadM3UPlaylist(provider.m3u_url, provider.id);
          }
          
          if (result?.success) {
            totalChannels += result.channelCount;
            if (result.fromCache) {
              totalFromCache += result.channelCount;
            } else {
              totalFresh += result.channelCount;
            }
          }
        } catch (error) {
          console.error(`[useChannelLoader] Error loading provider ${provider.name}:`, error);
        }
      }
      
      const elapsed = performance.now() - startTime;
      console.log(`[useChannelLoader] Loaded ${totalFromCache} from cache, ${totalFresh} fresh in ${elapsed.toFixed(0)}ms`);
      
      // Record completion metrics
      metricsStore.recordPlaylistLoadComplete({
        totalChannels,
        fromCache: totalFromCache,
        fresh: totalFresh,
        providerCount: providers.filter(p => p.is_active).length,
      });
      
      // Update cache stats
      setCacheStats(cacheManager.getCacheStats());
    };

    loadAllProviders();
  }, [providers, providersLoading, channelCount]);

  // Update category visibility metrics when index changes
  useEffect(() => {
    if (!index) return;
    
    const visibilityState = useCategoryVisibilityStore.getState();
    const groups = index.groups || [];
    const totalCategories = groups.length;
    
    // Count visible vs hidden
    let visibleCount = 0;
    let hiddenCount = 0;
    let estimatedSkippedItems = 0;
    
    if (visibilityState.hasConfigured.live) {
      for (const group of groups) {
        const categoryId = `default-live-${group.toLowerCase().trim().replace(/\s+/g, '_')}`;
        const isVisible = visibilityState.visibleCategoryIds.live.has(categoryId);
        
        if (isVisible) {
          visibleCount++;
        } else {
          hiddenCount++;
          // Count items in this hidden category
          const channelIds = index.byGroup.get(group);
          if (channelIds) {
            estimatedSkippedItems += channelIds.length;
          }
        }
      }
    } else {
      // Not configured = all visible
      visibleCount = totalCategories;
    }
    
    // Update metrics store
    useMetricsStore.getState().updateCategoryStats({
      total: totalCategories,
      visible: visibleCount,
      hidden: hiddenCount,
      estimatedSkippedItems,
    });
  }, [index]);

  return {
    isLoading: providersLoading || isLoading,
    channelCount,
    providerCount: providers.length,
    cacheStats,
  };
}
