/**
 * CacheManagement - UI for managing IndexedDB cache
 * Shows stats, allows clearing, and force refresh
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Trash2,
  RefreshCw,
  HardDrive,
  Tv,
  Calendar,
  Image,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cacheManager } from '@/data/cache/cacheManager';
import { playlistService } from '@/services/PlaylistService';
import { useProviders } from '@/hooks/useProviders';
import { useChannelStore } from '@/data/stores/channelStore';
import { cn } from '@/lib/utils';

interface CacheStats {
  channels: { count: number; providers: number; estimatedSize: number };
  epg: { count: number; days: number; estimatedSize: number };
  logos: { count: number; estimatedSize: number };
  total: { estimatedSize: number };
  lastUpdated: { channels?: number; epg?: number };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return 'Never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function CacheManagement() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { providers } = useProviders();
  const cacheHitStats = cacheManager.getCacheStats();
  const storeChannelCount = useChannelStore((state) => state.channels.length);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const detailedStats = await cacheManager.getDetailedStats();
      setStats(detailedStats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleClearAll = async () => {
    setIsClearing('all');
    try {
      await cacheManager.clearAll();
      useChannelStore.getState().reset();
      toast.success('All cache cleared', {
        description: 'Playlists will be re-downloaded on next load',
      });
      await loadStats();
    } catch (error) {
      toast.error('Failed to clear cache');
    }
    setIsClearing(null);
  };

  const handleClearType = async (type: 'channels' | 'epg' | 'logos') => {
    setIsClearing(type);
    try {
      await cacheManager.clearByType(type);
      if (type === 'channels') {
        useChannelStore.getState().reset();
      }
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} cache cleared`);
      await loadStats();
    } catch (error) {
      toast.error(`Failed to clear ${type} cache`);
    }
    setIsClearing(null);
  };

  const handleForceRefresh = async () => {
    if (providers.length === 0) {
      toast.error('No providers configured');
      return;
    }

    setIsRefreshing(true);
    toast.info('Refreshing playlists...', { duration: 2000 });

    try {
      // Clear channel cache first
      await cacheManager.clearByType('channels');
      useChannelStore.getState().reset();

      // Reload all providers
      for (const provider of providers) {
        if (!provider.is_active) continue;

        if (provider.type === 'xtream' && provider.xtream_host && provider.xtream_user && provider.xtream_pass_encrypted) {
          await playlistService.loadXtreamPlaylist(
            provider.xtream_host,
            provider.xtream_user,
            provider.xtream_pass_encrypted,
            provider.id
          );
        } else if (provider.m3u_url) {
          await playlistService.loadM3UPlaylist(provider.m3u_url, provider.id, true);
        }
      }

      toast.success('Playlists refreshed', {
        description: `${storeChannelCount} channels loaded`,
      });
      await loadStats();
    } catch (error) {
      toast.error('Failed to refresh playlists');
    }
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <Card variant="glass">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hitRatio = cacheHitStats.hitRatio * 100;

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Cache Storage
              </CardTitle>
              <CardDescription>
                Cached data for faster loading
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {formatBytes(stats?.total.estimatedSize || 0)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Storage breakdown */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Channels */}
            <div className="p-4 rounded-xl bg-muted/50 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tv className="w-4 h-4" />
                Channels
              </div>
              <div className="text-2xl font-bold">
                {stats?.channels.count.toLocaleString() || 0}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{stats?.channels.providers || 0} providers</span>
                <span>{formatBytes(stats?.channels.estimatedSize || 0)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => handleClearType('channels')}
                disabled={isClearing === 'channels'}
              >
                {isClearing === 'channels' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Clear
              </Button>
            </div>

            {/* EPG */}
            <div className="p-4 rounded-xl bg-muted/50 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                EPG Programs
              </div>
              <div className="text-2xl font-bold">
                {stats?.epg.count.toLocaleString() || 0}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{stats?.epg.days || 0} days cached</span>
                <span>{formatBytes(stats?.epg.estimatedSize || 0)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => handleClearType('epg')}
                disabled={isClearing === 'epg'}
              >
                {isClearing === 'epg' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Clear
              </Button>
            </div>

            {/* Logos */}
            <div className="p-4 rounded-xl bg-muted/50 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Image className="w-4 h-4" />
                Channel Logos
              </div>
              <div className="text-2xl font-bold">
                {stats?.logos.count.toLocaleString() || 0}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>images</span>
                <span>{formatBytes(stats?.logos.estimatedSize || 0)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => handleClearType('logos')}
                disabled={isClearing === 'logos'}
              >
                {isClearing === 'logos' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Performance */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Cache Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Hit Ratio</span>
            <span className={cn(
              "font-medium",
              hitRatio >= 80 ? "text-green-500" :
              hitRatio >= 50 ? "text-yellow-500" : "text-red-500"
            )}>
              {hitRatio.toFixed(0)}%
            </span>
          </div>
          <Progress value={hitRatio} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              {cacheHitStats.hits} hits
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-muted-foreground" />
              {cacheHitStats.misses} misses
            </span>
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Channels updated</p>
                <p className="text-xs text-muted-foreground">
                  {formatTimeAgo(stats?.lastUpdated.channels)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">EPG updated</p>
                <p className="text-xs text-muted-foreground">
                  {formatTimeAgo(stats?.lastUpdated.epg)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleForceRefresh}
            disabled={isRefreshing || providers.length === 0}
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Force Refresh All Playlists
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full justify-start gap-2"
                disabled={isClearing !== null}
              >
                <Trash2 className="w-4 h-4" />
                Clear All Cache
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all cached data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all cached channels, EPG data, and logos.
                  Playlists will need to be re-downloaded on next app load.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll}>
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <p className="text-xs text-muted-foreground text-center pt-2">
            Cache helps the app start faster by avoiding re-parsing playlists
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default CacheManagement;
