/**
 * MediaPreflight - Pre-playback analysis for container format detection
 * Identifies MKV and other container formats before attempting playback
 */

import { detectPlatform, Platform } from './PlaybackPreflight';

// ============= Container Types =============

export type ContainerFormat = 
  | 'mkv'     // Matroska
  | 'avi'     // Audio Video Interleave
  | 'wmv'     // Windows Media Video
  | 'flv'     // Flash Video
  | 'webm'    // WebM (MKV-based, but browser-supported)
  | 'mp4'     // MP4/M4V
  | 'mov'     // QuickTime
  | 'ts'      // MPEG Transport Stream
  | 'm3u8'    // HLS manifest
  | 'mpd'     // DASH manifest
  | 'unknown';

export type MkvPlayerPreference = 'auto' | 'native' | 'vlc';

export interface MediaInfo {
  container: ContainerFormat;
  url: string;
  isSeekable: boolean | 'unknown';
  isBrowserPlayable: boolean;
  requiresTransmux: boolean;
  contentType?: string;
  fileSize?: number;
}

export interface MkvPreflightResult {
  mediaInfo: MediaInfo;
  platform: Platform;
  recommendedEngine: string;
  fallbackEngines: string[];
  canPlayInBrowser: boolean;
  requiresExternalPlayer: boolean;
  message?: string;
}

// ============= Container Detection =============

const CONTAINER_EXTENSIONS: Record<string, ContainerFormat> = {
  '.mkv': 'mkv',
  '.avi': 'avi',
  '.wmv': 'wmv',
  '.flv': 'flv',
  '.webm': 'webm',
  '.mp4': 'mp4',
  '.m4v': 'mp4',
  '.mov': 'mov',
  '.ts': 'ts',
  '.m3u8': 'm3u8',
  '.mpd': 'mpd',
};

const CONTENT_TYPE_CONTAINERS: Record<string, ContainerFormat> = {
  'video/x-matroska': 'mkv',
  'video/x-msvideo': 'avi',
  'video/x-ms-wmv': 'wmv',
  'video/x-flv': 'flv',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/mp2t': 'ts',
  'application/vnd.apple.mpegurl': 'm3u8',
  'application/x-mpegurl': 'm3u8',
  'application/dash+xml': 'mpd',
};

// Containers that browsers can play natively
const BROWSER_PLAYABLE_CONTAINERS: ContainerFormat[] = [
  'mp4',
  'webm',
  'mov', // Safari
  'm3u8', // Via HLS.js or native
  'mpd', // Via DASH player
];

// Containers that require special handling on web
const REQUIRES_TRANSMUX_ON_WEB: ContainerFormat[] = [
  'mkv',
  'avi',
  'wmv',
  'flv',
  'ts', // Unless via HLS
];

/**
 * Detect container format from URL
 */
export function detectContainerFromUrl(url: string): ContainerFormat {
  const lowerUrl = url.toLowerCase();
  
  // Check URL path for extension
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    for (const [ext, format] of Object.entries(CONTAINER_EXTENSIONS)) {
      if (pathname.endsWith(ext)) {
        return format;
      }
    }
  } catch {
    // Invalid URL, check raw string
    for (const [ext, format] of Object.entries(CONTAINER_EXTENSIONS)) {
      if (lowerUrl.includes(ext)) {
        return format;
      }
    }
  }
  
  // Check for Xtream-style URLs (usually HLS)
  if (/\/(live|series|movie)\/[^/]+\/[^/]+\/\d+(\?|$)/.test(url)) {
    return 'm3u8'; // Xtream without extension is typically HLS
  }
  
  return 'unknown';
}

/**
 * Detect container format from content-type header
 */
export function detectContainerFromContentType(contentType: string): ContainerFormat {
  const lowerType = contentType.toLowerCase().split(';')[0].trim();
  
  for (const [type, format] of Object.entries(CONTENT_TYPE_CONTAINERS)) {
    if (lowerType === type) {
      return format;
    }
  }
  
  // Partial matches
  if (lowerType.includes('matroska')) return 'mkv';
  if (lowerType.includes('webm')) return 'webm';
  if (lowerType.includes('mp4')) return 'mp4';
  if (lowerType.includes('mpegurl') || lowerType.includes('m3u')) return 'm3u8';
  
  return 'unknown';
}

