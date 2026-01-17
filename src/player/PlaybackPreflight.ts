/**
 * PlaybackPreflight - Detects playback issues before attempting to play
 * Handles Mixed Content (HTTP on HTTPS), platform detection, HTTPS upgrade, and strategy resolution
 */

export type Platform = 'web' | 'electron' | 'android' | 'ios' | 'tizen' | 'webos';

export type PlaybackStrategy = 
  | 'direct'           // Play directly in web player
  | 'upgraded_https'   // HTTP URL upgraded to HTTPS
  | 'proxy_https'      // Use HTTPS proxy to wrap HTTP stream
  | 'cast_chromecast'  // Cast to Chromecast device
  | 'external_player'  // Open in external app (VLC, etc.)
  | 'desktop_electron'; // Use Electron's relaxed security

export type PreflightResultCode = 
  | 'DIRECT'
  | 'UPGRADED_HTTPS'
  | 'PROXY'
  | 'INCOMPATIBLE'
  | 'MIXED_CONTENT_HTTP_ON_HTTPS';

export interface PreflightResult {
  canPlayDirect: boolean;
  isMixedContentBlocked: boolean;
  recommendedStrategy: PlaybackStrategy;
  availableStrategies: PlaybackStrategy[];
  diagnosticCode: PreflightResultCode | null;
  platform: Platform;
  resolvedUrl?: string; // URL to use (upgraded or proxy)
  details: {
    isHttpStream: boolean;
    isSecurePage: boolean;
    streamProtocol: string;
    pageProtocol: string;
    isHls: boolean;
    httpsUpgradeAttempted: boolean;
    httpsUpgradeSucceeded: boolean;
  };
}

export interface PreflightOptions {
  streamUrl: string;
  sourceType?: 'live' | 'vod';
  proxyEnabled?: boolean;
  proxyUrl?: string;
  hasChromecast?: boolean;
  hasAirPlay?: boolean;
  preferredStrategy?: PlaybackStrategy;
  skipUpgradeCheck?: boolean; // Skip HTTPS upgrade test (faster)
}

/**
 * Detect the current platform
 */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'web';
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check for Electron
  if (userAgent.includes('electron')) {
    return 'electron';
  }
  
  // Check for Tizen (Samsung Smart TV)
  if (userAgent.includes('tizen')) {
    return 'tizen';
  }
  
  // Check for webOS (LG Smart TV)
  if (userAgent.includes('webos') || userAgent.includes('web0s')) {
    return 'webos';
  }
  
  // Check for Android
  if (userAgent.includes('android')) {
    return 'android';
  }
  
  // Check for iOS
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  }
  
  return 'web';
}

/**
 * Check if mixed content is blocked on this platform
 */
function isMixedContentBlockedOnPlatform(platform: Platform): boolean {
  // These platforms enforce mixed content blocking
  return ['web', 'tizen', 'webos'].includes(platform);
}

/**
 * Check if URL appears to be HLS
 */
export function isHlsUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.includes('.m3u8') ||
    lowerUrl.includes('m3u8') ||
    /\/live\/[^/]+\/[^/]+\/\d+/.test(url) || // Xtream-style
    /\/[^/]+\/[^/]+\/\d+$/.test(url) // Xtream-style without extension
  );
}

/**
 * Attempt to upgrade HTTP URL to HTTPS and verify it works
 * Returns the HTTPS URL if successful, null otherwise
 */
