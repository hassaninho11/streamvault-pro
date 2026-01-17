import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, accept-encoding',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Accept-Ranges',
};

// Common user agents that IPTV providers accept
const USER_AGENTS = [
  'VLC/3.0.20 LibVLC/3.0.20',
  'Lavf/60.3.100',
  'Kodi/20.2 (Windows NT 10.0; Win64; x64)',
  'ExoPlayerLib/2.19.1',
  'libmpv',
  'IPTV Smarters Pro',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
];

// SSRF Protection: Block private IP ranges
function isPrivateIp(hostname: string): boolean {
  // Check for private IP patterns
  const privatePatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^fe80:/i,
    /^fc00:/i,
    /^fd00:/i,
  ];
  
  return privatePatterns.some(pattern => pattern.test(hostname));
}

// Validate URL and check for SSRF
function validateUrl(urlString: string): URL | null {
  try {
    const url = new URL(urlString);
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      console.error('[stream-proxy] Invalid protocol:', url.protocol);
      return null;
    }
    
    // Block private IPs
    if (isPrivateIp(url.hostname)) {
      console.error('[stream-proxy] Blocked private IP:', url.hostname);
      return null;
    }
    
    return url;
  } catch {
    return null;
  }
}

// Hash URL for logging (never log full URLs)
function hashUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname.substring(0, 30)}...`;
  } catch {
    return url.substring(0, 30) + '...';
  }
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const proxyOrigin = url.origin;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow both GET and POST
  if (!['GET', 'POST', 'HEAD'].includes(req.method)) {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get the stream URL from query parameter
  const streamUrl = url.searchParams.get('url');
  
  if (!streamUrl) {
    return new Response(
      JSON.stringify({ error: 'Stream URL is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate URL and check for SSRF
  const parsedUrl = validateUrl(streamUrl);
  if (!parsedUrl) {
    return new Response(
      JSON.stringify({ error: 'Invalid or blocked URL' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log(`[stream-proxy] Proxying: ${hashUrl(streamUrl)}`);

    // Pick a random user agent to mimic real players
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    
    // Build headers that mimic a real media player
    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity', // Don't request compressed for streams
      'Connection': 'keep-alive',
      'Referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
      'Origin': `${parsedUrl.protocol}//${parsedUrl.host}`,
    };

    // Forward range header for seeking support
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    // Fetch the stream with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    let response: Response;
    try {
      response = await fetch(streamUrl, {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle various response codes
    const isSuccess = response.ok || response.status === 206;
    
    if (!isSuccess) {
      // Check if there's actually content despite the error code
      const contentLength = response.headers.get('content-length');
      const hasContent = contentLength && parseInt(contentLength) > 0;
      
      if (!hasContent) {
        console.error(`[stream-proxy] Upstream error: ${response.status}`);
        
        // Try alternative user agent
        console.log(`[stream-proxy] Retrying with alternate user agent...`);
        
        const retryResponse = await fetch(streamUrl, {
          method: req.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: {
            ...headers,
            'User-Agent': 'IPTV Smarters Pro',
          },
          redirect: 'follow',
        });
        
        if (!retryResponse.ok && retryResponse.status !== 206) {
          console.error(`[stream-proxy] Retry also failed: ${retryResponse.status}`);
          return new Response(
            JSON.stringify({ 
              error: `Stream server returned ${response.status}`,
              hint: 'The stream provider may be blocking proxy requests or the stream may be unavailable.'
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        response = retryResponse;
      }
    }

    // Get content type from response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges');

    // Build response headers
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };

    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange;
    }
    if (acceptRanges) {
      responseHeaders['Accept-Ranges'] = acceptRanges;
    }

    // Detect content type
    const lowerContentType = contentType.toLowerCase();
    const lowerUrl = streamUrl.toLowerCase();
    
    // Check if this is an HLS manifest
    const isM3u8 = 
      lowerContentType.includes('mpegurl') || 
      lowerContentType.includes('m3u') ||
      lowerUrl.includes('.m3u8') ||
      lowerUrl.endsWith('.m3u');

    // For HLS manifests, we need to rewrite URLs
    if (isM3u8) {
      let text = await response.text();
      
      // Handle potential gzip
      if (!text || text.length === 0) {
        console.warn('[stream-proxy] Empty M3U8 response');
        return new Response(
          JSON.stringify({ error: 'Empty playlist received' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const rewrittenContent = rewriteM3U8Urls(text, streamUrl, proxyOrigin);
      
      return new Response(rewrittenContent, {
        status: response.status === 206 ? 206 : 200,
        headers: {
          ...responseHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Length': new TextEncoder().encode(rewrittenContent).length.toString(),
        },
      });
    }

    // For binary content (TS segments, etc), stream directly
    return new Response(response.body, {
      status: response.status === 206 ? 206 : 200,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('[stream-proxy] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'Stream request timed out' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Rewrites URLs in M3U8 content to go through the proxy
 * Handles: segments, variant playlists, EXT-X-KEY, EXT-X-MAP, EXT-X-I-FRAME-STREAM-INF
 */
function rewriteM3U8Urls(content: string, originalUrl: string, proxyOrigin: string): string {
  const baseUrl = new URL(originalUrl);
  const proxyBase = `${proxyOrigin}/functions/v1/stream-proxy?url=`;
  
  const lines = content.split('\n');
  const rewrittenLines = lines.map(line => {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) {
      return line;
    }
    
    // Handle tags with URI= attribute
    if (trimmedLine.includes('URI=')) {
      return rewriteUriInLine(trimmedLine, baseUrl, proxyBase);
    }
    
    // Handle EXT-X-MAP with URI
    if (trimmedLine.startsWith('#EXT-X-MAP:')) {
      return rewriteUriInLine(trimmedLine, baseUrl, proxyBase);
    }
    
    // Handle EXT-X-I-FRAME-STREAM-INF with URI
    if (trimmedLine.startsWith('#EXT-X-I-FRAME-STREAM-INF:')) {
      return rewriteUriInLine(trimmedLine, baseUrl, proxyBase);
    }
    
    // Handle EXT-X-STREAM-INF (next line is the URL)
    // We don't modify the tag itself, just let the URL line be handled below
    if (trimmedLine.startsWith('#EXT-X-STREAM-INF:')) {
      return line;
    }
    
    // Handle actual URLs (not comments/tags)
    if (!trimmedLine.startsWith('#')) {
      const absoluteUrl = resolveUrl(trimmedLine, baseUrl);
      return proxyBase + encodeURIComponent(absoluteUrl);
    }
    
    return line;
  });
  
  return rewrittenLines.join('\n');
}

/**
 * Rewrites URI= attributes in lines like EXT-X-KEY, EXT-X-MAP
 */
function rewriteUriInLine(line: string, baseUrl: URL, proxyBase: string): string {
  // Handle both URI="..." and URI=...
  return line.replace(/URI="([^"]+)"/gi, (_match, uri) => {
    const absoluteUrl = resolveUrl(uri, baseUrl);
    return `URI="${proxyBase}${encodeURIComponent(absoluteUrl)}"`;
  }).replace(/URI=([^,\s"]+)/gi, (_match, uri) => {
    // Handle unquoted URIs
    if (uri.startsWith('"')) return _match; // Already handled above
    const absoluteUrl = resolveUrl(uri, baseUrl);
    return `URI="${proxyBase}${encodeURIComponent(absoluteUrl)}"`;
  });
}

/**
 * Resolves a potentially relative URL to an absolute URL
 */
function resolveUrl(urlStr: string, baseUrl: URL): string {
  // Already absolute
  if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
    return urlStr;
  }
  
  // Protocol-relative
  if (urlStr.startsWith('//')) {
    return baseUrl.protocol + urlStr;
  }
  
  // Absolute path
  if (urlStr.startsWith('/')) {
    return `${baseUrl.protocol}//${baseUrl.host}${urlStr}`;
  }
  
  // Relative path - resolve against base URL directory
  const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
  return `${baseUrl.protocol}//${baseUrl.host}${basePath}${urlStr}`;
}
