/**
 * Worker Manager - Handles communication with Web Workers
 * Provides promise-based API for worker interactions
 */

import type { 
  WorkerMessage, 
  WorkerResponse, 
  ParsePlaylistRequest, 
  ParsePlaylistResponse,
  ParseEpgRequest,
  ParseEpgResponse 
} from '../core/types';
import type { DetectedContent } from '../core/parser/vodDetector';

export interface ExtendedParsePlaylistResponse extends ParsePlaylistResponse {
  movies: DetectedContent[];
  series: DetectedContent[];
}

type PendingRequest<T> = {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

class WorkerManager {
  private playlistWorker: Worker | null = null;
  private epgWorker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest<unknown>>();
  private requestIdCounter = 0;
  
  private getPlaylistWorker(): Worker {
    if (!this.playlistWorker) {
      this.playlistWorker = new Worker(
        new URL('./playlistWorker.ts', import.meta.url),
        { type: 'module' }
      );
      this.playlistWorker.onmessage = this.handleWorkerMessage.bind(this);
      this.playlistWorker.onerror = this.handleWorkerError.bind(this);
    }
    return this.playlistWorker;
  }
  
  private getEpgWorker(): Worker {
    if (!this.epgWorker) {
      this.epgWorker = new Worker(
        new URL('./epgWorker.ts', import.meta.url),
        { type: 'module' }
      );
      this.epgWorker.onmessage = this.handleWorkerMessage.bind(this);
      this.epgWorker.onerror = this.handleWorkerError.bind(this);
    }
    return this.epgWorker;
  }
  
  private handleWorkerMessage(event: MessageEvent<WorkerResponse<unknown>>) {
    const { requestId, error, payload } = event.data;
    const pending = this.pendingRequests.get(requestId);
    
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(payload);
      }
    }
  }
  
  private handleWorkerError(error: ErrorEvent) {
    console.error('[WorkerManager] Worker error:', error);
  }
  
  private sendMessage<TReq, TRes>(
    worker: Worker,
    type: string,
    payload: TReq,
    timeoutMs: number = 30000
  ): Promise<TRes> {
    return new Promise((resolve, reject) => {
      const requestId = `req-${++this.requestIdCounter}`;
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Worker request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });
      
      const message: WorkerMessage<TReq> = { type, payload, requestId };
      worker.postMessage(message);
    });
  }
  
  async parsePlaylist(
    content: string,
    providerId: string
  ): Promise<{ response: ExtendedParsePlaylistResponse; timing: { parseMs: number; indexMs: number } }> {
    const worker = this.getPlaylistWorker();
    const response = await this.sendMessage<ParsePlaylistRequest, ExtendedParsePlaylistResponse & { timing?: { parseMs: number; indexMs: number } }>(
      worker,
      'PARSE_PLAYLIST',
      { content, providerId }
    );
    
    return {
      response,
      timing: response.timing || { parseMs: 0, indexMs: 0 },
    };
  }
  
  async parseEpg(
    content: string,
    channelMapping: Map<string, string>
  ): Promise<{ response: ParseEpgResponse; timing: { parseMs: number; indexMs: number } }> {
    const worker = this.getEpgWorker();
    const response = await this.sendMessage<ParseEpgRequest, ParseEpgResponse & { timing?: { parseMs: number; indexMs: number } }>(
      worker,
      'PARSE_EPG',
      { content, channelMapping: Array.from(channelMapping.entries()) }
    );
    
    return {
      response,
      timing: response.timing || { parseMs: 0, indexMs: 0 },
    };
  }
  
  terminate() {
    this.playlistWorker?.terminate();
    this.epgWorker?.terminate();
    this.playlistWorker = null;
    this.epgWorker = null;
    
    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Worker terminated'));
    }
    this.pendingRequests.clear();
  }
}

export const workerManager = new WorkerManager();
