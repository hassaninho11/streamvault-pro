import { useState, useCallback } from "react";
import { Plus, Link, Upload, Server, Globe, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

  const updateForm = useCallback((updates: Partial<ProviderFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setConnectionStatus("idle");
    setErrorMessage("");
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value as ProviderType);
    updateForm({ type: value as ProviderType });
  };

  const testConnection = async () => {
    setConnectionStatus("testing");
    setErrorMessage("");

    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // For demo, check if URL looks valid
    if (activeTab === "m3u-url" && formData.m3uUrl) {
      if (formData.m3uUrl.includes(".m3u") || formData.m3uUrl.includes("get.php")) {
        setConnectionStatus("success");
      } else {
        setConnectionStatus("error");
        setErrorMessage("Invalid M3U URL format");
      }
    } else if (activeTab === "xtream" && formData.xtreamHost) {
      if (formData.xtreamHost.startsWith("http")) {
        setConnectionStatus("success");
      } else {
        setConnectionStatus("error");
        setErrorMessage("Host must start with http:// or https://");
      }
    } else {
      setConnectionStatus("error");
      setErrorMessage("Please fill in all required fields");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (connectionStatus === "success" || activeTab === "m3u-file") {
      onSubmit(formData);
    }
  };

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
                  <span className="text-sm">Connection successful!</span>
                </>
              )}
              {connectionStatus === "error" && (
                <>
                  <AlertCircle className="w-4 h-4" />
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
              variant="glow"
              disabled={!isFormValid() || (activeTab !== "m3u-file" && connectionStatus !== "success")}
              className="ml-auto"
            >
              Add Provider
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
