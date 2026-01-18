/**
 * SyncWizard - Shows after first login to choose sync strategy
 * Upload local data, download from cloud, or merge both
 */

import { useState } from "react";
import { 
  Cloud, 
  Upload, 
  Download, 
  Merge, 
  Loader2, 
  CheckCircle2,
  ArrowRight,
  Shield,
  Smartphone
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { localStore } from "@/data/stores/localStore";
import { SyncStrategy } from "@/data/stores/syncEngine";
import { useEffect } from "react";

interface SyncWizardProps {
  open: boolean;
  onClose: () => void;
}

interface LocalDataStats {
  providers: number;
  favorites: number;
  recents: number;
}

export function SyncWizard({ open, onClose }: SyncWizardProps) {
  const { user, syncData } = useAuth();
  const { toast } = useToast();
  
  const [strategy, setStrategy] = useState<SyncStrategy>("keep_local");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [localStats, setLocalStats] = useState<LocalDataStats | null>(null);

  // Get local data stats
  useEffect(() => {
    if (open) {
      Promise.all([
        localStore.getProviders(),
        localStore.getFavorites(),
        localStore.getRecents(),
      ]).then(([providers, favorites, recents]) => {
        setLocalStats({
          providers: providers.length,
          favorites: favorites.length,
          recents: recents.length,
        });
      });
    }
  }, [open]);

  const handleSync = async () => {
    if (!user) return;
    
    setIsSyncing(true);
    try {
      await syncData(strategy);
      
      // Mark first sync complete
      localStorage.setItem(`sync-wizard-complete-${user.id}`, 'true');
      
      setIsComplete(true);
      toast({
        title: "Sync complete!",
        description: "Your data has been synchronized successfully.",
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

  const handleClose = () => {
    if (user) {
      // Mark as complete even if skipped
      localStorage.setItem(`sync-wizard-complete-${user.id}`, 'true');
    }
    onClose();
  };

  if (isComplete) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold">All Set!</h3>
              <p className="text-muted-foreground mt-2">
                Your data is now synced across your devices.
              </p>
            </div>
            <Button variant="glow" className="mt-4" onClick={handleClose}>
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            Welcome! Set Up Sync
          </DialogTitle>
          <DialogDescription>
            Choose how to sync your data between this device and the cloud
          </DialogDescription>
        </DialogHeader>

        {/* Local data summary */}
        {localStats && (localStats.providers > 0 || localStats.favorites > 0 || localStats.recents > 0) && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Smartphone className="w-4 h-4" />
              Local Data on This Device
            </div>
            <div className="flex flex-wrap gap-2">
              {localStats.providers > 0 && (
                <Badge variant="secondary">{localStats.providers} providers</Badge>
              )}
              {localStats.favorites > 0 && (
                <Badge variant="secondary">{localStats.favorites} favorites</Badge>
              )}
              {localStats.recents > 0 && (
                <Badge variant="secondary">{localStats.recents} recent</Badge>
              )}
            </div>
          </div>
        )}

        <RadioGroup
          value={strategy}
          onValueChange={(v) => setStrategy(v as SyncStrategy)}
          className="space-y-3"
        >
          {/* Upload local */}
          <div 
            className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              strategy === 'keep_local' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
            onClick={() => setStrategy('keep_local')}
          >
            <RadioGroupItem value="keep_local" id="keep_local" className="mt-1" />
            <Label htmlFor="keep_local" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-primary" />
                <span className="font-medium">Upload from This Device</span>
                <Badge variant="outline" className="text-xs">Recommended</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Upload your local providers, favorites, and settings to the cloud. 
                This will overwrite any existing cloud data.
              </p>
            </Label>
          </div>

          {/* Download from cloud */}
          <div 
            className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              strategy === 'keep_remote' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
            onClick={() => setStrategy('keep_remote')}
          >
            <RadioGroupItem value="keep_remote" id="keep_remote" className="mt-1" />
            <Label htmlFor="keep_remote" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-4 h-4 text-blue-500" />
                <span className="font-medium">Download from Cloud</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Replace local data with your cloud data. 
                Use this if you already have data saved from another device.
              </p>
            </Label>
          </div>

          {/* Merge */}
          <div 
            className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              strategy === 'merge' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
            onClick={() => setStrategy('merge')}
          >
            <RadioGroupItem value="merge" id="merge" className="mt-1" />
            <Label htmlFor="merge" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <Merge className="w-4 h-4 text-green-500" />
                <span className="font-medium">Merge Both</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Combine local and cloud data. Providers are merged by ID, 
                favorites are combined, and newest changes win on conflicts.
              </p>
            </Label>
          </div>
        </RadioGroup>

        {/* Security note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-sm">
          <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-muted-foreground">
            Your provider credentials are encrypted before syncing. 
            We never store your playlist URLs in plain text.
          </p>
        </div>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={handleClose} disabled={isSyncing}>
            Skip for Now
          </Button>
          <Button 
            variant="glow" 
            className="flex-1" 
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
                <Cloud className="w-4 h-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Check if user needs to see sync wizard (first login)
 */
export function needsSyncWizard(userId: string | undefined): boolean {
  if (!userId) return false;
  return localStorage.getItem(`sync-wizard-complete-${userId}`) !== 'true';
}
