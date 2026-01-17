/**
 * EPG Worker - Parses XMLTV EPG data off the main thread
 * Handles large EPG files without blocking UI
 */

import { parseXMLTV, mapEpgToChannels, buildEpgIndex } from '../core/parser/epgParser';
import type { WorkerMessage, WorkerResponse, ParseEpgRequest, ParseEpgResponse } from '../core/types';

self.onmessage = (event: MessageEvent<WorkerMessage<ParseEpgRequest>>) => {
  const { type, payload, requestId } = event.data;
  
  if (type !== 'PARSE_EPG') {
    self.postMessage({
      type: 'ERROR',
      requestId,
      error: `Unknown message type: ${type}`,
    });
    return;
  }
  
  try {
    const parseStart = performance.now();
    
    // Parse XMLTV
    const { programs: rawPrograms, parseTimeMs } = parseXMLTV(payload.content);
    
    // Map to channels
    const channelMapping = new Map(payload.channelMapping);
    const programs = mapEpgToChannels(rawPrograms, channelMapping);
    
    const parseMs = performance.now() - parseStart;
    
    const indexStart = performance.now();
    
    // Build index
    const byChannelId = buildEpgIndex(programs);
    const indexMs = performance.now() - indexStart;
    
    const response: WorkerResponse<ParseEpgResponse> = {
      type: 'EPG_PARSED',
      requestId,
      payload: {
        programs,
        byChannelId: Array.from(byChannelId.entries()),
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
