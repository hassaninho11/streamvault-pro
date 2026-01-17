/**
 * Catch-up / Time-shift Service
 * Handles archive playback and DVR-like functionality
 */

import { supabase } from '@/integrations/supabase/client';
import { useEpgStore } from '@/data/stores/epgStore';
import { useChannelStore } from '@/data/stores/channelStore';
import type { CoreEpgProgram, CoreChannel } from '@/core/types';

// Catch-up URL formats supported by various providers
export type CatchupFormat = 
  | 'shift'      // &utc_start={utc}&utc_end={utc}
  | 'flussonic'  // /timeshift_abs-{utc}.m3u8
  | 'archive'    // ?archive={start_timestamp}&duration={duration}
  | 'xc'         // Xtream Codes format with stream_id and start/duration
  | 'custom';    // Custom template

export interface CatchupSource {
  channelId: string;
  supportsTimeshift: boolean;
  supportsCatchup: boolean;
  catchupFormat?: CatchupFormat;
  catchupDays?: number; // How many days of archive available
  timeshiftMinutes?: number; // How far back can seek in live
}

export interface CatchupPlaybackRequest {
  channel: CoreChannel;
  program: CoreEpgProgram;
  startTime?: number; // Unix timestamp to start from (for resume)
}

export interface TimeshiftState {
  isTimeshifting: boolean;
  livePosition: number; // Current live timestamp
  playbackPosition: number; // Where we're actually playing
  bufferStart: number; // Earliest seekable position
  canSeekBack: boolean;
  canSeekForward: boolean;
  behindLiveSeconds: number;
}

class CatchupServiceClass {
  // Cache channel catch-up capabilities
  private catchupSources = new Map<string, CatchupSource>();
  
  // Default timeshift buffer (in seconds)
  private readonly DEFAULT_TIMESHIFT_BUFFER = 60 * 60; // 1 hour
  
  /**
   * Check if a channel supports catch-up based on M3U attributes
   */
  detectCatchupSupport(channel: CoreChannel, m3uExtras?: Record<string, string>): CatchupSource {
    const source: CatchupSource = {
      channelId: channel.id,
      supportsTimeshift: false,
      supportsCatchup: false,
    };
    
    if (!m3uExtras) {
      this.catchupSources.set(channel.id, source);
      return source;
    }
    
    // Check common catch-up indicators in M3U
    const catchup = m3uExtras['catchup'] || m3uExtras['tvg-catchup'];
    const catchupDays = m3uExtras['catchup-days'] || m3uExtras['tvg-catchup-days'];
    const catchupSource = m3uExtras['catchup-source'] || m3uExtras['tvg-catchup-source'];
    const timeshift = m3uExtras['timeshift'] || m3uExtras['tvg-timeshift'];
    
    if (catchup || catchupSource) {
      source.supportsCatchup = true;
      
      // Detect format
      if (catchup === 'shift' || catchupSource?.includes('utc')) {
        source.catchupFormat = 'shift';
      } else if (catchup === 'flussonic' || catchupSource?.includes('timeshift_abs')) {
        source.catchupFormat = 'flussonic';
      } else if (catchup === 'xc' || catchupSource?.includes('archive')) {
        source.catchupFormat = 'xc';
      } else {
        source.catchupFormat = 'custom';
      }
      
      if (catchupDays) {
        source.catchupDays = parseInt(catchupDays, 10);
      }
    }
    
    if (timeshift) {
      source.supportsTimeshift = true;
      source.timeshiftMinutes = parseInt(timeshift, 10) || 60;
    }
    
    // Many providers support timeshift even without explicit flag
    // Enable by default for HLS streams
    if (channel.streamUrl.includes('.m3u8')) {
      source.supportsTimeshift = true;
      source.timeshiftMinutes = source.timeshiftMinutes || 60;
    }
    
    this.catchupSources.set(channel.id, source);
    return source;
  }
  
  /**
   * Get catch-up source info for a channel
   */
  getCatchupSource(channelId: string): CatchupSource | undefined {
    return this.catchupSources.get(channelId);
  }
  
