/**
 * CastPreflight - Determines if media can be cast and provides format compatibility info
 */

export type CastableFormat = 'hls' | 'mp4' | 'webm' | 'mp3' | 'aac';
export type UnsupportedFormat = 'mkv' | 'avi' | 'wmv' | 'flv' | 'ts' | 'unknown';

export interface CastPreflightResult {
  canCast: boolean;
  format: CastableFormat | UnsupportedFormat;
  mimeType: string;
  isLive: boolean;
  warnings: string[];
  recommendation?: string;
}

/**
 * Detect format from URL
 */
function detectFormatFromUrl(url: string): CastableFormat | UnsupportedFormat {
  const lowUrl = url.toLowerCase();
  const pathname = new URL(url, 'http://localhost').pathname.toLowerCase();
  
  // HLS
  if (lowUrl.includes('.m3u8') || lowUrl.includes('mpegurl')) {
    return 'hls';
  }
  
  // MP4
  if (pathname.endsWith('.mp4') || lowUrl.includes('video/mp4')) {
    return 'mp4';
  }
  
  // WebM
  if (pathname.endsWith('.webm')) {
    return 'webm';
  }
  
  // Audio
  if (pathname.endsWith('.mp3')) {
    return 'mp3';
  }
  if (pathname.endsWith('.aac') || pathname.endsWith('.m4a')) {
    return 'aac';
  }
  
  // Unsupported containers
  if (pathname.endsWith('.mkv')) {
    return 'mkv';
  }
  if (pathname.endsWith('.avi')) {
    return 'avi';
  }
  if (pathname.endsWith('.wmv')) {
    return 'wmv';
  }
  if (pathname.endsWith('.flv')) {
    return 'flv';
  }
  if (pathname.endsWith('.ts')) {
    return 'ts';
  }
  
  // Check for Xtream-style URLs without extension (usually HLS)
  if (/\/(live|movie|series)\/[^/]+\/[^/]+\/\d+$/.test(url)) {
    return 'hls';
  }
  
  return 'unknown';
}

/**
 * Get MIME type for format
 */
function getMimeType(format: CastableFormat | UnsupportedFormat): string {
  switch (format) {
    case 'hls':
      return 'application/x-mpegURL';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mp3':
      return 'audio/mp3';
    case 'aac':
      return 'audio/aac';
    case 'mkv':
      return 'video/x-matroska';
    case 'avi':
      return 'video/x-msvideo';
    case 'wmv':
      return 'video/x-ms-wmv';
    case 'flv':
      return 'video/x-flv';
    case 'ts':
      return 'video/mp2t';
    default:
      return 'video/mp4'; // Default guess
  }
}

/**
 * Check if format is natively supported by Chromecast
 */
function isChromecastSupported(format: CastableFormat | UnsupportedFormat): boolean {
  // Chromecast Default Media Receiver supports:
  // - HLS (m3u8)
  // - MP4 (H.264, AAC)
  // - WebM (VP8/VP9, Vorbis/Opus)
  // - Audio (MP3, AAC, FLAC, WAV)
  
  const supported: (CastableFormat | UnsupportedFormat)[] = ['hls', 'mp4', 'webm', 'mp3', 'aac'];
  return supported.includes(format);
}

/**
 * Check if format is supported by AirPlay
 */
function isAirPlaySupported(format: CastableFormat | UnsupportedFormat): boolean {
  // AirPlay supports:
  // - HLS
  // - MP4 (H.264, H.265/HEVC, AAC)
  // - MP3, AAC audio
  
  const supported: (CastableFormat | UnsupportedFormat)[] = ['hls', 'mp4', 'mp3', 'aac'];
  return supported.includes(format);
}

export interface CastPreflightOptions {
  url: string;
  sourceType?: 'live' | 'vod';
  targetDevice?: 'chromecast' | 'airplay' | 'any';
}

/**
 * Perform preflight check for casting
 */
export function performCastPreflight(options: CastPreflightOptions): CastPreflightResult {
  const { url, sourceType = 'vod', targetDevice = 'any' } = options;
  
  const format = detectFormatFromUrl(url);
  const mimeType = getMimeType(format);
  const isLive = sourceType === 'live';
  const warnings: string[] = [];
  let canCast = false;
  let recommendation: string | undefined;

  // Check device-specific support
  if (targetDevice === 'chromecast' || targetDevice === 'any') {
    canCast = isChromecastSupported(format);
  }
  
  if (targetDevice === 'airplay' || targetDevice === 'any') {
    canCast = canCast || isAirPlaySupported(format);
  }

  // Add warnings and recommendations
  if (!canCast) {
    switch (format) {
      case 'mkv':
        warnings.push('MKV-formatet stöds inte av Chromecast');
        recommendation = 'Prova att spela lokalt med VLC eller en extern spelare';
        break;
      case 'avi':
        warnings.push('AVI-formatet stöds inte av cast-enheter');
        recommendation = 'Konvertera filen till MP4 för bästa kompatibilitet';
        break;
      case 'wmv':
        warnings.push('WMV-formatet stöds inte av cast-enheter');
        recommendation = 'Konvertera filen till MP4 för bästa kompatibilitet';
        break;
      case 'flv':
        warnings.push('FLV-formatet stöds inte av cast-enheter');
        recommendation = 'Prova en annan källa eller spela lokalt';
        break;
      case 'ts':
        warnings.push('TS-formatet kan ha begränsat stöd');
        recommendation = 'Prova HLS-versionen om tillgänglig';
        break;
      default:
        warnings.push('Okänt format - casting kanske inte fungerar');
    }
  }

  // Add live-specific warnings
  if (isLive && format === 'hls') {
    warnings.push('Live-strömmar kan ha fördröjning vid casting');
  }

  // Check for potential issues
  if (url.startsWith('http:') && typeof window !== 'undefined' && window.location.protocol === 'https:') {
    warnings.push('HTTP-ström från HTTPS-sida kan blockeras');
    recommendation = 'Casting kan kringgå Mixed Content-begränsningar';
  }

  return {
    canCast,
    format,
    mimeType,
    isLive,
    warnings,
    recommendation,
  };
}

/**
 * Quick check if URL can be cast
 */
export function canCastUrl(url: string): boolean {
  const format = detectFormatFromUrl(url);
  return isChromecastSupported(format);
}

/**
 * Get cast-friendly MIME type for URL
 */
export function getCastMimeType(url: string): string {
  const format = detectFormatFromUrl(url);
  return getMimeType(format);
}

export default performCastPreflight;
