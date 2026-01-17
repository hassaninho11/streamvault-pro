/**
 * PlaybackStrategyResolver - Resolves and executes playback strategies
 * Handles proxy, casting, and external player fallbacks
 */

import { PlaybackStrategy, PreflightResult, getStrategyLabel } from './PlaybackPreflight';
import { getCastController, CastDevice } from './CastController';
import { MediaSource } from './types';
import { toast } from 'sonner';

export interface StrategyContext {
  streamUrl: string;
  title?: string;
  posterUrl?: string;
  sourceType?: 'live' | 'vod';
  customProxyUrl?: string;
}

export interface StrategyResult {
  success: boolean;
  strategy: PlaybackStrategy;
  resolvedUrl?: string;
  error?: string;
  requiresUserAction?: boolean;
  actionType?: 'show_modal' | 'cast_picker' | 'copy_url';
}

/**
 * Build proxy URL for a stream
 */
export function buildProxyUrl(streamUrl: string, customProxyUrl?: string): string | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  if (customProxyUrl) {
    // Handle different proxy URL formats
    if (customProxyUrl.includes('?') || customProxyUrl.endsWith('=')) {
      return `${customProxyUrl}${encodeURIComponent(streamUrl)}`;
    }
    return `${customProxyUrl}?url=${encodeURIComponent(streamUrl)}`;
  }
  
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1/stream-proxy?url=${encodeURIComponent(streamUrl)}`;
  }
  
  return null;
}

/**
 * Execute the proxy strategy
 */
async function executeProxyStrategy(context: StrategyContext): Promise<StrategyResult> {
  const proxyUrl = buildProxyUrl(context.streamUrl, context.customProxyUrl);
  
  if (!proxyUrl) {
    return {
      success: false,
      strategy: 'proxy_https',
      error: 'No proxy URL available',
    };
  }
  
  console.log('[StrategyResolver] Using proxy URL:', proxyUrl.substring(0, 80) + '...');
  
  return {
    success: true,
    strategy: 'proxy_https',
    resolvedUrl: proxyUrl,
  };
}

/**
 * Execute the Chromecast strategy
 */
async function executeChromecastStrategy(context: StrategyContext): Promise<StrategyResult> {
  const castController = getCastController();
  
  if (!castController.isChromecastAvailable()) {
    return {
      success: false,
      strategy: 'cast_chromecast',
      error: 'Chromecast is not available',
      requiresUserAction: true,
      actionType: 'show_modal',
    };
  }
  
  const devices = castController.getDevices();
  const chromecastDevice = devices.find(d => d.type === 'chromecast');
  
  if (!chromecastDevice) {
    return {
      success: false,
      strategy: 'cast_chromecast',
      error: 'No Chromecast device found',
      requiresUserAction: true,
      actionType: 'show_modal',
    };
  }
  
  // Return that we need user action to pick cast device
  return {
    success: true,
    strategy: 'cast_chromecast',
    requiresUserAction: true,
    actionType: 'cast_picker',
  };
}

/**
 * Start casting to a specific device
 */
export async function startCasting(
  device: CastDevice,
  context: StrategyContext
): Promise<boolean> {
  const castController = getCastController();
  
  const source: MediaSource = {
    url: context.streamUrl,
    type: context.sourceType || 'live',
    title: context.title,
    posterUrl: context.posterUrl,
    mimeHint: 'application/x-mpegURL',
  };
  
  try {
    await castController.startCast(device, source);
    return true;
  } catch (error) {
    console.error('[StrategyResolver] Cast failed:', error);
    toast.error('Kunde inte starta casting');
    return false;
  }
}

/**
 * Execute the external player strategy
 */
async function executeExternalPlayerStrategy(context: StrategyContext): Promise<StrategyResult> {
  // External player requires user action
  return {
    success: true,
    strategy: 'external_player',
    requiresUserAction: true,
    actionType: 'show_modal',
  };
}

/**
 * Generate VLC deep link
 */
export function generateVlcLink(streamUrl: string): string {
  // VLC uses vlc:// protocol on some platforms
  return `vlc://${streamUrl}`;
}

/**
 * Generate intent URL for Android
 */
export function generateAndroidIntent(streamUrl: string, title?: string): string {
  const intent = `intent:${streamUrl}#Intent;type=video/*;`;
  const params = title ? `S.title=${encodeURIComponent(title)};` : '';
  return intent + params + 'end';
}

/**
 * Copy stream URL to clipboard
 */
export async function copyStreamUrl(streamUrl: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(streamUrl);
    toast.success('URL kopierad till urklipp');
    return true;
  } catch (error) {
    console.error('[StrategyResolver] Failed to copy URL:', error);
    toast.error('Kunde inte kopiera URL');
    return false;
  }
}

/**
 * Execute a playback strategy
 */
export async function executeStrategy(
  strategy: PlaybackStrategy,
  context: StrategyContext
): Promise<StrategyResult> {
  console.log(`[StrategyResolver] Executing strategy: ${strategy}`);
  
  switch (strategy) {
    case 'direct':
      return {
        success: true,
        strategy: 'direct',
        resolvedUrl: context.streamUrl,
      };
      
    case 'proxy_https':
      return executeProxyStrategy(context);
      
    case 'cast_chromecast':
      return executeChromecastStrategy(context);
      
    case 'external_player':
      return executeExternalPlayerStrategy(context);
      
    case 'desktop_electron':
      // In Electron, we can play directly with relaxed security
      return {
        success: true,
        strategy: 'desktop_electron',
        resolvedUrl: context.streamUrl,
      };
      
    default:
      return {
        success: false,
        strategy,
        error: `Unknown strategy: ${strategy}`,
      };
  }
}

/**
 * Try strategies in order until one succeeds
 */
export async function resolvePlayback(
  preflight: PreflightResult,
  context: StrategyContext
): Promise<StrategyResult> {
  // If we can play directly, just do it
  if (preflight.canPlayDirect) {
    return executeStrategy('direct', context);
  }
  
  // Try each available strategy in order
  for (const strategy of preflight.availableStrategies) {
    const result = await executeStrategy(strategy, context);
    
    if (result.success) {
      console.log(`[StrategyResolver] Strategy ${strategy} succeeded`);
      return result;
    }
    
    console.log(`[StrategyResolver] Strategy ${strategy} failed: ${result.error}`);
  }
  
  // All strategies failed
  return {
    success: false,
    strategy: 'direct',
    error: 'No playback strategy available',
    requiresUserAction: true,
    actionType: 'show_modal',
  };
}