  /**
   * Check if a program is available for catch-up playback
   */
  isProgramAvailable(program: CoreEpgProgram): boolean {
    const source = this.catchupSources.get(program.channelId);
    if (!source?.supportsCatchup) return false;
    
    const now = Date.now();
    const programEnd = program.end;
    
    // Program must have ended
    if (programEnd > now) return false;
    
    // Check if within catch-up window
    if (source.catchupDays) {
      const maxAge = source.catchupDays * 24 * 60 * 60 * 1000;
      if (now - programEnd > maxAge) return false;
    }
    
    return true;
  }
  
  /**
   * Generate catch-up playback URL for a program
   */
  generateCatchupUrl(channel: CoreChannel, program: CoreEpgProgram, extras?: Record<string, string>): string | null {
    const source = this.catchupSources.get(channel.id);
    if (!source?.supportsCatchup) return null;
    
    const baseUrl = channel.streamUrl;
    const startUtc = Math.floor(program.start / 1000);
    const endUtc = Math.floor(program.end / 1000);
    const duration = endUtc - startUtc;
    
    // Check for custom catchup-source template
    const catchupSource = extras?.['catchup-source'] || extras?.['tvg-catchup-source'];
    if (catchupSource) {
      // Replace template placeholders
      return catchupSource
        .replace(/\{utc\}/g, String(startUtc))
        .replace(/\{start\}/g, String(startUtc))
        .replace(/\{end\}/g, String(endUtc))
        .replace(/\{duration\}/g, String(duration))
        .replace(/\{timestamp\}/g, String(startUtc))
        .replace(/\${start}/g, String(startUtc))
        .replace(/\${end}/g, String(endUtc))
        .replace(/\${duration}/g, String(duration));
    }
    
    // Generate based on detected format
    switch (source.catchupFormat) {
      case 'shift':
        // Add UTC parameters
        if (baseUrl.includes('?')) {
          return `${baseUrl}&utc_start=${startUtc}&utc_end=${endUtc}`;
        }
        return `${baseUrl}?utc_start=${startUtc}&utc_end=${endUtc}`;
        
      case 'flussonic':
        // Flussonic timeshift format
        const urlParts = baseUrl.split('/');
        urlParts[urlParts.length - 1] = `timeshift_abs-${startUtc}.m3u8`;
        return urlParts.join('/');
        
      case 'xc':
        // Xtream Codes archive format
        if (baseUrl.includes('?')) {
          return `${baseUrl}&archive=${startUtc}&duration=${duration}`;
        }
        return `${baseUrl}?archive=${startUtc}&duration=${duration}`;
        
      default:
        return null;
    }
  }
  
  /**
   * Get available catch-up programs for a channel
   */
  getAvailableCatchupPrograms(channelId: string): CoreEpgProgram[] {
    const programs = useEpgStore.getState().byChannelId.get(channelId) || [];
    const now = Date.now();
    
    return programs.filter(p => {
      // Must have ended
      if (p.end > now) return false;
      return this.isProgramAvailable(p);
    });
  }
  
  /**
   * Calculate timeshift state for a live stream
   */
  calculateTimeshiftState(
    channelId: string,
    currentPlaybackTime: number,
    videoDuration: number,
    videoCurrentTime: number
  ): TimeshiftState {
    const source = this.catchupSources.get(channelId);
    const now = Date.now();
    const bufferMinutes = source?.timeshiftMinutes || 60;
    const bufferMs = bufferMinutes * 60 * 1000;
    
    // For live streams, duration often represents buffer length
    const bufferStart = now - bufferMs;
    const livePosition = now;
    
    // Calculate where we are in the buffer
    // If at the "end" of video, we're live
    // If seeking back, we're behind
    const isAtLiveEdge = videoDuration > 0 && 
      (videoDuration - videoCurrentTime) < 10; // Within 10 seconds of live
    
    const playbackPosition = isAtLiveEdge 
      ? now 
      : now - ((videoDuration - videoCurrentTime) * 1000);
    
    const behindLiveSeconds = Math.max(0, (now - playbackPosition) / 1000);
    
    return {
      isTimeshifting: !isAtLiveEdge && behindLiveSeconds > 10,
      livePosition,
      playbackPosition,
      bufferStart,
      canSeekBack: playbackPosition > bufferStart + 30000, // 30s from start
      canSeekForward: !isAtLiveEdge,
      behindLiveSeconds,
    };
  }
  
