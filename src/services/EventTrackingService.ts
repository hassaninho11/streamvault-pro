/**
 * EventTrackingService - Centralized event tracking for analytics
 * All events are masked to never include sensitive data
 */

import { supabase } from '@/integrations/supabase/client';
import { APP_CONFIG } from '@/config/app';

export type EventType = 
  | 'app_open'
  | 'app_close'
  | 'import_start'
  | 'import_done'
  | 'import_error'
  | 'play_start'
  | 'play_error'
  | 'play_stop'
  | 'cast_start'
  | 'cast_stop'
  | 'ai_subs_job'
  | 'search'
  | 'favorite_add'
  | 'favorite_remove'
  | 'epg_load'
  | 'provider_add'
  | 'provider_remove'
  | 'settings_change'
  | 'premium_activated'
  | 'trial_started';

interface EventMeta {
  // Generic metadata - all values are masked/sanitized
  [key: string]: string | number | boolean | null | undefined;
}

class EventTrackingService {
  private platform: 'android' | 'ios' | 'web';
  private sessionId: string;
  private eventQueue: Array<{ type: EventType; meta: EventMeta | null; timestamp: number }> = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.platform = this.detectPlatform();
    this.sessionId = this.generateSessionId();
    
    // Track app open on init
    this.track('app_open');
    
    // Track app close
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.track('app_close');
        this.flush(true); // Sync flush on close
      });
    }
  }

  private detectPlatform(): 'android' | 'ios' | 'web' {
    if (/Android/i.test(navigator.userAgent)) return 'android';
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
    return 'web';
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Mask sensitive data from metadata
   */
  private maskMeta(meta: EventMeta | null): Record<string, unknown> | null {
    if (!meta) return null;

    const masked: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(meta)) {
      // Skip sensitive keys entirely
      if (['url', 'token', 'password', 'credentials', 'key', 'secret'].some(s => key.toLowerCase().includes(s))) {
        continue;
      }

      // Mask string values that look like URLs or tokens
      if (typeof value === 'string') {
        if (value.startsWith('http')) {
          // Only keep the pathname, not full URL
          try {
            const url = new URL(value);
            masked[key] = url.pathname;
          } catch {
            masked[key] = '[masked]';
          }
        } else if (value.length > 50) {
          // Truncate long strings
          masked[key] = value.substring(0, 50) + '...';
        } else {
          masked[key] = value;
        }
      } else {
        masked[key] = value;
      }
    }

    return Object.keys(masked).length > 0 ? masked : null;
  }

  /**
   * Track an event
   */
  track(type: EventType, meta?: EventMeta): void {
    this.eventQueue.push({
      type,
      meta: meta || null,
      timestamp: Date.now(),
    });

    // Debounce flush
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    this.flushTimeout = setTimeout(() => this.flush(), 5000);

    // Flush immediately if queue is large
    if (this.eventQueue.length >= 10) {
      this.flush();
    }
  }

  /**
   * Flush queued events to database
   */
  private async flush(sync = false): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const inserts = events.map(event => ({
        user_id: user?.id || null,
        event_type: event.type,
        platform: this.platform,
        app_version: APP_CONFIG.version,
        meta_masked: {
          ...this.maskMeta(event.meta),
          session_id: this.sessionId,
          timestamp: event.timestamp,
        },
      }));

      if (sync) {
        // Use sendBeacon for sync flush on page close
        const body = JSON.stringify({ events: inserts });
        if (navigator.sendBeacon) {
          // Note: sendBeacon with Supabase would require a custom endpoint
          // For now, we just try the regular insert
        }
      }

      await supabase.from('app_events').insert(inserts);
    } catch (err) {
      // Silently fail - don't break the app for analytics
      console.warn('Failed to flush events:', err);
      // Put events back in queue for retry
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Track import events
   */
  trackImport(stage: 'start' | 'done' | 'error', meta?: { 
    channelCount?: number; 
    duration?: number;
    errorCode?: string;
  }): void {
    this.track(`import_${stage}` as EventType, meta);
  }

  /**
   * Track playback events
   */
  trackPlayback(stage: 'start' | 'error' | 'stop', meta?: {
    engine?: string;
    format?: string;
    errorCode?: string;
    duration?: number;
  }): void {
    this.track(`play_${stage}` as EventType, meta);
  }

  /**
   * Track search
   */
  trackSearch(resultCount: number): void {
    this.track('search', { resultCount });
  }
}

export const eventTrackingService = new EventTrackingService();
export default eventTrackingService;
