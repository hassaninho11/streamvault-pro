import { useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, Tv, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { VirtualizedChannelList } from "@/components/channels/VirtualizedChannelList";
import { TVLayout } from "@/components/tv/TVLayout";
import { TVChannelList } from "@/components/tv/TVChannelList";
import { TVNowNextPanel } from "@/components/tv/TVNowNextPanel";
import { ChannelSearchCommand } from "@/components/channels/ChannelSearchCommand";
import { useTVMode } from "@/contexts/TVModeContext";
import { useChannelLoader } from "@/hooks/useChannelLoader";
import { useChannelStore, useFilteredChannelIds } from "@/data/stores/channelStore";
import { useRecentlyWatched } from "@/hooks/useRecentlyWatched";
import { useChannelSearch } from "@/hooks/useChannelSearch";
import { Button } from "@/components/ui/button";
import { Channel, EpgProgram } from "@/types/iptv";
import type { CoreChannel } from "@/core/types";

// Convert CoreChannel to Channel for UI components
function toUIChannel(core: CoreChannel, isFavorite: boolean): Channel {
  return {
    id: core.id,
    providerId: core.providerId,
    channelId: core.channelId,
    name: core.name,
    group: core.group,
    streamUrl: core.streamUrl,
    logoUrl: core.logoUrl,
    epgId: core.epgId,
    number: core.number,
    isHD: core.isHD,
    isFavorite,
  };
}

export default function LiveTVPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isTVMode } = useTVMode();
  const channelId = searchParams.get("channel");
  const { addToRecentlyWatched } = useRecentlyWatched();
  const { isOpen: isSearchOpen, setIsOpen: setSearchOpen } = useChannelSearch();
  
  // Check for VOD playback
  const isVodMode = searchParams.get("vod") === "true";
  const vodUrl = searchParams.get("url");
  const vodTitle = searchParams.get("title");

  const { isLoading, channelCount } = useChannelLoader();
  const filteredIds = useFilteredChannelIds();
  const index = useChannelStore((state) => state.index);
  const toggleFavorite = useChannelStore((state) => state.toggleFavorite);
  
  // Use stable reference for favorites check function instead of the Set itself
  const isFavorite = useCallback((id: string) => {
    return useChannelStore.getState().favoriteIds.has(id);
  }, []);
  
  // Get now/next data for a specific channel
  const getNowNext = useCallback((id: string) => {
    return useChannelStore.getState().nowNextMap.get(id);
  }, []);

  // Subscribe to favoriteIds changes to trigger re-render when favorites change
  const favoriteIdsVersion = useChannelStore((state) => state.favoriteIds.size);

  // Memoize channels - only recompute when index/filteredIds/favorites change
  // For performance with 7000+ channels, we pass this to VirtualizedChannelList
  const channels: Channel[] = useMemo(() => {
    if (!index || !index.byId) return [];
    const result: Channel[] = [];
    const favoriteIds = useChannelStore.getState().favoriteIds;
    for (const id of filteredIds) {
      const channel = index.byId.get(id);
      if (channel) {
        result.push(toUIChannel(channel, favoriteIds.has(id)));
      }
    }
    return result;
  }, [filteredIds, index, favoriteIdsVersion]);

  const selectedChannel = useMemo(() => {
    if (!channelId || !index) return null;
    const core = index.byId.get(channelId);
    if (!core) return null;
    return toUIChannel(core, isFavorite(channelId));
  }, [channelId, index, isFavorite, favoriteIdsVersion]);

  // Track channel viewing - use ref to prevent re-running effect
  const lastTrackedChannel = useRef<string | null>(null);
  useEffect(() => {
    if (channelId && channelId !== lastTrackedChannel.current) {
      lastTrackedChannel.current = channelId;
      addToRecentlyWatched(channelId);
    }
  }, [channelId, addToRecentlyWatched]);

  const handleSelectChannel = useCallback((channel: Channel) => {
    navigate(`/live?channel=${channel.id}`);
  }, [navigate]);

  const handleToggleFavorite = useCallback((channel: Channel) => {
    toggleFavorite(channel.id);
  }, [toggleFavorite]);

  const currentIndex = selectedChannel 
    ? channels.findIndex((ch) => ch.id === selectedChannel.id)
    : -1;

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      handleSelectChannel(channels[currentIndex - 1]);
    }
  }, [currentIndex, channels, handleSelectChannel]);

  const handleNext = useCallback(() => {
    if (currentIndex < channels.length - 1) {
      handleSelectChannel(channels[currentIndex + 1]);
    }
  }, [currentIndex, channels, handleSelectChannel]);

  // Get EPG data for selected channel
  const epgData = selectedChannel ? getNowNext(selectedChannel.id) : undefined;
  const currentProgram: EpgProgram | undefined = epgData?.now ? {
    id: epgData.now.id,
    channelId: epgData.now.channelId,
    title: epgData.now.title,
    description: epgData.now.description,
    start: new Date(epgData.now.start),
    end: new Date(epgData.now.end),
    category: epgData.now.category,
  } : undefined;
  const nextProgram: EpgProgram | undefined = epgData?.next ? {
    id: epgData.next.id,
    channelId: epgData.next.channelId,
    title: epgData.next.title,
    description: epgData.next.description,
    start: new Date(epgData.next.start),
    end: new Date(epgData.next.end),
    category: epgData.next.category,
  } : undefined;

  // VOD Mode - Simplified player for movies/series
  if (isVodMode && vodUrl) {
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen p-2 sm:p-4">
          {/* Back button and title - responsive */}
          <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4 min-w-0">
            <Button variant="ghost" size="sm" className="shrink-0 px-2 sm:px-4" onClick={() => navigate(-1)}>
              ← <span className="hidden sm:inline ml-1">Tillbaka</span>
            </Button>
            {vodTitle && (
              <h1 className="text-sm sm:text-xl font-semibold truncate min-w-0 flex-1">{vodTitle}</h1>
            )}
          </div>
          
          {/* VOD Player - full width */}
          <div className="flex-1 min-h-0">
            <VideoPlayer
              channel={null}
              directStreamUrl={vodUrl}
              vodTitle={vodTitle || undefined}
              className="h-full w-full"
            />
          </div>
        </div>
      </AppLayout>
    );
  }

  // Loading state
  if (isLoading && channelCount === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading channels...</p>
        </div>
      </AppLayout>
    );
  }

  // No channels state
  if (!isLoading && channelCount === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <Tv className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Channels Available</h2>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Add a provider to start watching your favorite channels
          </p>
          <Button variant="glow" onClick={() => navigate("/providers")}>
            Add Provider
          </Button>
        </div>
      </AppLayout>
    );
  }

  // TV Mode Layout
  if (isTVMode) {
    return (
      <TVLayout>
        <ChannelSearchCommand open={isSearchOpen} onOpenChange={setSearchOpen} />
        <div className="flex h-full">
          {/* Channel List - Left */}
          <div className="w-80 flex-shrink-0 border-r border-border bg-card/30">
            <TVChannelList
              channels={channels}
              selectedChannel={selectedChannel}
              onSelectChannel={handleSelectChannel}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>

          {/* Player - Center */}
          <div className="flex-1 flex flex-col p-6">
            <div className="flex-1 relative">
              <VideoPlayer
                channel={selectedChannel}
                onPrevious={currentIndex > 0 ? handlePrevious : undefined}
                onNext={currentIndex < channels.length - 1 ? handleNext : undefined}
                className="h-full"
              />
            </div>
            
            {/* Channel info bar */}
            {selectedChannel && (
              <div className="mt-4 p-4 bg-card/50 rounded-xl border border-border">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-foreground">{selectedChannel.name}</span>
                  <span className="text-muted-foreground">{selectedChannel.group}</span>
                  {selectedChannel.isHD && (
                    <span className="px-2 py-1 bg-primary/20 text-primary text-sm rounded font-medium">HD</span>
                  )}
                </div>
                {currentProgram && (
                  <div className="mt-2 text-lg text-muted-foreground">
                    Nu: {currentProgram.title}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Now/Next Panel - Right */}
          <div className="w-96 flex-shrink-0 border-l border-border">
            <TVNowNextPanel
              channel={selectedChannel}
              currentProgram={currentProgram}
              nextProgram={nextProgram}
            />
          </div>
        </div>
      </TVLayout>
    );
  }

  // Standard Desktop/Mobile Layout
  return (
    <AppLayout>
      <ChannelSearchCommand open={isSearchOpen} onOpenChange={setSearchOpen} />
      <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] lg:h-screen">
        {/* Player Section */}
        <div className="flex-1 p-4 lg:p-6 flex flex-col">
          {/* Search hint */}
          <div className="mb-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground gap-2"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="w-3 h-3" />
              <span>Search</span>
              <kbd className="ml-1 px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘K</kbd>
            </Button>
          </div>
          <VideoPlayer
            channel={selectedChannel}
            onPrevious={currentIndex > 0 ? handlePrevious : undefined}
            onNext={currentIndex < channels.length - 1 ? handleNext : undefined}
            className="flex-1"
          />
        </div>

        {/* Channel List Sidebar - Using Virtualized for 7000+ channels */}
        <div className="w-full lg:w-[28rem] xl:w-[36rem] border-t lg:border-t-0 lg:border-l border-border bg-card/30">
          <VirtualizedChannelList
            channels={channels}
            selectedChannel={selectedChannel || undefined}
            onSelectChannel={handleSelectChannel}
            onToggleFavorite={handleToggleFavorite}
            className="h-64 lg:h-full"
          />
        </div>
      </div>
    </AppLayout>
  );
}
