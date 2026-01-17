import { useState } from "react";
import { Plus, MoreVertical, Trash2, Edit, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
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
import { useProviders, CreateProviderData } from "@/hooks/useProviders";

export default function ProvidersPage() {
  const { providers, loading, addProvider, deleteProvider, refreshProvider } = useProviders();
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddProvider = async (data: ProviderFormData) => {
    const providerData: CreateProviderData = {
      name: data.name,
      type: data.type === "xtream" ? "xtream" : "m3u",
      m3u_url: data.m3uUrl,
      xtream_host: data.xtreamHost,
      xtream_user: data.xtreamUser,
      xtream_pass: data.xtreamPass,
      epg_url: data.epgUrl,
    };

    const success = await addProvider(providerData);
    if (success) {
      setShowAddForm(false);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    await deleteProvider(id);
  };

  const handleRefreshProvider = async (id: string) => {
    await refreshProvider(id);
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

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : providers.length === 0 ? (
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
                        {provider.is_active ? (
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
                      <p className="font-semibold">{provider.channel_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Sync</p>
                      <p className="font-semibold">
                        {provider.last_sync
                          ? new Date(provider.last_sync).toLocaleString()
                          : "Never"}
                      </p>
                    </div>
                  </div>
                  {/* Security: Never show full URL */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-success" />
                        Credentials encrypted
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
