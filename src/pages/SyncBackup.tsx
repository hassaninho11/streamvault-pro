/**
 * Sync & Backup Page - Manage data sync and local backup
 */

import { useState, useEffect, useRef } from "react";
import { 
  Cloud, 
  CloudOff, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  User,
  Smartphone,
  Loader2,
  FileDown,
  FileUp,
  Lock,
  Unlock,
  AlertTriangle,
  ShieldCheck
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { syncEngine, SyncStatus, SyncStrategy } from "@/data/stores/syncEngine";
import { localStore } from "@/data/stores/localStore";
import { backupService } from "@/services/BackupService";
import { useToast } from "@/hooks/use-toast";

type ExportType = 'encrypted' | 'unencrypted';

export default function SyncBackupPage() {
  const { user, isGuest, syncData } = useAuth();
  const { toast } = useToast();
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ isSyncing: false, pendingChanges: 0 });
  const [selectedStrategy, setSelectedStrategy] = useState<SyncStrategy>('merge');
  const [isSyncing, setIsSyncing] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');
  
  // Export/Import state
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showUnencryptedWarning, setShowUnencryptedWarning] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; stats?: { providers: number; favorites: number; recents: number } } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExport = async (type: ExportType) => {
    setIsExporting(true);
    setShowExportDialog(false);
    setShowUnencryptedWarning(false);
    
    try {
      const content = type === 'encrypted' 
        ? await backupService.exportEncrypted()
        : await backupService.exportUnencrypted();
      
      backupService.downloadBackup(content, type === 'encrypted');
      
      toast({
        title: "Export complete",
        description: `Your ${type === 'encrypted' ? 'encrypted ' : ''}backup has been downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportClick = () => {
    setShowExportDialog(true);
  };

  const handleUnencryptedExport = () => {
    setShowExportDialog(false);
    setShowUnencryptedWarning(true);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    setImportResult(null);
    
    try {
      const content = await file.text();
      const result = await backupService.importBackup(content);
      
      if (result.success) {
        setImportResult({
          success: true,
          message: 'Backup restored successfully!',
          stats: result.stats,
        });
        toast({
          title: "Import complete",
          description: "Your data has been restored.",
        });
      } else {
        setImportResult({
          success: false,
          message: result.error || 'Failed to import backup',
        });
        toast({
          title: "Import failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: 'Failed to read backup file',
      });
      toast({
        title: "Import failed",
        description: "Could not read the backup file.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
            {/* Import result */}
            {importResult && (
              <Alert variant={importResult.success ? "default" : "destructive"}>
                {importResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>{importResult.success ? 'Success' : 'Error'}</AlertTitle>
                <AlertDescription>
                  {importResult.message}
                  {importResult.stats && (
                    <div className="mt-2 text-sm">
                      Restored: {importResult.stats.providers} providers, {importResult.stats.favorites} favorites, {importResult.stats.recents} recent items
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-auto py-4" 
                onClick={handleExportClick}
                disabled={isExporting}
              >
                <div className="flex flex-col items-center gap-2">
                  {isExporting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <FileDown className="w-6 h-6" />
                  )}
                  <span>Export Backup</span>
                  <span className="text-xs text-muted-foreground">
                    Download as file
                  </span>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4" 
                onClick={handleImportClick}
                disabled={isImporting}
              >
                <div className="flex flex-col items-center gap-2">
                  {isImporting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <FileUp className="w-6 h-6" />
                  )}
                  <span>Import Backup</span>
                  <span className="text-xs text-muted-foreground">
                    Restore from file
                  </span>
                </div>
              </Button>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelected}
            />

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <ShieldCheck className="w-4 h-4 text-primary mt-0.5" />
              <p className="text-muted-foreground">
                Backups are encrypted by default. Your playlist URLs and credentials are never stored in plain text.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Type Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Backup</DialogTitle>
            <DialogDescription>
              Choose how you want to export your backup
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full h-auto py-4 justify-start"
              onClick={() => handleExport('encrypted')}
            >
              <Lock className="w-5 h-5 mr-3 text-primary" />
              <div className="text-left">
                <p className="font-medium">Encrypted (Recommended)</p>
                <p className="text-sm text-muted-foreground">
                  Your data is encrypted and can only be restored on this device
                </p>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="w-full h-auto py-4 justify-start"
              onClick={handleUnencryptedExport}
            >
              <Unlock className="w-5 h-5 mr-3 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">Unencrypted</p>
                <p className="text-sm text-muted-foreground">
                  Can be restored on any device, but credentials are visible
                </p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unencrypted Warning Dialog */}
      <Dialog open={showUnencryptedWarning} onOpenChange={setShowUnencryptedWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Security Warning
            </DialogTitle>
            <DialogDescription>
              Unencrypted backups contain sensitive information
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Your playlist URLs and credentials will be visible!</AlertTitle>
              <AlertDescription>
                Anyone with access to this file can see your IPTV provider details. Only use this option if you need to transfer to a different device.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnencryptedWarning(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleExport('unencrypted')}
            >
              Export Unencrypted
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