  /**
   * Format "behind live" time for display
   */
  formatBehindLive(seconds: number): string {
    if (seconds < 60) return 'LIVE';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `-${hours}h ${minutes}m`;
    }
    return `-${minutes}m`;
  }
}

export const CatchupService = new CatchupServiceClass();

// ============= React Hooks =============

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseCatchupOptions {
  channelId: string;
  videoElement?: HTMLVideoElement | null;
}

export interface UseCatchupReturn {
  // Timeshift state
  timeshiftState: TimeshiftState | null;
  isTimeshifting: boolean;
  behindLiveDisplay: string;
  
  // Actions
  goToLive: () => void;
  seekBack: (seconds: number) => void;
  seekForward: (seconds: number) => void;
  
  // Catch-up
  catchupSource: CatchupSource | null;
  hasCatchup: boolean;
  availablePrograms: CoreEpgProgram[];
  playCatchup: (program: CoreEpgProgram) => string | null;
}

export function useCatchup({ channelId, videoElement }: UseCatchupOptions): UseCatchupReturn {
  const [timeshiftState, setTimeshiftState] = useState<TimeshiftState | null>(null);
  const [availablePrograms, setAvailablePrograms] = useState<CoreEpgProgram[]>([]);
  const updateInterval = useRef<NodeJS.Timeout>();
  
  const channel = useChannelStore((s) => s.index?.byId.get(channelId));
  const catchupSource = CatchupService.getCatchupSource(channelId) || null;
  
  // Update timeshift state periodically
  useEffect(() => {
    if (!videoElement || !channelId) return;
    
    const updateState = () => {
      const state = CatchupService.calculateTimeshiftState(
        channelId,
        Date.now(),
        videoElement.duration || 0,
        videoElement.currentTime || 0
      );
      setTimeshiftState(state);
    };
    
    // Initial update
    updateState();
    
    // Update every second
    updateInterval.current = setInterval(updateState, 1000);
    
    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [channelId, videoElement]);
  
  // Load available catch-up programs
  useEffect(() => {
    if (catchupSource?.supportsCatchup) {
      setAvailablePrograms(CatchupService.getAvailableCatchupPrograms(channelId));
    } else {
      setAvailablePrograms([]);
    }
  }, [channelId, catchupSource]);
  
  const goToLive = useCallback(() => {
    if (videoElement && isFinite(videoElement.duration)) {
      videoElement.currentTime = videoElement.duration;
    }
  }, [videoElement]);
  
  const seekBack = useCallback((seconds: number) => {
    if (videoElement) {
      videoElement.currentTime = Math.max(0, videoElement.currentTime - seconds);
    }
  }, [videoElement]);
  
  const seekForward = useCallback((seconds: number) => {
    if (videoElement && isFinite(videoElement.duration)) {
      videoElement.currentTime = Math.min(
        videoElement.duration,
        videoElement.currentTime + seconds
      );
    }
  }, [videoElement]);
  
  const playCatchup = useCallback((program: CoreEpgProgram): string | null => {
    if (!channel) return null;
    return CatchupService.generateCatchupUrl(channel, program);
  }, [channel]);
  
  return {
    timeshiftState,
    isTimeshifting: timeshiftState?.isTimeshifting || false,
    behindLiveDisplay: timeshiftState 
      ? CatchupService.formatBehindLive(timeshiftState.behindLiveSeconds)
      : 'LIVE',
    goToLive,
    seekBack,
    seekForward,
    catchupSource,
    hasCatchup: catchupSource?.supportsCatchup || false,
    availablePrograms,
    playCatchup,
  };
}
