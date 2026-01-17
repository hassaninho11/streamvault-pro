/**
 * PlaybackPreflight - Detects playback issues before attempting to play
 * Handles Mixed Content (HTTP on HTTPS), platform detection, and strategy resolution
 */

export type Platform = 'web' | 'electron' | 'android' | 'ios' | 'tizen' | 'webos';

export type PlaybackStrategy = 
  | 'direct'           // Play directly in web player
  | 'proxy_https'      // Use HTTPS proxy to wrap HTTP stream
  | 'cast_chromecast'  // Cast to Chromecast device
  | 'external_player'  // Open in external app (VLC, etc.)
  | 'desktop_electron'; // Use Electron's relaxed security

export interface PreflightResult {
  canPlayDirect: boolean;
  isMixedContentBlocked: boolean;
  recommendedStrategy: PlaybackStrategy;
  availableStrategies: PlaybackStrategy[];
  diagnosticCode: string | null;
  platform: Platform;
  details: {
    isHttpStream: boolean;
    isSecurePage: boolean;
    streamProtocol: string;
    pageProtocol: string;
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
 * Perform preflight check before attempting playback
 */
export function performPreflight(options: PreflightOptions): PreflightResult {
  const platform = detectPlatform();
  const pageProtocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  
  const isHttpStream = options.streamUrl.startsWith('http://');
  const isSecurePage = pageProtocol === 'https:';
  const streamProtocol = isHttpStream ? 'http:' : 'https:';
  
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
  
  if (isMixedContentBlocked) {
    // Priority order for mixed content
    if (options.preferredStrategy && availableStrategies.includes(options.preferredStrategy)) {
      recommendedStrategy = options.preferredStrategy;
    } else if (availableStrategies.includes('proxy_https')) {
      recommendedStrategy = 'proxy_https';
    } else if (availableStrategies.includes('cast_chromecast')) {
      recommendedStrategy = 'cast_chromecast';
    } else if (platform === 'electron' && availableStrategies.includes('desktop_electron')) {
      recommendedStrategy = 'desktop_electron';
    } else {
      recommendedStrategy = 'external_player';
    }
  }
  
  return {
    canPlayDirect: !isMixedContentBlocked,
    isMixedContentBlocked,
    recommendedStrategy,
    availableStrategies,
    diagnosticCode: isMixedContentBlocked ? 'MIXED_CONTENT_HTTP_ON_HTTPS' : null,
    platform,
    details: {
      isHttpStream,
      isSecurePage,
      streamProtocol,
      pageProtocol,
    },
  };
}

/**
 * Get human-readable label for a strategy
 */
export function getStrategyLabel(strategy: PlaybackStrategy): string {
  switch (strategy) {
    case 'direct':
      return 'Direkt uppspelning';
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
