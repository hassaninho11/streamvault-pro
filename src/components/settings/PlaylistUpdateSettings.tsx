/**
 * PlaylistUpdateSettings - Settings UI for playlist auto-update configuration
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  RefreshCw, 
  Clock, 
  Wifi, 
  Battery, 
  Moon,
  AlertCircle,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { useSettingsStore } from '@/data/stores/settingsStore';
import { playlistUpdateService, UpdateProgress, ProviderUpdateStatus } from '@/services/PlaylistUpdateService';
import { localStore, LocalProvider } from '@/data/stores/localStore';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const UPDATE_INTERVALS = [
  { value: '0', label: 'Av (endast manuellt)' },
  { value: '30', label: 'Var 30:e minut' },
  { value: '60', label: 'Varje timme' },
  { value: '180', label: 'Var 3:e timme' },
  { value: '360', label: 'Var 6:e timme' },
  { value: '720', label: 'Var 12:e timme' },
  { value: '1440', label: 'Varje dag' },
  { value: '10080', label: 'Varje vecka' },
];

export function PlaylistUpdateSettings() {
  const { draftSettings, updateDraft } = useSettingsStore();
  const [providers, setProviders] = useState<LocalProvider[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [statuses, setStatuses] = useState<Map<string, ProviderUpdateStatus>>(new Map());

  // Load providers and statuses
  useEffect(() => {
    const loadData = async () => {
      const loadedProviders = await localStore.getProviders();
      setProviders(loadedProviders);
      
      // Load existing statuses
      const statusMap = new Map<string, ProviderUpdateStatus>();
      playlistUpdateService.getAllStatuses().forEach(s => {
        statusMap.set(s.providerId, s);
      });
      setStatuses(statusMap);
    };
    loadData();
  }, []);

  // Subscribe to update events
  useEffect(() => {
    const unsubscribe = playlistUpdateService.subscribe((event, data) => {
      if (event === 'started') {
        setUpdating(data.providerId);
      } else if (event === 'progress') {
        setUpdateProgress(data as UpdateProgress);
      } else if (event === 'finished' || event === 'failed') {
        setUpdating(null);
        setUpdateProgress(null);
        setStatuses(prev => {
          const newMap = new Map(prev);
          newMap.set(data.providerId, data.status || {
            providerId: data.providerId,
            status: event === 'finished' ? 'success' : 'failed',
            lastError: data.error,
            lastErrorCode: data.errorCode,
          });
          return newMap;
        });
        
        // Reload providers to get updated lastSync
        localStore.getProviders().then(setProviders);
        
        if (event === 'finished') {
          toast.success('Spellistan uppdaterades!', {
            description: data.result ? 
              `${data.result.channelCount} kanaler, ${data.result.movieCount} filmer, ${data.result.seriesCount} serier` : 
              undefined,
          });
        } else {
          toast.error('Uppdatering misslyckades', {
            description: data.error,
          });
        }
      }
    });

    return unsubscribe;
  }, []);

  // Handle manual update
  const handleUpdateNow = async (providerId?: string) => {
    if (providerId) {
      await playlistUpdateService.updateProvider(providerId, 'manual');
    } else {
      const conditions = {
        wifiOnly: draftSettings.playlistUpdateWifiOnly ?? true,
        idleOnly: draftSettings.playlistUpdateIdleOnly ?? true,
        pauseLowBattery: draftSettings.playlistUpdatePauseLowBattery ?? true,
      };
      
      // Skip condition checks for manual updates
      for (const provider of providers) {
        if (provider.isActive) {
          await playlistUpdateService.updateProvider(provider.id, 'manual');
        }
      }
    }
  };

  // Get next update time
  const intervalMinutes = draftSettings.playlistUpdateIntervalMinutes ?? 0;
  const nextUpdate = playlistUpdateService.getNextScheduledTime(intervalMinutes);

  // Format last sync time
  const formatLastSync = (timestamp?: number) => {
    if (!timestamp) return 'Aldrig';
    return formatDistanceToNow(timestamp, { addSuffix: true, locale: sv });
  };

  // Get status badge for provider
  const getStatusBadge = (providerId: string) => {
    const status = statuses.get(providerId);
    if (!status) return null;

    if (status.status === 'running') {
      return <Badge variant="outline" className="bg-primary/10"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uppdaterar</Badge>;
    }
    if (status.status === 'success') {
      return <Badge variant="outline" className="bg-success/10 text-success"><Check className="w-3 h-3 mr-1" /> OK</Badge>;
    }
    if (status.status === 'failed') {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive">
          <X className="w-3 h-3 mr-1" /> 
          {status.lastErrorCode || 'Fel'}
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Update Interval */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Uppdatera spellista
          </CardTitle>
          <CardDescription>
            Konfigurera automatisk uppdatering av dina spellistor för att hålla kanalerna aktuella.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Interval Select */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label>Uppdateringsintervall</Label>
                <p className="text-sm text-muted-foreground">
                  Hur ofta spellistorna ska uppdateras automatiskt
                </p>
              </div>
            </div>
            <Select 
              value={String(draftSettings.playlistUpdateIntervalMinutes ?? 0)}
              onValueChange={(v) => updateDraft('playlistUpdateIntervalMinutes', Number(v))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPDATE_INTERVALS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Separator />

          {/* Conditions */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Villkor</h4>
            
            {/* Wi-Fi Only */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wifi className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label>Endast på Wi-Fi</Label>
                  <p className="text-xs text-muted-foreground">
                    Spara mobildata genom att endast uppdatera på Wi-Fi
                  </p>
                </div>
              </div>
              <Switch
                checked={draftSettings.playlistUpdateWifiOnly ?? true}
                onCheckedChange={(v) => updateDraft('playlistUpdateWifiOnly', v)}
              />
            </div>

            {/* Idle Only */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label>Endast när appen inte används</Label>
                  <p className="text-xs text-muted-foreground">
                    Uppdatera i bakgrunden när du inte tittar aktivt
                  </p>
                </div>
              </div>
              <Switch
                checked={draftSettings.playlistUpdateIdleOnly ?? true}
                onCheckedChange={(v) => updateDraft('playlistUpdateIdleOnly', v)}
              />
            </div>

            {/* Low Battery */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Battery className="w-4 h-4 text-muted-foreground" />
                <div>
                  <Label>Pausa vid lågt batteri</Label>
                  <p className="text-xs text-muted-foreground">
                    Hoppa över uppdatering om batterinivån är under 20%
                  </p>
                </div>
              </div>
              <Switch
                checked={draftSettings.playlistUpdatePauseLowBattery ?? true}
                onCheckedChange={(v) => updateDraft('playlistUpdatePauseLowBattery', v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Update & Status */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Manuell uppdatering</CardTitle>
          <CardDescription>
            Uppdatera spellistorna direkt utan att vänta på nästa schemalagda uppdatering.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Update All Button */}
          <Button 
            variant="glow" 
            className="w-full"
            onClick={() => handleUpdateNow()}
            disabled={updating !== null || providers.length === 0}
          >
            {updating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uppdaterar...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Uppdatera nu
              </>
            )}
          </Button>

          {/* Progress */}
          {updateProgress && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between text-sm">
                <span>{updateProgress.message}</span>
                <span className="text-muted-foreground">{updateProgress.progress}%</span>
              </div>
              <Progress value={updateProgress.progress} className="h-2" />
            </div>
          )}

          <Separator />

          {/* Provider List with Status */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Leverantörsstatus</h4>
            
            {providers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Inga leverantörer konfigurerade
              </p>
            ) : (
              providers.map(provider => (
                <div 
                  key={provider.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg",
                    "bg-muted/30 hover:bg-muted/50 transition-colors"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{provider.name}</p>
                      {getStatusBadge(provider.id)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Senast uppdaterad: {formatLastSync(provider.lastSync)}
                    </p>
                    {statuses.get(provider.id)?.lastError && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        {statuses.get(provider.id)?.lastError}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleUpdateNow(provider.id)}
                    disabled={updating === provider.id}
                  >
                    {updating === provider.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Schedule Info */}
          {intervalMinutes > 0 && (
            <>
              <Separator />
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Nästa schemalagda uppdatering:</span>
                  <span className="font-medium text-foreground">
                    {nextUpdate ? format(nextUpdate, 'HH:mm', { locale: sv }) : 'Ej schemalagd'}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Info Box */}
      <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Information
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Uppdateringar körs i bakgrunden utan att störa din visning</li>
          <li>Dina favoriter och senast tittade sparas vid uppdatering</li>
          <li>Vid fel visas felorsaken så du kan åtgärda problemet</li>
          <li>På Android körs bakgrundsuppdateringar även när appen är stängd</li>
        </ul>
      </div>
    </div>
  );
}
