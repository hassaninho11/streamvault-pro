import { useState, useCallback } from "react";
import { Plus, Link, Upload, Server, Globe, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type ProviderType = "m3u-url" | "m3u-file" | "xtream";
type ConnectionStatus = "idle" | "testing" | "success" | "error";

interface AddProviderFormProps {
  onSubmit: (data: ProviderFormData) => void;
  onCancel?: () => void;
}

export interface ProviderFormData {
  name: string;
  type: ProviderType;
  m3uUrl?: string;
  m3uFile?: File;
  xtreamHost?: string;
  xtreamUser?: string;
  xtreamPass?: string;
  epgUrl?: string;
}

export function AddProviderForm({ onSubmit, onCancel }: AddProviderFormProps) {
  const [activeTab, setActiveTab] = useState<ProviderType>("m3u-url");
  const [formData, setFormData] = useState<ProviderFormData>({
    name: "",
    type: "m3u-url",
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const updateForm = useCallback((updates: Partial<ProviderFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setConnectionStatus("idle");
    setErrorMessage("");
    setSuccessMessage("");
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value as ProviderType);
    updateForm({ type: value as ProviderType });
  };

  const testConnection = async () => {
    setConnectionStatus("testing");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let testUrl = '';
      
      if (activeTab === "m3u-url" && formData.m3uUrl) {
        testUrl = formData.m3uUrl;
      } else if (activeTab === "xtream" && formData.xtreamHost && formData.xtreamUser && formData.xtreamPass) {
        const cleanHost = formData.xtreamHost.replace(/\/+$/, '');
        testUrl = `${cleanHost}/get.php?username=${encodeURIComponent(formData.xtreamUser)}&password=${encodeURIComponent(formData.xtreamPass)}&type=m3u_plus&output=ts`;
      } else {
        setConnectionStatus("error");
        setErrorMessage("Please fill in all required fields");
        return;
      }

      // Try edge function proxy first
      let data;
      let proxyFailed = false;
      
      try {
        const result = await supabase.functions.invoke('playlist-proxy', {
          body: { url: testUrl, type: 'test' }
        });
        
        if (result.error) {
          throw new Error(result.error.message || 'Proxy failed');
        }
        
        // Check if it's a DNS error - if so, try direct fetch
        if (result.data?.error && (
          result.data.error.includes('DNS') || 
          result.data.error.includes('dns') ||
          result.data.error.includes('could not be found')
        )) {
          console.log('[AddProviderForm] Proxy DNS error, trying direct fetch...');
          proxyFailed = true;
        } else if (!result.data?.success) {
          throw new Error(result.data?.error || 'Connection failed');
        } else {
          data = result.data;
        }
      } catch (proxyError) {
        console.log('[AddProviderForm] Proxy failed, trying direct fetch...', proxyError);
        proxyFailed = true;
      }
      
      // Fallback: try direct fetch (works if CORS allows or same-origin)
      if (proxyFailed) {
        try {
          console.log('[AddProviderForm] Attempting direct fetch for:', testUrl.substring(0, 50) + '...');
          const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/x-mpegURL, audio/mpegurl, text/plain, */*',
            },
          });
          
          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }
          
          const content = await response.text();
          const isM3U = content.includes('#EXTM3U') || content.includes('#EXTINF');
          const channelMatches = content.match(/#EXTINF/g);
          const channelCount = channelMatches?.length || 0;
          
          data = {
            success: true,
            isValidPlaylist: isM3U,
            channelCount,
            contentLength: content.length,
            directFetch: true,
          };
          
          console.log('[AddProviderForm] Direct fetch successful:', data);
        } catch (directError) {
          console.error('[AddProviderForm] Direct fetch also failed:', directError);
          
          // Check if it's a mixed content / CORS issue
          const isHttpUrl = testUrl.startsWith('http://');
          const isSecurePage = window.location.protocol === 'https:';
          
          if (isHttpUrl && isSecurePage) {
            // Allow saving anyway with a warning
            setConnectionStatus("error");
            setErrorMessage(
              'Cannot verify connection: Your browser blocks HTTP requests from secure pages. ' +
              'You can still save this provider - streams may work with an external player or custom proxy.'
            );
            // Mark as saveable despite error
            setSuccessMessage('_allow_save_');
            return;
          }
          
          // Generic error
          throw new Error(
            'Could not connect to the playlist server. ' +
            'The server may be temporarily unavailable or blocking connections.'
          );
        }
      }

      if (data?.isValidPlaylist) {
        setConnectionStatus("success");
        setSuccessMessage(
          data.channelCount > 0 
            ? `Found ${data.channelCount.toLocaleString()} channels${data.directFetch ? ' (direct)' : ''}` 
            : "Connection successful!"
        );
      } else {
        setConnectionStatus("error");
        setErrorMessage("Response doesn't appear to be a valid M3U playlist");
      }
    } catch (error) {
      setConnectionStatus("error");
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Connection failed");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Allow submit if success, or if we marked it as saveable despite error (HTTP on HTTPS)
    const canSaveAnyway = successMessage === '_allow_save_';
    if (connectionStatus === "success" || activeTab === "m3u-file" || canSaveAnyway) {
      onSubmit(formData);
    }
  };

  const canSaveWithWarning = connectionStatus === "error" && successMessage === '_allow_save_';

  const isFormValid = () => {
    if (!formData.name) return false;
    switch (activeTab) {
      case "m3u-url":
        return !!formData.m3uUrl;
      case "m3u-file":
        return !!formData.m3uFile;
      case "xtream":
        return !!formData.xtreamHost && !!formData.xtreamUser && !!formData.xtreamPass;
      default:
        return false;
    }
  };

  return (
    <Card variant="glass" className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" />
          Add Provider
        </CardTitle>
        <CardDescription>
          Add your IPTV playlist source to start watching
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Provider Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Provider Name</Label>
            <Input
              id="name"
              placeholder="My IPTV Provider"
              value={formData.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              variant="glass"
            />
          </div>

          {/* Provider Type Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="m3u-url" className="flex items-center gap-2">
                <Link className="w-4 h-4" />
                <span className="hidden sm:inline">M3U URL</span>
              </TabsTrigger>
              <TabsTrigger value="m3u-file" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
              </TabsTrigger>
              <TabsTrigger value="xtream" className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                <span className="hidden sm:inline">Xtream</span>
              </TabsTrigger>
            </TabsList>

            {/* M3U URL Tab */}
            <TabsContent value="m3u-url" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="m3uUrl">M3U/M3U8 URL</Label>
                <Input
                  id="m3uUrl"
                  type="url"
                  placeholder="https://example.com/playlist.m3u"
                  value={formData.m3uUrl || ""}
                  onChange={(e) => updateForm({ m3uUrl: e.target.value })}
                  variant="glass"
                />
              </div>
            </TabsContent>

            {/* M3U File Tab */}
            <TabsContent value="m3u-file" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Upload M3U File</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept=".m3u,.m3u8"
                    className="hidden"
                    id="m3u-file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) updateForm({ m3uFile: file });
                    }}
                  />
                  <label htmlFor="m3u-file-input" className="cursor-pointer">
                    <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    {formData.m3uFile ? (
                      <p className="text-sm font-medium">{formData.m3uFile.name}</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium">Drop your M3U file here</p>
                        <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </TabsContent>

            {/* Xtream Codes Tab */}
            <TabsContent value="xtream" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="xtreamHost">Server URL</Label>
                <Input
                  id="xtreamHost"
                  type="url"
                  placeholder="http://example.com:8080"
                  value={formData.xtreamHost || ""}
                  onChange={(e) => updateForm({ xtreamHost: e.target.value })}
                  variant="glass"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="xtreamUser">Username</Label>
                  <Input
                    id="xtreamUser"
                    placeholder="username"
                    value={formData.xtreamUser || ""}
                    onChange={(e) => updateForm({ xtreamUser: e.target.value })}
                    variant="glass"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="xtreamPass">Password</Label>
                  <Input
                    id="xtreamPass"
                    type="password"
                    placeholder="••••••••"
                    value={formData.xtreamPass || ""}
                    onChange={(e) => updateForm({ xtreamPass: e.target.value })}
                    variant="glass"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* EPG URL (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="epgUrl">
              EPG URL <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="epgUrl"
              type="url"
              placeholder="https://example.com/epg.xml"
              value={formData.epgUrl || ""}
              onChange={(e) => updateForm({ epgUrl: e.target.value })}
              variant="glass"
            />
          </div>

          {/* Connection Status */}
          {connectionStatus !== "idle" && (
            <div
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg",
                connectionStatus === "testing" && "bg-muted",
                connectionStatus === "success" && "bg-success/10 text-success",
                connectionStatus === "error" && "bg-destructive/10 text-destructive"
              )}
            >
              {connectionStatus === "testing" && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Testing connection...</span>
                </>
              )}
              {connectionStatus === "success" && (
                <>
                  <Check className="w-4 h-4" />
                  <span className="text-sm">{successMessage || "Connection successful!"}</span>
                </>
              )}
              {connectionStatus === "error" && (
                <>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{errorMessage}</span>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {activeTab !== "m3u-file" && (
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={!isFormValid() || connectionStatus === "testing"}
              >
                <Globe className="w-4 h-4 mr-2" />
                Test Connection
              </Button>
            )}
            <Button
              type="submit"
              variant={canSaveWithWarning ? "outline" : "glow"}
              disabled={!isFormValid() || (activeTab !== "m3u-file" && connectionStatus !== "success" && !canSaveWithWarning)}
              className="ml-auto"
            >
              {canSaveWithWarning ? "Save Anyway" : "Add Provider"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
