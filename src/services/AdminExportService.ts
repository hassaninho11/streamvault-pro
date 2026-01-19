/**
 * AdminExportService - CSV export functionality for admin panel
 */

import { adminService, AdminUser, BugReport, AuditLog } from './AdminService';

class AdminExportService {
  /**
   * Convert array of objects to CSV string
   */
  private toCSV<T>(data: T[], columns: { key: keyof T; label: string }[]): string {
    const header = columns.map(c => `"${c.label}"`).join(',');
    const rows = data.map(row => 
      columns.map(c => {
        const value = row[c.key];
        if (value === null || value === undefined) return '""';
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
        if (value instanceof Date) return `"${value.toISOString()}"`;
        return `"${String(value)}"`;
      }).join(',')
    );
    return [header, ...rows].join('\n');
  }

  /**
   * Trigger download of CSV file
   */
  private downloadCSV(content: string, filename: string): void {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  /**
   * Export users to CSV
   */
  async exportUsers(): Promise<void> {
    const users = await adminService.getUsers({});
    
    const columns: { key: keyof AdminUser; label: string }[] = [
      { key: 'email', label: 'Email' },
      { key: 'displayName', label: 'Namn' },
      { key: 'role', label: 'Roll' },
      { key: 'status', label: 'Status' },
      { key: 'premiumStatus', label: 'Premium Status' },
      { key: 'premiumSource', label: 'Premium Källa' },
      { key: 'premiumUntil', label: 'Premium Till' },
      { key: 'providerCount', label: 'Antal Providers' },
      { key: 'deviceCount', label: 'Antal Enheter' },
      { key: 'createdAt', label: 'Registrerad' },
      { key: 'lastSeenAt', label: 'Senast Aktiv' },
    ];

    const csv = this.toCSV(users, columns);
    const date = new Date().toISOString().split('T')[0];
    this.downloadCSV(csv, `streamvault-users-${date}.csv`);
  }

  /**
   * Export bug reports to CSV
   */
  async exportBugReports(): Promise<void> {
    const bugs = await adminService.getBugReports({});
    
    const columns: { key: keyof BugReport; label: string }[] = [
      { key: 'id', label: 'ID' },
      { key: 'title', label: 'Titel' },
      { key: 'description', label: 'Beskrivning' },
      { key: 'severity', label: 'Allvarlighet' },
      { key: 'status', label: 'Status' },
      { key: 'platform', label: 'Plattform' },
      { key: 'appVersion', label: 'App Version' },
      { key: 'createdAt', label: 'Skapad' },
      { key: 'updatedAt', label: 'Uppdaterad' },
    ];

    const csv = this.toCSV(bugs, columns);
    const date = new Date().toISOString().split('T')[0];
    this.downloadCSV(csv, `streamvault-bugs-${date}.csv`);
  }

  /**
   * Export audit logs to CSV
   */
  async exportAuditLogs(): Promise<void> {
    const logs = await adminService.getAuditLogs(1000);
    
    const columns: { key: keyof AuditLog; label: string }[] = [
      { key: 'id', label: 'ID' },
      { key: 'actionType', label: 'Åtgärd' },
      { key: 'adminUserId', label: 'Admin ID' },
      { key: 'targetUserId', label: 'Mål ID' },
      { key: 'createdAt', label: 'Tidpunkt' },
    ];

    const csv = this.toCSV(logs, columns);
    const date = new Date().toISOString().split('T')[0];
    this.downloadCSV(csv, `streamvault-audit-${date}.csv`);
  }

  /**
   * Export purchases to CSV (placeholder for future)
   */
  async exportPurchases(): Promise<void> {
    // TODO: Implement when purchases are available
    throw new Error('Purchases export not yet implemented');
  }
}

export const adminExportService = new AdminExportService();
export default adminExportService;
