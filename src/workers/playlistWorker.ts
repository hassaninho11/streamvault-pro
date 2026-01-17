/**
 * Playlist Worker - Parses M3U playlists off the main thread
 * Handles 10k+ channels without blocking UI
 * Now separates VOD content from live channels
 */

import { parseM3UWithCategories } from '../core/parser/m3uParser';
import { buildChannelIndex } from '../core/indexing/channelIndex';
import type { WorkerMessage, WorkerResponse, ParsePlaylistRequest, ParsePlaylistResponse } from '../core/types';
import type { DetectedContent } from '../core/parser/vodDetector';

export interface ExtendedParsePlaylistResponse extends ParsePlaylistResponse {
  movies: DetectedContent[];
  series: DetectedContent[];
}

self.onmessage = (event: MessageEvent<WorkerMessage<ParsePlaylistRequest>>) => {
  const { type, payload, requestId } = event.data;
  
  if (type !== 'PARSE_PLAYLIST') {
    self.postMessage({
      type: 'ERROR',
      requestId,
      error: `Unknown message type: ${type}`,
    });
    return;
  }
  
  try {
    const parseStart = performance.now();
    
    // Parse M3U content with VOD categorization
    const parsed = parseM3UWithCategories(payload.content);
    const parseMs = performance.now() - parseStart;
    
    const indexStart = performance.now();
    
    // Build channel index only for LIVE channels (not VOD)
    const { channels, index } = buildChannelIndex(parsed.liveItems, payload.providerId);
    const indexMs = performance.now() - indexStart;
    
    console.log(`[playlistWorker] Parsed ${parsed.totalCount} items: ${channels.length} live, ${parsed.movieItems.length} movies, ${parsed.seriesItems.length} series`);
    
    // Serialize Maps for transfer
    const response: WorkerResponse<ExtendedParsePlaylistResponse> = {
      type: 'PLAYLIST_PARSED',
      requestId,
      payload: {
        channels,
        index: {
          byGroup: Array.from(index.byGroup.entries()),
          groups: index.groups,
          searchTokens: Array.from(index.searchTokens.entries()).map(
            ([key, set]) => [key, Array.from(set)]
          ),
        },
        movies: parsed.movieItems,
        series: parsed.seriesItems,
      },
      timing: { parseMs, indexMs },
    };
    
    self.postMessage(response);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