/**
 * Check if a container is browser-playable
 */
export function isBrowserPlayable(container: ContainerFormat, platform: Platform): boolean {
  // WebM support varies
  if (container === 'webm') {
    // Safari has limited WebM support
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('safari') && !ua.includes('chrome')) {
      return false;
    }
  }
  
  // MOV mainly on Safari
  if (container === 'mov') {
    return platform === 'ios' || navigator.userAgent.toLowerCase().includes('safari');
  }
  
  return BROWSER_PLAYABLE_CONTAINERS.includes(container);
}

/**
 * Check if container requires transmuxing on web
 */
export function requiresTransmuxOnWeb(container: ContainerFormat): boolean {
  return REQUIRES_TRANSMUX_ON_WEB.includes(container);
}

/**
 * Perform preflight check for a media URL
 * Returns container info and recommended playback strategy
 */
export async function performMediaPreflight(
  url: string,
  options: {
    checkContentType?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<MkvPreflightResult> {
  const platform = detectPlatform();
  
  // First, detect from URL
  let container = detectContainerFromUrl(url);
  let contentType: string | undefined;
  
  // Optionally verify with HEAD request
  if (options.checkContentType && container === 'unknown') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 3000);
      
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);
      
      contentType = response.headers.get('content-type') || undefined;
      if (contentType) {
        const detectedFromType = detectContainerFromContentType(contentType);
        if (detectedFromType !== 'unknown') {
          container = detectedFromType;
        }
      }
    } catch (error) {
      console.log('[MediaPreflight] HEAD request failed, using URL detection only');
    }
  }
  
  const mediaInfo: MediaInfo = {
    container,
    url,
    isSeekable: 'unknown',
    isBrowserPlayable: isBrowserPlayable(container, platform),
    requiresTransmux: requiresTransmuxOnWeb(container),
    contentType,
  };
  
  // Determine engine strategy based on platform and container
  const strategy = getEngineStrategy(mediaInfo, platform);
  
  return {
    mediaInfo,
    platform,
    ...strategy,
  };
}

/**
 * Synchronous preflight (uses URL detection only)
 */
export function performMediaPreflightSync(url: string): MkvPreflightResult {
  const platform = detectPlatform();
  const container = detectContainerFromUrl(url);
  
  const mediaInfo: MediaInfo = {
    container,
    url,
    isSeekable: 'unknown',
    isBrowserPlayable: isBrowserPlayable(container, platform),
    requiresTransmux: requiresTransmuxOnWeb(container),
  };
  
  const strategy = getEngineStrategy(mediaInfo, platform);
  
  return {
    mediaInfo,
    platform,
    ...strategy,
  };
}

/**
 * Determine the best engine strategy for a given media and platform
 */
function getEngineStrategy(
  mediaInfo: MediaInfo,
  platform: Platform
): {
  recommendedEngine: string;
  fallbackEngines: string[];
  canPlayInBrowser: boolean;
  requiresExternalPlayer: boolean;
  message?: string;
} {
  const { container, isBrowserPlayable: browserPlayable } = mediaInfo;
  
  // MKV-specific handling
  if (container === 'mkv') {
    return getMkvStrategy(platform);
  }
  
  // AVI, WMV, FLV
  if (['avi', 'wmv', 'flv'].includes(container)) {
    return getLegacyContainerStrategy(platform, container);
  }
  
  // Browser-playable formats
  if (browserPlayable) {
    return {
      recommendedEngine: platform === 'web' ? 'html5' : 'native',
      fallbackEngines: [],
      canPlayInBrowser: true,
      requiresExternalPlayer: false,
    };
  }
  
  // Unknown format - try native first
  return {
    recommendedEngine: 'html5',
    fallbackEngines: ['vlc'],
    canPlayInBrowser: false,
    requiresExternalPlayer: true,
    message: 'Unknown format - may require external player',
  };
}

/**
 * MKV-specific strategy per platform
 */
