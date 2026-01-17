import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ProxyRequest {
  url: string;
  type?: 'test' | 'fetch';
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
    const { url, type = 'fetch' }: ProxyRequest = await req.json();

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

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      console.error('[playlist-proxy] Invalid protocol:', parsedUrl.protocol);
      return new Response(
        JSON.stringify({ error: 'Only HTTP/HTTPS URLs are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the playlist
    const fetchStart = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/x-mpegURL, audio/mpegurl, audio/x-mpegurl, text/plain, */*',
        'User-Agent': 'StreamVault/1.0',
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

    // Validate that it looks like M3U content
    const isM3U = content.includes('#EXTM3U') || content.includes('#EXTINF');
    const isMpegUrl = contentType.includes('mpegurl') || contentType.includes('m3u');

    if (type === 'test') {
      // For test requests, return metadata
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

    // For fetch requests, return the full content
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

  } catch (error) {
    console.error('[playlist-proxy] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for common network errors
    if (errorMessage.includes('error sending request') || errorMessage.includes('connection')) {
      return new Response(
        JSON.stringify({ error: 'Could not connect to the playlist server. Check the URL and try again.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
