import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Server, Link, RefreshCw, AlertCircle, Check, Tv, Film, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Provider } from "@/hooks/useProviders";

type ConnectionStatus = "idle" | "testing" | "success" | "error";

interface ContentCounts {
  live: number;
  movies: number;
  series: number;
}

interface EditProviderDialogProps {
  provider: Provider | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (providerId: string, data: EditProviderData) => Promise<boolean>;
}

export interface EditProviderData {
  name: string;
  m3u_url?: string;
  xtream_host?: string;
  xtream_user?: string;
  xtream_pass?: string; // New password if user wants to change it
  epg_url?: string;
}

export function EditProviderDialog({ provider, open, onOpenChange, onSave }: EditProviderDialogProps) {
  const [name, setName] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [xtreamHost, setXtreamHost] = useState("");
  const [xtreamUser, setXtreamUser] = useState("");
  const [xtreamPass, setXtreamPass] = useState("");
  const [epgUrl, setEpgUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [contentCounts, setContentCounts] = useState<ContentCounts | null>(null);
  
  // Reset form when provider changes
  useEffect(() => {
    if (provider) {
      setName(provider.name);
      setM3uUrl(""); // Don't show existing URL for security
      setXtreamHost(""); // Don't show existing host for security
      setXtreamUser(""); // Don't show existing user for security
      setXtreamPass("");
      setEpgUrl(""); // Don't show existing EPG URL for security
      setConnectionStatus("idle");
      setErrorMessage("");
      setSuccessMessage("");
      setContentCounts(null);
    }
  }, [provider]);
  
  const resetConnectionState = useCallback(() => {
    setConnectionStatus("idle");
    setErrorMessage("");
    setSuccessMessage("");
    setContentCounts(null);
  }, []);

  const testConnection = async () => {
    if (!provider) return;
    
    setConnectionStatus("testing");
    setErrorMessage("");
    setSuccessMessage("");
    setContentCounts(null);

    try {
      if (provider.type === "xtream") {
        // For Xtream, we need new credentials
        if (!xtreamHost || !xtreamUser || !xtreamPass) {
          setConnectionStatus("error");
          setErrorMessage("Fyll i alla Xtream-uppgifter för att testa anslutningen");
          return;
        }
        
        const cleanHost = xtreamHost.replace(/\/+$/, '');
        
        const [liveResult, vodResult, seriesResult] = await Promise.all([
          supabase.functions.invoke('playlist-proxy', {
            body: { 
              host: cleanHost, 
              username: xtreamUser, 
              password: xtreamPass, 
              type: 'xtream_live' 
            }
          }),
          supabase.functions.invoke('playlist-proxy', {
            body: { 
              host: cleanHost, 
              username: xtreamUser, 
              password: xtreamPass, 
              type: 'xtream_vod' 
            }
          }),
          supabase.functions.invoke('playlist-proxy', {
            body: { 
              host: cleanHost, 
              username: xtreamUser, 
              password: xtreamPass, 
              type: 'xtream_series' 
            }
          }),
        ]);

        if (liveResult.error) {
          throw new Error(liveResult.error.message || 'Anslutning misslyckades');
        }
        if (!liveResult.data?.success) {
          throw new Error(liveResult.data?.error || 'Anslutning misslyckades');
        }

        const counts: ContentCounts = {
          live: Array.isArray(liveResult.data?.data) ? liveResult.data.data.length : 0,
          movies: Array.isArray(vodResult.data?.data) ? vodResult.data.data.length : 0,
          series: Array.isArray(seriesResult.data?.data) ? seriesResult.data.data.length : 0,
        };

        setContentCounts(counts);
        setConnectionStatus("success");
        setSuccessMessage("Anslutning lyckades!");
      } else {
        // M3U URL
        if (!m3uUrl) {
          setConnectionStatus("error");
          setErrorMessage("Ange en M3U-URL för att testa anslutningen");
          return;
        }

        const result = await supabase.functions.invoke('playlist-proxy', {
          body: { url: m3uUrl, type: 'test' }
        });
        
        if (result.error) {
          throw new Error(result.error.message || 'Anslutning misslyckades');
        }
        
        if (!result.data?.success) {
          throw new Error(result.data?.error || 'Anslutning misslyckades');
        }

        if (result.data?.isValidPlaylist) {
          setConnectionStatus("success");
          setContentCounts({ live: result.data.channelCount || 0, movies: 0, series: 0 });
          setSuccessMessage("Anslutning lyckades!");
        } else {
          setConnectionStatus("error");
          setErrorMessage("Svaret verkar inte vara en giltig M3U-spellista");
        }
      }
    } catch (error) {
      setConnectionStatus("error");
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Anslutningen misslyckades");
      }
    }
  };

  const handleSave = async () => {
    if (!provider) return;
    
    setSaving(true);
    
    const data: EditProviderData = {
      name,
    };
    
    // Only include credentials if user provided new ones
    if (provider.type === "xtream") {
      if (xtreamHost) data.xtream_host = xtreamHost;
      if (xtreamUser) data.xtream_user = xtreamUser;
      if (xtreamPass) data.xtream_pass = xtreamPass;
    } else {
      if (m3uUrl) data.m3u_url = m3uUrl;
    }
    
    if (epgUrl) data.epg_url = epgUrl;
    
    const success = await onSave(provider.id, data);
    setSaving(false);
    
    if (success) {
      onOpenChange(false);
    }
  };

  const isFormValid = () => {
    return name.trim().length > 0;
  };
  
  const hasNewCredentials = () => {
    if (provider?.type === "xtream") {
      return xtreamHost || xtreamUser || xtreamPass;
    }
    return !!m3uUrl;
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Redigera leverantör</DialogTitle>
          <DialogDescription>
            Uppdatera namn eller källa för "{provider.name}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Provider Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Namn</Label>
            <Input
              id="edit-name"
              placeholder="Min IPTV-leverantör"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Source update section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Uppdatera källa</Label>
              <span className="text-xs text-muted-foreground">
                {provider.type === "xtream" ? "Xtream Codes" : "M3U URL"}
              </span>
            </div>
            
            <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground mb-3">
                Av säkerhetsskäl visas inte befintliga uppgifter. Fyll i nya uppgifter nedan för att uppdatera källan.
              </p>
              
              {provider.type === "xtream" ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-xtream-host" className="text-xs">Server URL</Label>
                    <Input
                      id="edit-xtream-host"
                      type="url"
                      placeholder="http://example.com:8080"
                      value={xtreamHost}
                      onChange={(e) => { setXtreamHost(e.target.value); resetConnectionState(); }}
                      className="h-9"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-xtream-user" className="text-xs">Användarnamn</Label>
                      <Input
                        id="edit-xtream-user"
                        placeholder="username"
                        value={xtreamUser}
                        onChange={(e) => { setXtreamUser(e.target.value); resetConnectionState(); }}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-xtream-pass" className="text-xs">Lösenord</Label>
                      <Input
                        id="edit-xtream-pass"
                        type="password"
                        placeholder="••••••••"
                        value={xtreamPass}
                        onChange={(e) => { setXtreamPass(e.target.value); resetConnectionState(); }}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-m3u-url" className="text-xs">M3U/M3U8 URL</Label>
                  <Input
                    id="edit-m3u-url"
                    type="url"
                    placeholder="https://example.com/playlist.m3u"
                    value={m3uUrl}
                    onChange={(e) => { setM3uUrl(e.target.value); resetConnectionState(); }}
                    className="h-9"
                  />
                </div>
              )}
              
              {/* EPG URL */}
              <div className="space-y-1.5 mt-3">
                <Label htmlFor="edit-epg-url" className="text-xs">
                  EPG URL <span className="text-muted-foreground">(valfritt)</span>
                </Label>
                <Input
                  id="edit-epg-url"
                  type="url"
                  placeholder="https://example.com/epg.xml"
                  value={epgUrl}
                  onChange={(e) => setEpgUrl(e.target.value)}
                  className="h-9"
                />
              </div>
              
              {/* Test connection button */}
              {hasNewCredentials() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={testConnection}
                  disabled={connectionStatus === "testing"}
                >
                  {connectionStatus === "testing" ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Testar...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3 mr-2" />
                      Testa anslutning
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Connection Status */}
          {connectionStatus !== "idle" && connectionStatus !== "testing" && (
            <div
              className={cn(
                "p-3 rounded-lg space-y-2",
                connectionStatus === "success" && "bg-success/10",
                connectionStatus === "error" && "bg-destructive/10"
              )}
            >
              <div className={cn(
                "flex items-center gap-2 text-sm",
                connectionStatus === "success" && "text-success",
                connectionStatus === "error" && "text-destructive"
              )}>
                {connectionStatus === "success" && (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{successMessage}</span>
                  </>
                )}
                {connectionStatus === "error" && (
                  <>
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </>
                )}
              </div>
              
              {/* Content counts breakdown */}
              {contentCounts && connectionStatus === "success" && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Tv className="w-3 h-3 text-blue-500" />
                    <span className="text-muted-foreground">Live:</span>
                    <span className="font-semibold">{contentCounts.live.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Film className="w-3 h-3 text-purple-500" />
                    <span className="text-muted-foreground">Filmer:</span>
                    <span className="font-semibold">{contentCounts.movies.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clapperboard className="w-3 h-3 text-orange-500" />
                    <span className="text-muted-foreground">Serier:</span>
                    <span className="font-semibold">{contentCounts.series.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!isFormValid() || saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Spara
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}