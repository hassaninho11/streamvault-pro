/**
 * EPG Alerts Service - Program reminders and notifications
 */

export interface EpgAlert {
  id: string;
  channelId: string;
  programId: string;
  programTitle: string;
  startTime: number;
  alertTime: number; // When to show the alert (before start)
  isRecurring: boolean;
  createdAt: number;
}

interface EpgAlertsState {
  alerts: EpgAlert[];
  lastCheck: number;
}

const STORAGE_KEY = 'streamvault-epg-alerts';
const ALERT_BEFORE_MS = 5 * 60 * 1000; // 5 minutes before

class EpgAlertsService {
  private state: EpgAlertsState = { alerts: [], lastCheck: 0 };
  private checkInterval: NodeJS.Timeout | null = null;
  private onAlertCallbacks: ((alert: EpgAlert) => void)[] = [];

  constructor() {
    this.load();
    this.startChecking();
  }

  /**
   * Load alerts from storage
   */
  private load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.state = JSON.parse(stored);
        // Clean up expired alerts
        const now = Date.now();
        this.state.alerts = this.state.alerts.filter(a => a.startTime > now - 60000);
      }
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Save alerts to storage
   */
  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  /**
   * Start checking for due alerts
   */
  private startChecking(): void {
    if (this.checkInterval) return;
    
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check for due alerts
   */
  private checkAlerts(): void {
    const now = Date.now();
    
    for (const alert of this.state.alerts) {
      if (alert.alertTime <= now && alert.alertTime > this.state.lastCheck) {
        // Alert is due
        this.triggerAlert(alert);
      }
    }
    
    this.state.lastCheck = now;
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(alert: EpgAlert): void {
    // Notify all subscribers
    for (const callback of this.onAlertCallbacks) {
      callback(alert);
    }

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('StreamVault', {
        body: `"${alert.programTitle}" starts in 5 minutes`,
        icon: '/favicon.ico',
        tag: alert.id,
      });
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  /**
   * Add an alert for a program
   */
  addAlert(
    channelId: string,
    programId: string,
    programTitle: string,
    startTime: number,
    isRecurring = false
  ): EpgAlert {
    // Remove existing alert for same program
    this.removeAlertByProgram(programId);

    const alert: EpgAlert = {
      id: crypto.randomUUID(),
      channelId,
      programId,
      programTitle,
      startTime,
      alertTime: startTime - ALERT_BEFORE_MS,
      isRecurring,
      createdAt: Date.now(),
    };

    this.state.alerts.push(alert);
    this.save();
    
    return alert;
  }

  /**
   * Remove an alert
   */
  removeAlert(alertId: string): void {
    this.state.alerts = this.state.alerts.filter(a => a.id !== alertId);
    this.save();
  }

  /**
   * Remove alert by program ID
   */
  removeAlertByProgram(programId: string): void {
    this.state.alerts = this.state.alerts.filter(a => a.programId !== programId);
    this.save();
  }

  /**
   * Check if program has an alert
   */
  hasAlert(programId: string): boolean {
    return this.state.alerts.some(a => a.programId === programId);
  }

  /**
   * Get alert for program
   */
  getAlertForProgram(programId: string): EpgAlert | undefined {
    return this.state.alerts.find(a => a.programId === programId);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): EpgAlert[] {
    return [...this.state.alerts].sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Get upcoming alerts (next 24 hours)
   */
  getUpcomingAlerts(): EpgAlert[] {
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;
    return this.state.alerts
      .filter(a => a.startTime > now && a.startTime < in24h)
      .sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Subscribe to alert notifications
   */
  onAlert(callback: (alert: EpgAlert) => void): () => void {
    this.onAlertCallbacks.push(callback);
    return () => {
      this.onAlertCallbacks = this.onAlertCallbacks.filter(c => c !== callback);
    };
  }

  /**
   * Clear all alerts
   */
  clearAll(): void {
    this.state.alerts = [];
    this.save();
  }

  /**
   * Stop the service
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const epgAlertsService = new EpgAlertsService();
export default epgAlertsService;
