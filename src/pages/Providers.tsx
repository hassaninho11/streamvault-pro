import { useState } from "react";
import { Plus, MoreVertical, Trash2, Edit, RefreshCw, CheckCircle2, XCircle, Loader2, Film, Tv } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddProviderForm, ProviderFormData } from "@/components/providers/AddProviderForm";
import { EditProviderDialog, EditProviderData } from "@/components/providers/EditProviderDialog";
import { ImportSummaryModal } from "@/components/import/ImportSummaryModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui/custom";
import { useProviders, CreateProviderData, Provider } from "@/hooks/useProviders";
import { useVodStore } from "@/data/stores/vodStore";
import { playlistService } from "@/services/PlaylistService";
import { toast } from "sonner";
import type { ImportSummary } from "@/services/ImportService";

export default function ProvidersPage() {
  const { providers, loading, addProvider, updateProvider, deleteProvider, refreshProvider, refetch } = useProviders();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  
  // Get VOD counts from store
  const { movies, series } = useVodStore();

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

  const handleEditProvider = async (providerId: string, data: EditProviderData): Promise<boolean> => {
    try {
      // First, update the provider metadata
      const updates: Record<string, unknown> = {
        name: data.name,
      };
      
      if (data.epg_url) {
        updates.epg_url = data.epg_url;
      }
      
      // If new source credentials are provided, update and re-import
      const hasNewSource = data.m3u_url || (data.xtream_host && data.xtream_user && data.xtream_pass);
      
      if (hasNewSource) {
        // Update source credentials
        if (data.m3u_url) {
          updates.m3u_url = data.m3u_url;
        }
        if (data.xtream_host) {
          updates.xtream_host = data.xtream_host;
        }
        if (data.xtream_user) {
          updates.xtream_user = data.xtream_user;
        }
        if (data.xtream_pass) {
          updates.xtream_pass_encrypted = data.xtream_pass;
        }
      }
      
      // Apply metadata updates
      await updateProvider(providerId, updates as Parameters<typeof updateProvider>[1]);
      
      const provider = providers.find(p => p.id === providerId);
      
      // If new source, re-import channels
      if (hasNewSource) {
        toast.loading("Importerar kanaler från ny källa...", { id: "reimport-channels" });
        
        let result;
        
        if (data.xtream_host && data.xtream_user && data.xtream_pass) {
          result = await playlistService.loadXtreamPlaylist(
            data.xtream_host,
            data.xtream_user,
            data.xtream_pass,
            providerId
          );
        } else if (data.m3u_url) {
          result = await playlistService.loadM3UPlaylist(data.m3u_url, providerId);
        }
        
        toast.dismiss("reimport-channels");
        
        if (result?.success) {
          await updateProvider(providerId, { 
            channel_count: result.channelCount,
            last_sync: new Date().toISOString(),
          });
          
          // Get VOD counts for summary
          const providerMovies = movies.filter(m => m.providerId === providerId).length;
          const providerSeries = series.filter(s => s.providerId === providerId).length;
          
          // Show import summary modal
          setImportSummary({
            success: true,
            providerId,
            providerName: provider?.name || data.name,
            stats: {
              total: result.channelCount + providerMovies + providerSeries,
              liveCount: result.channelCount,
              movieCount: providerMovies,
              seriesCount: providerSeries,
              episodeCount: 0, // We don't have this info from this flow
              seasonCount: 0,
              unknownCount: 0,
              parseTimeMs: 0,
              processTimeMs: 0,
            }
          });
        } else if (result) {
          setImportSummary({
            success: false,
            providerId,
            providerName: provider?.name || data.name,
            error: result.error || 'Import misslyckades',
            stats: {
              total: 0,
              liveCount: 0,
              movieCount: 0,
              seriesCount: 0,
              episodeCount: 0,
              seasonCount: 0,
              unknownCount: 0,
              parseTimeMs: 0,
              processTimeMs: 0,
            }
          });
        }
      }
      
      await refetch();
      return true;
    } catch (err) {
      console.error("Error editing provider:", err);
      toast.error("Kunde inte uppdatera leverantören");
      return false;
    }
  };

  const handleDeleteProvider = async () => {
    if (!providerToDelete) return;
    await deleteProvider(providerToDelete.id);
    setProviderToDelete(null);
  };

  const handleRefreshProvider = async (id: string) => {
    await refreshProvider(id);
  };
  
  // Get VOD counts per provider
  const getProviderVodCounts = (providerId: string) => {
    const providerMovies = movies.filter(m => m.providerId === providerId).length;
    const providerSeries = series.filter(s => s.providerId === providerId).length;
    return { movies: providerMovies, series: providerSeries };
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
          <h1 className="text-2xl font-bold">Leverantörer</h1>
          <Button variant="glow" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Lägg till
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : providers.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="Inga leverantörer ännu"
            description="Lägg till din första IPTV-leverantör för att börja titta"
            action={
              <Button variant="glow" onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Lägg till
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((provider) => {
              const vodCounts = getProviderVodCounts(provider.id);
              
              return (
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
                            Uppdatera
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingProvider(provider)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Redigera
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setProviderToDelete(provider)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Ta bort
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Live TV</p>
                        <p className="font-semibold">{provider.channel_count || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs flex items-center gap-1">
                          <Film className="w-3 h-3" />
                          Filmer
                        </p>
                        <p className="font-semibold">{vodCounts.movies}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs flex items-center gap-1">
                          <Tv className="w-3 h-3" />
                          Serier
                        </p>
                        <p className="font-semibold">{vodCounts.series}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Synk</p>
                        <p className="font-semibold text-xs">
                          {provider.last_sync
                            ? new Date(provider.last_sync).toLocaleDateString('sv-SE')
                            : "Aldrig"}
                        </p>
                      </div>
                    </div>
                    {/* Security: Never show full URL */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-success" />
                          Krypterade inloggningsuppgifter
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        
        {/* Edit Provider Dialog */}
        <EditProviderDialog
          provider={editingProvider}
          open={editingProvider !== null}
          onOpenChange={(open) => {
            if (!open) setEditingProvider(null);
          }}
          onSave={handleEditProvider}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={providerToDelete !== null} onOpenChange={(open) => !open && setProviderToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ta bort leverantör?</AlertDialogTitle>
              <AlertDialogDescription>
                Är du säker på att du vill ta bort <strong>{providerToDelete?.name}</strong>? 
                Detta kommer att radera alla kanaler, favoriter och historik kopplat till denna leverantör. 
                Denna åtgärd kan inte ångras.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteProvider}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Ta bort
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Import Summary Modal */}
        <ImportSummaryModal
          summary={importSummary}
          open={importSummary !== null}
          onClose={() => setImportSummary(null)}
        />
      </div>
    </AppLayout>
  );
}
