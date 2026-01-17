import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ProxyRequestType = 'test' | 'fetch' | 'epg' | 'xtream_live' | 'xtream_vod' | 'xtream_series';

interface ProxyRequest {
  url: string;
  type?: ProxyRequestType;
  // Xtream specific
  host?: string;
  username?: string;
  password?: string;
  action?: string;
}

// Helper function to perform fetch with retries
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[playlist-proxy] Fetch attempt ${attempt}/${maxRetries} for: ${url.substring(0, 80)}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[playlist-proxy] Attempt ${attempt} failed:`, lastError.message);
      
      // If it's a DNS error, wait a bit before retrying
      if (lastError.message.includes('dns error') || lastError.message.includes('lookup')) {
        console.log(`[playlist-proxy] DNS error detected, waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else if (lastError.name === 'AbortError') {
        console.log(`[playlist-proxy] Request timed out`);
        // Don't retry on timeout
        break;
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch after retries');
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: ProxyRequest = await req.json();
    const { type = 'fetch' } = body;

    console.log(`[playlist-proxy] Request type: ${type}`);

    // Handle Xtream API requests
    if (type === 'xtream_live' || type === 'xtream_vod' || type === 'xtream_series') {
      return await handleXtreamRequest(body, type);
    }

    // Handle EPG requests
    if (type === 'epg') {
      return await handleEpgRequest(body);
    }

    // Handle M3U requests (test/fetch)
    return await handleM3URequest(body, type);

  } catch (error) {
    console.error('[playlist-proxy] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide more specific error messages
    if (errorMessage.includes('dns error') || errorMessage.includes('lookup')) {
      return new Response(
        JSON.stringify({ 
          error: 'DNS resolution failed. The server address could not be found. Please check the URL or try again later.',
          details: 'The playlist server hostname could not be resolved. This may be a temporary network issue or an invalid server address.'
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (errorMessage.includes('AbortError') || errorMessage.includes('timeout')) {
      return new Response(
        JSON.stringify({ 
          error: 'Connection timed out. The server took too long to respond.',
          details: 'The playlist server did not respond within the timeout period. Try again later.'
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (errorMessage.includes('error sending request') || errorMessage.includes('connection')) {
      return new Response(
        JSON.stringify({ 
          error: 'Could not connect to the server. Check the URL and try again.',
          details: errorMessage
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleM3URequest(body: ProxyRequest, type: string) {
  const { url } = body;
  
  if (!url) {
    console.error('[playlist-proxy] Missing URL in request');
    return new Response(
      JSON.stringify({ error: 'URL is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[playlist-proxy] ${type} request for: ${url.substring(0, 100)}...`);

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    console.error('[playlist-proxy] Invalid URL format:', url);
    return new Response(
      JSON.stringify({ error: 'Invalid URL format' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    console.error('[playlist-proxy] Invalid protocol:', parsedUrl.protocol);
    return new Response(
      JSON.stringify({ error: 'Only HTTP/HTTPS URLs are allowed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const fetchStart = Date.now();
  
  // Use realistic user agents that IPTV providers expect
  const userAgents = [
    'VLC/3.0.18 LibVLC/3.0.18',
    'Lavf/60.3.100',
    'okhttp/4.9.3',
    'Dalvik/2.1.0 (Linux; U; Android 12)',
    'ExoPlayerLib/2.18.1',
  ];
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/x-mpegURL, audio/mpegurl, audio/x-mpegurl, text/plain, */*',
      'User-Agent': randomUserAgent,
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
    },
  });

  const fetchDuration = Date.now() - fetchStart;
  console.log(`[playlist-proxy] Fetch completed in ${fetchDuration}ms, status: ${response.status}`);

  if (!response.ok) {
    console.error('[playlist-proxy] Upstream error:', response.status, response.statusText);
    return new Response(
      JSON.stringify({ 
        error: `Upstream server returned ${response.status}: ${response.statusText}`,
        status: response.status
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const content = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const isM3U = content.includes('#EXTM3U') || content.includes('#EXTINF');
  const isMpegUrl = contentType.includes('mpegurl') || contentType.includes('m3u');

  if (type === 'test') {
    const channelMatches = content.match(/#EXTINF/g);
    const channelCount = channelMatches?.length || 0;

    console.log(`[playlist-proxy] Test complete - isM3U: ${isM3U}, channels: ${channelCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        isValidPlaylist: isM3U || isMpegUrl,
        channelCount,
        contentType,
        contentLength: content.length,
        fetchDuration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[playlist-proxy] Returning ${content.length} bytes of playlist data`);

  return new Response(
    JSON.stringify({
      success: true,
      content,
      isValidPlaylist: isM3U || isMpegUrl,
      contentType,
      fetchDuration,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleEpgRequest(body: ProxyRequest) {
  const { url } = body;
  
  if (!url) {
    return new Response(
      JSON.stringify({ error: 'EPG URL is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[playlist-proxy] EPG request for: ${url.substring(0, 100)}...`);

  const fetchStart = Date.now();
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/xml, text/xml, application/gzip, */*',
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
    },
  });

  const fetchDuration = Date.now() - fetchStart;
  console.log(`[playlist-proxy] EPG fetch completed in ${fetchDuration}ms, status: ${response.status}`);

  if (!response.ok) {
    return new Response(
      JSON.stringify({ 
        error: `EPG server returned ${response.status}: ${response.statusText}` 
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if content is gzipped
  const contentType = response.headers.get('content-type') || '';
  const contentEncoding = response.headers.get('content-encoding') || '';
  
  let content: string;
  
  if (contentEncoding.includes('gzip') || url.endsWith('.gz')) {
    // Decompress gzip content
    const buffer = await response.arrayBuffer();
    const decompressed = new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip')));
    content = await decompressed.text();
  } else {
    content = await response.text();
  }

  const isXmlTv = content.includes('<tv') || content.includes('<programme');
  console.log(`[playlist-proxy] EPG content size: ${content.length}, isXmlTv: ${isXmlTv}`);

  return new Response(
    JSON.stringify({
      success: true,
      content,
      isValidEpg: isXmlTv,
      fetchDuration,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleXtreamRequest(body: ProxyRequest, type: ProxyRequestType) {
  const { host, username, password, action } = body;
  
  if (!host || !username || !password) {
    return new Response(
      JSON.stringify({ error: 'Xtream credentials are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const cleanHost = host.replace(/\/+$/, '');
  
  // Build Xtream API URL based on type
  let apiUrl: string;
  
  switch (type) {
    case 'xtream_live':
      apiUrl = `${cleanHost}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;
      break;
    case 'xtream_vod':
      apiUrl = `${cleanHost}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_streams`;
      break;
    case 'xtream_series':
      apiUrl = `${cleanHost}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series`;
      break;
    default:
      // Generic action
      apiUrl = `${cleanHost}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}${action ? `&action=${action}` : ''}`;
  }

  console.log(`[playlist-proxy] Xtream ${type} request to: ${cleanHost}`);

  const fetchStart = Date.now();
  const response = await fetchWithRetry(apiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json, */*',
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
    },
  });

  const fetchDuration = Date.now() - fetchStart;
  console.log(`[playlist-proxy] Xtream fetch completed in ${fetchDuration}ms, status: ${response.status}`);

  if (!response.ok) {
    return new Response(
      JSON.stringify({ 
        error: `Xtream server returned ${response.status}: ${response.statusText}` 
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const data = await response.json();
  
  // Check for Xtream error response
  if (data.user_info?.status === 'Disabled' || data.user_info?.auth === 0) {
    return new Response(
      JSON.stringify({ error: 'Invalid Xtream credentials or account disabled' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[playlist-proxy] Xtream ${type} returned ${Array.isArray(data) ? data.length : 'object'} items`);

  return new Response(
    JSON.stringify({
      success: true,
      data,
      fetchDuration,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
