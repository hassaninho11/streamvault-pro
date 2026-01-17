/**
 * Playlist Worker - Parses M3U playlists off the main thread
 * Handles 10k+ channels without blocking UI
 */

import { parseM3U } from '../core/parser/m3uParser';
import { buildChannelIndex } from '../core/indexing/channelIndex';
import type { WorkerMessage, WorkerResponse, ParsePlaylistRequest, ParsePlaylistResponse } from '../core/types';

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
    
    // Parse M3U content
    const parsed = parseM3U(payload.content);
    const parseMs = performance.now() - parseStart;
    
    const indexStart = performance.now();
    
    // Build channel index
    const { channels, index } = buildChannelIndex(parsed.items, payload.providerId);
    const indexMs = performance.now() - indexStart;
    
    // Serialize Maps for transfer
    const response: WorkerResponse<ParsePlaylistResponse> = {
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
