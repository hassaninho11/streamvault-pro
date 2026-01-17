/**
 * Channel Health Service - Monitors channel stability and availability
 */

export interface ChannelHealth {
  channelId: string;
  lastChecked: number;
  status: 'online' | 'offline' | 'unstable' | 'unknown';
  stabilityScore: number; // 0-100
  errorCount: number;
  lastError?: string;
  lastErrorAt?: number;
  avgLoadTimeMs?: number;
  bufferUnderrunCount: number;
  checksTotal: number;
  checksSuccess: number;
}

export interface HealthCheckResult {
  channelId: string;
  success: boolean;
  loadTimeMs?: number;
  error?: string;
}

const STORAGE_KEY = 'streamvault-channel-health';
const MAX_HISTORY = 100; // Keep last 100 checks per channel

class ChannelHealthService {
  private healthMap: Map<string, ChannelHealth> = new Map();
  private checkQueue: string[] = [];
  private isChecking = false;

  constructor() {
    this.load();
  }

  /**
   * Load health data from storage
   */
  private load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as [string, ChannelHealth][];
        this.healthMap = new Map(data);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Save health data to storage
   */
  private save(): void {
    const data = Array.from(this.healthMap.entries());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * Record a playback result
   */
  recordResult(result: HealthCheckResult): void {
    let health = this.healthMap.get(result.channelId);
    
    if (!health) {
      health = {
        channelId: result.channelId,
        lastChecked: Date.now(),
        status: 'unknown',
        stabilityScore: 100,
        errorCount: 0,
        bufferUnderrunCount: 0,
        checksTotal: 0,
        checksSuccess: 0,
      };
    }

    health.lastChecked = Date.now();
    health.checksTotal++;

    if (result.success) {
      health.checksSuccess++;
      health.avgLoadTimeMs = health.avgLoadTimeMs
        ? (health.avgLoadTimeMs + (result.loadTimeMs || 0)) / 2
        : result.loadTimeMs;
    } else {
      health.errorCount++;
      health.lastError = result.error;
      health.lastErrorAt = Date.now();
    }

    // Calculate stability score
    health.stabilityScore = Math.round(
      (health.checksSuccess / health.checksTotal) * 100
    );

    // Update status
    if (health.checksTotal < 3) {
      health.status = 'unknown';
    } else if (health.stabilityScore >= 90) {
      health.status = 'online';
    } else if (health.stabilityScore >= 50) {
      health.status = 'unstable';
    } else {
      health.status = 'offline';
    }

    this.healthMap.set(result.channelId, health);
    this.save();
  }

  /**
   * Record a buffer underrun
   */
  recordBufferUnderrun(channelId: string): void {
    const health = this.healthMap.get(channelId);
    if (health) {
      health.bufferUnderrunCount++;
      this.healthMap.set(channelId, health);
      this.save();
    }
  }

  /**
   * Get health for a channel
   */
  getHealth(channelId: string): ChannelHealth | undefined {
    return this.healthMap.get(channelId);
  }

  /**
   * Get all channel health data
   */
  getAllHealth(): ChannelHealth[] {
    return Array.from(this.healthMap.values());
  }

  /**
   * Get channels sorted by stability
   */
  getByStability(order: 'asc' | 'desc' = 'desc'): ChannelHealth[] {
    return this.getAllHealth().sort((a, b) => 
      order === 'desc' 
        ? b.stabilityScore - a.stabilityScore
        : a.stabilityScore - b.stabilityScore
    );
  }

  /**
   * Get unhealthy channels
   */
  getUnhealthy(): ChannelHealth[] {
    return this.getAllHealth().filter(h => h.status === 'offline' || h.status === 'unstable');
  }

  /**
   * Queue channels for health check
   */
  queueHealthCheck(channelIds: string[]): void {
    for (const id of channelIds) {
      if (!this.checkQueue.includes(id)) {
        this.checkQueue.push(id);
      }
    }
    this.processQueue();
  }

  /**
   * Process health check queue
   */
  private async processQueue(): Promise<void> {
    if (this.isChecking || this.checkQueue.length === 0) return;
    
    this.isChecking = true;
    
    while (this.checkQueue.length > 0) {
      const channelId = this.checkQueue.shift()!;
      await this.checkChannel(channelId);
      // Rate limit: 1 check per second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.isChecking = false;
  }

  /**
   * Check a single channel
   */
  private async checkChannel(channelId: string): Promise<void> {
    // This would make a HEAD request to the stream URL
    // For now, we just simulate
    const success = Math.random() > 0.1; // 90% success rate for demo
    
    this.recordResult({
      channelId,
      success,
      loadTimeMs: success ? Math.random() * 2000 : undefined,
      error: success ? undefined : 'Connection timeout',
    });
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    total: number;
    online: number;
    offline: number;
    unstable: number;
    unknown: number;
    avgStability: number;
  } {
    const all = this.getAllHealth();
    const total = all.length;
    
    return {
      total,
      online: all.filter(h => h.status === 'online').length,
      offline: all.filter(h => h.status === 'offline').length,
      unstable: all.filter(h => h.status === 'unstable').length,
      unknown: all.filter(h => h.status === 'unknown').length,
      avgStability: total > 0 
        ? Math.round(all.reduce((sum, h) => sum + h.stabilityScore, 0) / total)
        : 100,
    };
  }

  /**
   * Export debug report (anonymized)
   */
  exportDebugReport(): object {
    const summary = this.getSummary();
    const unhealthy = this.getUnhealthy().map(h => ({
      status: h.status,
      stabilityScore: h.stabilityScore,
      errorCount: h.errorCount,
      lastError: h.lastError,
      checksTotal: h.checksTotal,
    }));

    return {
      exportedAt: new Date().toISOString(),
      summary,
      unhealthyChannels: unhealthy,
      // No channel IDs or URLs exposed
    };
  }

  /**
   * Clear all health data
   */
  clearAll(): void {
    this.healthMap.clear();
    this.save();
  }
}

export const channelHealthService = new ChannelHealthService();
export default channelHealthService;
