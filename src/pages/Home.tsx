import { useMemo } from "react";
import { 
  Play, 
  Star, 
  Clock, 
  Tv, 
  Plus, 
  ChevronRight, 
  Zap,
  TrendingUp,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChannelLogo, LiveIndicator } from "@/components/ui/custom";
import { AppLayout } from "@/components/layout/AppLayout";
import { APP_CONFIG } from "@/config/app";
import { useChannelLoader } from "@/hooks/useChannelLoader";
import { useChannelStore, useFilteredChannelIds, useFavoriteIds } from "@/data/stores/channelStore";
import { useProviders } from "@/hooks/useProviders";
import { useRecentlyWatched } from "@/hooks/useRecentlyWatched";

export default function HomePage() {
  const navigate = useNavigate();
  const { isLoading, channelCount, providerCount } = useChannelLoader();
  const { providers } = useProviders();
  const { recentlyWatched } = useRecentlyWatched();
  const recentIds = recentlyWatched?.map(r => r.channel_id) ?? [];
  const favoriteIds = useFavoriteIds();
  const index = useChannelStore((state) => state.index);
  const nowNextMap = useChannelStore((state) => state.nowNextMap);

  // Get channel data from store
  const getChannel = (id: string) => index?.byId.get(id);

  // Get recent channels (up to 4)
  const recentChannels = useMemo(() => {
    if (!index) return [];
    return recentIds
      .slice(0, 4)
      .map(id => index.byId.get(id))
      .filter(Boolean) as Array<NonNullable<ReturnType<typeof getChannel>>>;
  }, [recentIds, index]);

  // Get favorite channels (up to 6)
  const favoriteChannels = useMemo(() => {
    if (!index) return [];
    return Array.from(favoriteIds)
      .slice(0, 6)
      .map(id => index.byId.get(id))
      .filter(Boolean) as Array<NonNullable<ReturnType<typeof getChannel>>>;
  }, [favoriteIds, index]);

  // If no providers, show welcome screen
  if (!isLoading && providers.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6 shadow-glow-lg animate-pulse-glow">
            <Zap className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-center">Welcome to {APP_CONFIG.name}</h1>
          <p className="text-muted-foreground text-center mb-8 max-w-md">
            Add your first IPTV provider to start watching your favorite channels
          </p>
          <Button variant="glow" size="lg" onClick={() => navigate("/providers")}>
            <Plus className="w-5 h-5 mr-2" />
            Add Provider
          </Button>
          
          <div className="mt-12 p-6 rounded-xl bg-muted/30 border border-border max-w-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Tv className="w-5 h-5 text-primary" />
              Supported Sources
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• M3U/M3U8 playlist URLs</li>
              <li>• M3U file upload</li>
              <li>• Xtream Codes credentials</li>
              <li>• XMLTV EPG guides</li>
            </ul>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading channels...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-8">
        {/* Hero Section - Continue Watching */}
        {recentChannels.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Continue Watching
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/recent")}>
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {recentChannels.map((channel) => {
                const epgData = nowNextMap.get(channel.id);
                return (
                  <Card 
                    key={channel.id} 
                    variant="interactive"
                    className="group"
                    onClick={() => navigate(`/live?channel=${channel.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="relative aspect-video rounded-lg bg-muted/50 mb-3 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ChannelLogo src={channel.logoUrl} name={channel.name} size="lg" />
                        </div>
                        <div className="absolute top-2 right-2">
                          <LiveIndicator />
                        </div>
                        {epgData?.now && (
                          <div className="absolute bottom-2 left-2 right-2">
                            <p className="text-xs text-muted-foreground truncate">
                              Now: {epgData.now.title}
                            </p>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-glow">
                            <Play className="w-6 h-6 text-primary-foreground ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <h3 className="font-medium truncate">{channel.name}</h3>
                      <p className="text-xs text-muted-foreground">{channel.group}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Favorites Section */}
        {favoriteChannels.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Star className="w-5 h-5 text-warning" />
                Favorites
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/favorites")}>
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {favoriteChannels.map((channel) => (
                <Card 
                  key={channel.id}
                  variant="channel"
                  className="group text-center p-4"
                  onClick={() => navigate(`/live?channel=${channel.id}`)}
                >
                  <ChannelLogo 
                    src={channel.logoUrl} 
                    name={channel.name} 
                    size="lg"
                    className="mx-auto mb-2"
                  />
                  <p className="text-sm font-medium truncate">{channel.name}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Empty state for favorites */}
        {favoriteChannels.length === 0 && channelCount > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Star className="w-5 h-5 text-warning" />
                Favorites
              </h2>
            </div>
            <Card variant="glass" className="p-8 text-center">
              <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-medium mb-1">No favorites yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Mark channels as favorites while watching to add them here
              </p>
              <Button variant="outline" onClick={() => navigate("/live")}>
                <Tv className="w-4 h-4 mr-2" />
                Browse Channels
              </Button>
            </Card>
          </section>
        )}

        {/* Quick Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tv className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{channelCount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Channels</p>
              </div>
            </div>
          </Card>
          
          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{favoriteIds.size}</p>
                <p className="text-xs text-muted-foreground">Favorites</p>
              </div>
            </div>
          </Card>
          
          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{providerCount}</p>
                <p className="text-xs text-muted-foreground">Providers</p>
              </div>
            </div>
          </Card>
          
          <Card variant="glass" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentIds.length}</p>
                <p className="text-xs text-muted-foreground">Recently Watched</p>
              </div>
            </div>
          </Card>
        </section>

        {/* If we have providers but no channels loaded yet */}
        {channelCount === 0 && providers.length > 0 && (
          <section>
            <Card variant="glass" className="p-8 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
              <h3 className="font-medium mb-1">Loading your channels</h3>
              <p className="text-sm text-muted-foreground">
                This may take a moment for large playlists...
              </p>
            </Card>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
