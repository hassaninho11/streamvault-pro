/**
 * AdminSettings - Admin settings and feature flags
 */

import { useState, useEffect } from 'react';
import { Settings, Flag, Download, Shield, Loader2 } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { adminService } from '@/services/AdminService';
import { adminExportService } from '@/services/AdminExportService';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
}

export function AdminSettings() {
  const { isOwner } = useAdminAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const loadFlags = async () => {
      try {
        const data = await adminService.getFeatureFlags();
        setFlags(data);
      } catch (err) {
        toast.error('Kunde inte ladda feature flags');
      } finally {
        setLoading(false);
      }
    };

    loadFlags();
  }, []);

  const handleToggle = async (flagKey: string, enabled: boolean) => {
    if (!isOwner) {
      toast.error('Endast owner kan ändra feature flags');
      return;
    }

    try {
      setToggling(flagKey);
      await adminService.toggleFeatureFlag(flagKey, enabled);
      setFlags(flags.map(f => f.key === flagKey ? { ...f, enabled } : f));
      toast.success(`${flagKey} ${enabled ? 'aktiverad' : 'inaktiverad'}`);
    } catch (err) {
      toast.error('Kunde inte uppdatera feature flag');
    } finally {
      setToggling(null);
    }
  };

  const handleExport = async (type: 'users' | 'bugs' | 'audit') => {
    setExporting(type);
    try {
      if (type === 'users') {
        await adminExportService.exportUsers();
        toast.success('Användare exporterade');
      } else if (type === 'bugs') {
        await adminExportService.exportBugReports();
        toast.success('Bugrapporter exporterade');
      } else if (type === 'audit') {
        await adminExportService.exportAuditLogs();
        toast.success('Audit logs exporterade');
      }
    } catch (err) {
      toast.error('Export misslyckades');
    } finally {
      setExporting(null);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Inställningar</h1>
          <p className="text-muted-foreground">Admin-inställningar och feature flags</p>
        </div>

        <div className="grid gap-6">
          {/* Owner Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Owner
              </CardTitle>
              <CardDescription>Appens ägare med full kontroll</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Email:</span>
                <code className="bg-muted px-2 py-1 rounded">hassaninho@hotmail.com</code>
              </div>
            </CardContent>
          </Card>

          {/* Feature Flags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="w-5 h-5" />
                Feature Flags
              </CardTitle>
              <CardDescription>
                Aktivera eller inaktivera funktioner i appen
                {!isOwner && ' (endast owner kan ändra)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">Laddar...</div>
              ) : (
                <div className="space-y-4">
                  {flags.map((flag) => (
                    <div 
                      key={flag.key}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <div className="font-medium">{flag.key}</div>
                        {flag.description && (
                          <div className="text-sm text-muted-foreground">{flag.description}</div>
                        )}
                      </div>
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={(checked) => handleToggle(flag.key, checked)}
                        disabled={!isOwner || toggling === flag.key}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Dataexport
              </CardTitle>
              <CardDescription>Exportera data i CSV-format</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button variant="outline" onClick={() => handleExport('users')} disabled={exporting === 'users'}>
                  {exporting === 'users' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Exportera användare
                </Button>
                <Button variant="outline" onClick={() => handleExport('bugs')} disabled={exporting === 'bugs'}>
                  {exporting === 'bugs' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Exportera bugrapporter
                </Button>
                <Button variant="outline" onClick={() => handleExport('audit')} disabled={exporting === 'audit'}>
                  {exporting === 'audit' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Exportera audit logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminSettings;
