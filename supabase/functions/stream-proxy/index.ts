import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
};

// Common user agents that IPTV providers accept
const USER_AGENTS = [
  'VLC/3.0.20 LibVLC/3.0.20',
  'Lavf/60.3.100',
  'Kodi/20.2 (Windows NT 10.0; Win64; x64)',
  'ExoPlayerLib/2.19.1',
  'libmpv',
];

serve(async (req: Request) => {
  const url = new URL(req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get the stream URL from query parameter
  const streamUrl = url.searchParams.get('url');
  
  if (!streamUrl) {
    return new Response(
      JSON.stringify({ error: 'Stream URL is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(streamUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid stream URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return new Response(
        JSON.stringify({ error: 'Only HTTP/HTTPS URLs are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[stream-proxy] Proxying: ${streamUrl.substring(0, 100)}...`);

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
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle various response codes
    // Some IPTV providers use non-standard codes
    const isSuccess = response.ok || response.status === 206;
    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    
    // Some providers return 456 or other codes - try to still use the body if present
    if (!isSuccess && !isRedirect) {
      // Check if there's actually content despite the error code
      const contentLength = response.headers.get('content-length');
      const hasContent = contentLength && parseInt(contentLength) > 0;
      
      if (!hasContent) {
        console.error(`[stream-proxy] Upstream error: ${response.status}`);
        
        // Try alternative user agent
        const altUserAgent = 'IPTV Smarters Pro';
        console.log(`[stream-proxy] Retrying with alternate user agent...`);
        
        const retryResponse = await fetch(streamUrl, {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': altUserAgent,
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
      // If there's content despite error code, proceed anyway
    }

    // Get content type from response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');

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

    // Handle different content types
    const lowerContentType = contentType.toLowerCase();
    
    // For HLS manifests, we need to rewrite URLs
    if (lowerContentType.includes('mpegurl') || lowerContentType.includes('m3u') || streamUrl.includes('.m3u8')) {
      const text = await response.text();
      const rewrittenContent = rewriteM3U8Urls(text, streamUrl, url.origin);
      
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
 */
function rewriteM3U8Urls(content: string, originalUrl: string, proxyOrigin: string): string {
  const baseUrl = new URL(originalUrl);
  const proxyBase = `${proxyOrigin}/functions/v1/stream-proxy?url=`;
  
  const lines = content.split('\n');
  const rewrittenLines = lines.map(line => {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments (except URI in EXT-X-KEY)
    if (!trimmedLine || (trimmedLine.startsWith('#') && !trimmedLine.includes('URI='))) {
      // Handle URI= in EXT-X-KEY tags
      if (trimmedLine.includes('URI="')) {
        return rewriteUriInLine(trimmedLine, baseUrl, proxyBase);
      }
      return line;
    }
    
    // Handle actual URLs (not comments)
    if (!trimmedLine.startsWith('#')) {
      const absoluteUrl = resolveUrl(trimmedLine, baseUrl);
      return proxyBase + encodeURIComponent(absoluteUrl);
    }
    
    return line;
  });
  
  return rewrittenLines.join('\n');
}

/**
 * Rewrites URI= attributes in lines like EXT-X-KEY
 */
function rewriteUriInLine(line: string, baseUrl: URL, proxyBase: string): string {
  return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
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
