/**
 * BugReportService - Client-side bug reporting
 * Handles diagnostic masking and submission
 */

import { supabase } from '@/integrations/supabase/client';
import { APP_CONFIG } from '@/config/app';

interface DiagnosticData {
  platform: 'android' | 'ios' | 'web';
  appVersion: string;
  userAgent: string;
  screenSize: string;
  timestamp: string;
  errors: string[];
  networkStatus: string;
  memoryUsage?: number;
  providerCount?: number;
  channelCount?: number;
}

interface BugReportPayload {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  includeDiagnostics: boolean;
}

/**
 * Mask sensitive data from diagnostics
 * - Never include credentials
 * - Mask URLs (hash domains, truncate tokens)
 * - Only include error codes, container types, engine info
 */
function maskDiagnostics(data: DiagnosticData): Record<string, unknown> {
  return {
    platform: data.platform,
    appVersion: data.appVersion,
    userAgent: data.userAgent.slice(0, 100), // Truncate long user agents
    screenSize: data.screenSize,
    timestamp: data.timestamp,
    errors: data.errors.map(err => {
      // Remove any potential URLs or sensitive data from error messages
      return err
        .replace(/https?:\/\/[^\s]+/g, '[URL_MASKED]')
        .replace(/[a-zA-Z0-9]{32,}/g, '[TOKEN_MASKED]')
        .slice(0, 500);
    }),
    networkStatus: data.networkStatus,
    memoryUsage: data.memoryUsage,
    providerCount: data.providerCount,
    channelCount: data.channelCount,
  };
}

/**
 * Collect current diagnostic data
 */
function collectDiagnostics(): DiagnosticData {
  const platform = /Android/i.test(navigator.userAgent) 
    ? 'android' 
    : /iPhone|iPad|iPod/i.test(navigator.userAgent) 
      ? 'ios' 
      : 'web';

  return {
    platform,
    appVersion: APP_CONFIG.version,
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
    errors: [], // Could be populated from a global error collector
    networkStatus: navigator.onLine ? 'online' : 'offline',
    memoryUsage: (performance as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
  };
}

class BugReportService {
  /**
   * Submit a bug report
   */
  async submitBugReport(payload: BugReportPayload): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current user if logged in
      const { data: { user } } = await supabase.auth.getUser();
      
      // Collect and mask diagnostics if requested
      let diagnosticsMasked = null;
      if (payload.includeDiagnostics) {
        const diagnostics = collectDiagnostics();
        diagnosticsMasked = maskDiagnostics(diagnostics);
      }

      // Determine platform
      const platform = /Android/i.test(navigator.userAgent) 
        ? 'android' 
        : /iPhone|iPad|iPod/i.test(navigator.userAgent) 
          ? 'ios' 
          : 'web';

      // Insert bug report
      const { error } = await supabase.from('bug_reports').insert({
        user_id: user?.id || null,
        platform,
        app_version: APP_CONFIG.version,
        title: payload.title,
        description: payload.description,
        severity: payload.severity,
        diagnostics_masked: diagnosticsMasked,
      });

      if (error) {
        console.error('Bug report submission error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('Bug report submission error:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }

  /**
   * Log an app event (for analytics)
   */
  async logEvent(eventType: string, meta?: Record<string, unknown>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Mask any sensitive data in meta
      const maskedMeta = meta ? {
        ...meta,
        // Remove any URLs or tokens
        url: undefined,
        token: undefined,
        password: undefined,
        credentials: undefined,
      } : null;

      const platform = /Android/i.test(navigator.userAgent) 
        ? 'android' 
        : /iPhone|iPad|iPod/i.test(navigator.userAgent) 
          ? 'ios' 
          : 'web';

      await supabase.from('app_events').insert({
        user_id: user?.id || null,
        event_type: eventType,
        platform,
        app_version: APP_CONFIG.version,
        meta_masked: maskedMeta,
      });
    } catch (err) {
      // Silently fail - don't break the app for analytics
      console.warn('Failed to log event:', err);
    }
  }

  /**
   * Update last seen timestamp for user
   */
  async updateLastSeen(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('admin_user_metadata').upsert({
        user_id: user.id,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch (err) {
      // Silently fail
      console.warn('Failed to update last seen:', err);
    }
  }
}

export const bugReportService = new BugReportService();
export default bugReportService;
