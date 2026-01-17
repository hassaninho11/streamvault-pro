import { useState } from "react";
import { Plus, MoreVertical, Trash2, Edit, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddProviderForm, ProviderFormData } from "@/components/providers/AddProviderForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/custom";
import { Provider } from "@/types/iptv";
import { toast } from "sonner";

const initialProviders: Provider[] = [
  {
    id: "1",
    userId: "user1",
    name: "My IPTV Provider",
    type: "m3u",
    m3uUrl: "https://example.com/playlist.m3u",
    epgUrl: "https://example.com/epg.xml",
    lastSync: new Date(Date.now() - 1000 * 60 * 60 * 2),
    channelCount: 156,
    isActive: true,
  },
];

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddProvider = (data: ProviderFormData) => {
    const newProvider: Provider = {
      id: Date.now().toString(),
      userId: "user1",
      name: data.name,
      type: data.type === "xtream" ? "xtream" : "m3u",
      m3uUrl: data.m3uUrl,
      xtreamHost: data.xtreamHost,
      xtreamUser: data.xtreamUser,
      epgUrl: data.epgUrl,
      lastSync: new Date(),
      channelCount: 0,
      isActive: true,
    };

    setProviders((prev) => [...prev, newProvider]);
    setShowAddForm(false);
    toast.success("Provider added successfully!");
  };

  const handleDeleteProvider = (id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
    toast.success("Provider removed");
  };

  const handleRefreshProvider = (id: string) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, lastSync: new Date() } : p
      )
    );
    toast.success("Provider refreshed");
  };

  if (showAddForm) {
    return (
      <AppLayout>
        <div className="p-6">
          <AddProviderForm
            onSubmit={handleAddProvider}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Providers</h1>
          <Button variant="glow" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Provider
          </Button>
        </div>

        {providers.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No providers yet"
            description="Add your first IPTV provider to start watching"
            action={
              <Button variant="glow" onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Provider
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((provider) => (
              <Card key={provider.id} variant="glass">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        {provider.isActive ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : (
                          <XCircle className="w-5 h-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{provider.name}</CardTitle>
                        <p className="text-xs text-muted-foreground uppercase">
                          {provider.type}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRefreshProvider(provider.id)}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteProvider(provider.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Channels</p>
                      <p className="font-semibold">{provider.channelCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Sync</p>
                      <p className="font-semibold">
                        {provider.lastSync
                          ? new Date(provider.lastSync).toLocaleString()
                          : "Never"}
                      </p>
                    </div>
                  </div>
                  {provider.m3uUrl && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground truncate">
                        {provider.m3uUrl}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