export async function tryHttpsUpgrade(httpUrl: string, timeoutMs: number = 3000): Promise<string | null> {
  if (!httpUrl.startsWith('http://')) {
    return null;
  }
  
  const httpsUrl = httpUrl.replace('http://', 'https://');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(httpsUrl, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'cors',
    });
    
    clearTimeout(timeoutId);
    
    // Check if request succeeded and content-type is valid for streaming
    if (response.ok || response.status === 206) {
      const contentType = response.headers.get('content-type')?.toLowerCase() || '';
      const isValidStreamType = 
        contentType.includes('mpegurl') ||
        contentType.includes('m3u') ||
        contentType.includes('video') ||
        contentType.includes('octet-stream') ||
        contentType.includes('application/x-mpegurl');
      
      if (isValidStreamType || isHlsUrl(httpsUrl)) {
        console.log('[Preflight] HTTPS upgrade successful:', httpsUrl.substring(0, 50) + '...');
        return httpsUrl;
      }
    }
  } catch (error) {
    // HTTPS upgrade failed (timeout, CORS, SSL error, etc.)
    console.log('[Preflight] HTTPS upgrade failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  return null;
}

/**
 * Build proxy URL for a stream
 */
export function buildProxyUrl(streamUrl: string, customProxyUrl?: string): string | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  if (customProxyUrl) {
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
 * Perform preflight check before attempting playback (synchronous version)
 * Use performPreflightAsync for full HTTPS upgrade testing
 */
export function performPreflight(options: PreflightOptions): PreflightResult {
  const platform = detectPlatform();
  const pageProtocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  
  const isHttpStream = options.streamUrl.startsWith('http://');
  const isSecurePage = pageProtocol === 'https:';
  const streamProtocol = isHttpStream ? 'http:' : 'https:';
  const isHls = isHlsUrl(options.streamUrl);
  
  const isMixedContentBlocked = 
    isMixedContentBlockedOnPlatform(platform) && 
    isSecurePage && 
    isHttpStream;
  
  // Build list of available strategies
  const availableStrategies: PlaybackStrategy[] = [];
  
  // Always add direct if not blocked
  if (!isMixedContentBlocked) {
    availableStrategies.push('direct');
  }
  
  // HTTPS upgrade is always worth trying first
  if (isHttpStream) {
    availableStrategies.push('upgraded_https');
  }
  
  // Proxy is available if we have a URL
  if (options.proxyEnabled !== false && (options.proxyUrl || import.meta.env.VITE_SUPABASE_URL)) {
    availableStrategies.push('proxy_https');
  }
  
  // Chromecast
  if (options.hasChromecast) {
    availableStrategies.push('cast_chromecast');
  }
  
  // External player always available
  availableStrategies.push('external_player');
  
  // Electron special handling
  if (platform === 'electron') {
    availableStrategies.push('desktop_electron');
  }
  
  // Determine recommended strategy
  let recommendedStrategy: PlaybackStrategy = 'direct';
  let diagnosticCode: PreflightResultCode | null = null;
  
  if (isMixedContentBlocked) {
    diagnosticCode = 'MIXED_CONTENT_HTTP_ON_HTTPS';
    
    // Priority order for mixed content
    if (options.preferredStrategy && availableStrategies.includes(options.preferredStrategy)) {
      recommendedStrategy = options.preferredStrategy;
    } else if (availableStrategies.includes('upgraded_https')) {
      // Try HTTPS upgrade first
      recommendedStrategy = 'upgraded_https';
    } else if (availableStrategies.includes('proxy_https')) {
      recommendedStrategy = 'proxy_https';
    } else if (availableStrategies.includes('cast_chromecast')) {
      recommendedStrategy = 'cast_chromecast';
    } else if (platform === 'electron' && availableStrategies.includes('desktop_electron')) {
      recommendedStrategy = 'desktop_electron';
    } else {
      recommendedStrategy = 'external_player';
    }
  } else {
    diagnosticCode = 'DIRECT';
  }
  
  return {
    canPlayDirect: !isMixedContentBlocked,
    isMixedContentBlocked,
    recommendedStrategy,
    availableStrategies,
    diagnosticCode,
    platform,
    details: {
      isHttpStream,
      isSecurePage,
      streamProtocol,
      pageProtocol,
      isHls,
      httpsUpgradeAttempted: false,
      httpsUpgradeSucceeded: false,
    },
  };
}

/**
 * Perform full preflight check with async HTTPS upgrade testing
 */
export async function performPreflightAsync(options: PreflightOptions): Promise<PreflightResult> {
  const baseResult = performPreflight(options);
  
  // If not blocked or skip upgrade requested, return sync result
  if (!baseResult.isMixedContentBlocked || options.skipUpgradeCheck) {
    return baseResult;
  }
  
  // Attempt HTTPS upgrade for HTTP streams
  if (baseResult.details.isHttpStream) {
    const upgradedUrl = await tryHttpsUpgrade(options.streamUrl);
    
    baseResult.details.httpsUpgradeAttempted = true;
    
    if (upgradedUrl) {
      // HTTPS upgrade succeeded!
      baseResult.details.httpsUpgradeSucceeded = true;
      baseResult.resolvedUrl = upgradedUrl;
      baseResult.recommendedStrategy = 'upgraded_https';
      baseResult.diagnosticCode = 'UPGRADED_HTTPS';
      baseResult.canPlayDirect = true;
      baseResult.isMixedContentBlocked = false;
      
      return baseResult;
    }
    
    // HTTPS upgrade failed, fall back to proxy
    if (baseResult.availableStrategies.includes('proxy_https')) {
      baseResult.recommendedStrategy = 'proxy_https';
      baseResult.resolvedUrl = buildProxyUrl(options.streamUrl, options.proxyUrl) || undefined;
      baseResult.diagnosticCode = 'PROXY';
    }
  }
  
  return baseResult;
}

/**
 * Get human-readable label for a strategy
 */
export function getStrategyLabel(strategy: PlaybackStrategy): string {
  switch (strategy) {
    case 'direct':
      return 'Direkt uppspelning';
    case 'upgraded_https':
      return 'HTTPS (Uppgraderad)';
    case 'proxy_https':
      return 'Spela via Proxy (HTTPS)';
    case 'cast_chromecast':
      return 'Casta till TV';
    case 'external_player':
      return 'Öppna i VLC';
    case 'desktop_electron':
      return 'Desktop-läge';
    default:
      return strategy;
  }
}

/**
 * Get icon name for a strategy
 */
export function getStrategyIcon(strategy: PlaybackStrategy): string {
  switch (strategy) {
    case 'direct':
      return 'play';
    case 'upgraded_https':
      return 'lock';
    case 'proxy_https':
      return 'shield';
    case 'cast_chromecast':
      return 'cast';
    case 'external_player':
      return 'external-link';
    case 'desktop_electron':
      return 'monitor';
    default:
      return 'play';
  }
}

/**
 * Hash a URL for logging (never log full URLs with credentials)
 */
export function hashUrlForLogging(url: string): string {
  // Extract host and path without query params
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').slice(0, 3).join('/');
    return `${parsed.host}${pathParts}...`;
  } catch {
    return url.substring(0, 30) + '...';
  }
}