function getMkvStrategy(platform: Platform): {
  recommendedEngine: string;
  fallbackEngines: string[];
  canPlayInBrowser: boolean;
  requiresExternalPlayer: boolean;
  message?: string;
} {
  switch (platform) {
    case 'android':
      // Android: ExoPlayer handles MKV well, VLC as fallback
      return {
        recommendedEngine: 'exo',
        fallbackEngines: ['vlc'],
        canPlayInBrowser: false,
        requiresExternalPlayer: false,
        message: 'Using ExoPlayer for MKV',
      };
      
    case 'ios':
      // iOS: AVPlayer has limited MKV support, VLC recommended
      return {
        recommendedEngine: 'vlc',
        fallbackEngines: ['av'],
        canPlayInBrowser: false,
        requiresExternalPlayer: false,
        message: 'Using VLC for MKV on iOS',
      };
      
    case 'electron':
      // Electron: Can use native video with some codecs, or VLC
      return {
        recommendedEngine: 'html5',
        fallbackEngines: ['vlc'],
        canPlayInBrowser: true, // Electron has relaxed security
        requiresExternalPlayer: false,
      };
      
    case 'tizen':
    case 'webos':
      // Smart TVs: May have native MKV support
      return {
        recommendedEngine: 'native',
        fallbackEngines: [],
        canPlayInBrowser: true,
        requiresExternalPlayer: false,
      };
      
    case 'web':
    default:
      // Web: Cannot play MKV, requires external player
      return {
        recommendedEngine: 'external',
        fallbackEngines: [],
        canPlayInBrowser: false,
        requiresExternalPlayer: true,
        message: 'MKV requires external player on web',
      };
  }
}

/**
 * Strategy for legacy containers (AVI, WMV, FLV)
 */
function getLegacyContainerStrategy(
  platform: Platform,
  container: ContainerFormat
): {
  recommendedEngine: string;
  fallbackEngines: string[];
  canPlayInBrowser: boolean;
  requiresExternalPlayer: boolean;
  message?: string;
} {
  const containerName = container.toUpperCase();
  
  switch (platform) {
    case 'android':
      return {
        recommendedEngine: 'vlc',
        fallbackEngines: ['exo'],
        canPlayInBrowser: false,
        requiresExternalPlayer: false,
        message: `Using VLC for ${containerName}`,
      };
      
    case 'ios':
      return {
        recommendedEngine: 'vlc',
        fallbackEngines: [],
        canPlayInBrowser: false,
        requiresExternalPlayer: false,
        message: `Using VLC for ${containerName}`,
      };
      
    default:
      return {
        recommendedEngine: 'external',
        fallbackEngines: [],
        canPlayInBrowser: false,
        requiresExternalPlayer: true,
        message: `${containerName} requires external player`,
      };
  }
}

/**
 * Get user-friendly message for unsupported container
 */
export function getContainerErrorMessage(container: ContainerFormat, platform: Platform): {
  title: string;
  message: string;
  suggestion: string;
} {
  const containerName = container.toUpperCase();
  
  if (platform === 'web') {
    return {
      title: `${containerName}-format stöds ej`,
      message: `Webbläsare kan inte spela ${containerName}-filer direkt.`,
      suggestion: 'Använd en extern mediaspelare som VLC eller MX Player.',
    };
  }
  
  if (platform === 'android') {
    return {
      title: 'Byter till kompatibelt läge',
      message: `Använder VLC för att spela ${containerName}.`,
      suggestion: 'Du kan ändra standardspelare i inställningarna.',
    };
  }
  
  if (platform === 'ios') {
    return {
      title: 'Optimerar video',
      message: `Förbereder ${containerName} för uppspelning.`,
      suggestion: 'Detta kan ta en stund första gången.',
    };
  }
  
  return {
    title: 'Format stöds ej',
    message: `Kunde inte spela ${containerName}-filen.`,
    suggestion: 'Försök med en extern mediaspelare.',
  };
}

/**
 * Check if format is MKV (or related unsupported container)
 */
export function isUnsupportedContainer(url: string): boolean {
  const container = detectContainerFromUrl(url);
  return ['mkv', 'avi', 'wmv', 'flv'].includes(container);
}

/**
 * Check specifically for MKV
 */
export function isMkvUrl(url: string): boolean {
  return detectContainerFromUrl(url) === 'mkv';
}
