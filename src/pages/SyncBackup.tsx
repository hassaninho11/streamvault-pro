/**
 * Sync & Backup Page - Manage data sync and local backup
 */

import { useState, useEffect } from "react";
import { 
  Cloud, 
  CloudOff, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  User,
  Smartphone,
  Loader2,
  FileDown,
  FileUp
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { syncEngine, SyncStatus, SyncStrategy } from "@/data/stores/syncEngine";
import { localStore } from "@/data/stores/localStore";
import { useToast } from "@/hooks/use-toast";

export default function SyncBackupPage() {
  const { user, isGuest, syncData } = useAuth();
  const { toast } = useToast();
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ isSyncing: false, pendingChanges: 0 });
  const [selectedStrategy, setSelectedStrategy] = useState<SyncStrategy>('merge');
  const [isSyncing, setIsSyncing] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    // Get sync status
    syncEngine.getStatus().then(setSyncStatus);
    
    // Subscribe to status changes
    const unsubscribe = syncEngine.subscribe(setSyncStatus);
    
    // Get device ID
    localStore.getDeviceId().then(setDeviceId);
    
    return unsubscribe;
  }, []);

  const handleSync = async () => {
    if (!user) return;
    
    setIsSyncing(true);
    try {
      await syncData(selectedStrategy);
      toast({
        title: "Sync complete",
        description: "Your data has been synchronized.",
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await localStore.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `streamvault-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export complete",
        description: "Your backup file has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await localStore.importAll(data);
        
        toast({
          title: "Import complete",
          description: "Your data has been restored.",
        });
      } catch (error) {
        toast({
          title: "Import failed",
          description: "Invalid backup file format.",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cloud className="w-6 h-6" />
            Sync & Backup
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your data sync and local backups
          </p>
        </div>

        {/* Account Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Account Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isGuest ? (
                  <CloudOff className="w-8 h-8 text-muted-foreground" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                )}
                <div>
                  <p className="font-medium">
                    {isGuest ? "Guest Mode" : user?.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isGuest 
                      ? "Sign in to sync across devices" 
                      : "Connected to cloud sync"}
                  </p>
                </div>
              </div>
              {isGuest && (
                <Button variant="glow" onClick={() => window.location.href = '/auth'}>
                  Sign In
                </Button>
              )}
            </div>

            <Separator />

            <div className="flex items-center gap-3 text-sm">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Device ID:</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {deviceId.slice(0, 8)}...
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Cloud Sync */}
        {!isGuest && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Cloud Sync
              </CardTitle>
              <CardDescription>
                Sync your providers, favorites, and watch history across devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sync Status */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Sync Status</p>
                  <p className="text-sm text-muted-foreground">
                    {syncStatus.lastSyncAt 
                      ? `Last synced: ${new Date(syncStatus.lastSyncAt).toLocaleString()}`
                      : 'Never synced'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {syncStatus.pendingChanges > 0 && (
                    <Badge variant="secondary">
                      {syncStatus.pendingChanges} pending
                    </Badge>
                  )}
                  {syncStatus.isSyncing ? (
                    <Badge variant="outline">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Syncing
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-500">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Synced
                    </Badge>
                  )}
                </div>
              </div>

              {/* Sync Strategy */}
              <div className="space-y-3">
                <Label>Sync Strategy</Label>
                <RadioGroup
                  value={selectedStrategy}
                  onValueChange={(v) => setSelectedStrategy(v as SyncStrategy)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="merge" id="merge" />
                    <Label htmlFor="merge" className="flex-1 cursor-pointer">
                      <p className="font-medium">Merge (Recommended)</p>
                      <p className="text-sm text-muted-foreground">
                        Combine local and cloud data, newest wins on conflicts
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="keep_local" id="keep_local" />
                    <Label htmlFor="keep_local" className="flex-1 cursor-pointer">
                      <p className="font-medium">Upload Local</p>
                      <p className="text-sm text-muted-foreground">
                        Overwrite cloud with your local data
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="keep_remote" id="keep_remote" />
                    <Label htmlFor="keep_remote" className="flex-1 cursor-pointer">
                      <p className="font-medium">Download Cloud</p>
                      <p className="text-sm text-muted-foreground">
                        Replace local with cloud data
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Button
                variant="glow"
                className="w-full"
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Local Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="w-5 h-5" />
              Local Backup
            </CardTitle>
            <CardDescription>
              Export or import your data as a file (no account required)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-auto py-4" onClick={handleExport}>
                <div className="flex flex-col items-center gap-2">
                  <FileDown className="w-6 h-6" />
                  <span>Export Backup</span>
                  <span className="text-xs text-muted-foreground">
                    Download as JSON
                  </span>
                </div>
              </Button>
              <Button variant="outline" className="h-auto py-4" onClick={handleImport}>
                <div className="flex flex-col items-center gap-2">
                  <FileUp className="w-6 h-6" />
                  <span>Import Backup</span>
                  <span className="text-xs text-muted-foreground">
                    Restore from file
                  </span>
                </div>
              </Button>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
              <p className="text-muted-foreground">
                Local backups include providers, favorites, recently watched, and settings.
                EPG data is not included as it can be re-downloaded.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
