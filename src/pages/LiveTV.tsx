import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, Tv, Search, Maximize2, Minimize2 } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [isExpandedPlayer, setIsExpandedPlayer] = useState(false);
  
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

  // Escape key to close expanded player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpandedPlayer) {
        e.preventDefault();
        setIsExpandedPlayer(false);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpandedPlayer]);

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

  // Standard Desktop/Mobile Layout - Channel list primary, mini-player on top
  // OR Expanded player mode
  
  if (isExpandedPlayer) {
    // Expanded/Fullscreen player mode
    return (
      <AppLayout>
        <ChannelSearchCommand open={isSearchOpen} onOpenChange={setSearchOpen} />
        <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen bg-black">
          {/* Expanded Player */}
          <div className="flex-1 relative">
            <VideoPlayer
              channel={selectedChannel}
              onPrevious={currentIndex > 0 ? handlePrevious : undefined}
              onNext={currentIndex < channels.length - 1 ? handleNext : undefined}
              className="h-full w-full"
            />
            
            {/* Exit fullscreen button - fixed position */}
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4 z-50 gap-2 bg-black/60 hover:bg-black/80 text-white border-0"
              onClick={() => setIsExpandedPlayer(false)}
            >
              <Minimize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Minimera</span>
            </Button>
            
            {/* Channel info overlay */}
            {selectedChannel && (
              <div className="absolute bottom-4 left-4 right-4 z-40 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 sm:p-4 max-w-md">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base sm:text-lg font-semibold text-white truncate">{selectedChannel.name}</h2>
                    {selectedChannel.isHD && (
                      <span className="px-1.5 py-0.5 bg-primary/30 text-primary text-xs rounded font-medium shrink-0">HD</span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-white/70 truncate">{selectedChannel.group}</p>
                  {epgData?.now && (
                    <div className="text-xs text-white/70 truncate mt-1">
                      <span className="text-primary">Nu:</span> {epgData.now.title}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }
  
  // Default: Mini-player layout
  return (
    <AppLayout>
      <ChannelSearchCommand open={isSearchOpen} onOpenChange={setSearchOpen} />
      <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
        {/* Mini Player Section - Compact at top */}
        <div className="shrink-0 p-2 sm:p-3 lg:p-4 border-b border-border bg-card/30">
          <div className="flex items-start gap-3 lg:gap-4">
            {/* Mini player container - 16:9 aspect ratio, limited height */}
            <div className="w-48 sm:w-64 md:w-80 lg:w-96 shrink-0 relative group">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black shadow-lg">
                <VideoPlayer
                  channel={selectedChannel}
                  onPrevious={currentIndex > 0 ? handlePrevious : undefined}
                  onNext={currentIndex < channels.length - 1 ? handleNext : undefined}
                  className="absolute inset-0"
                />
                
                {/* Fullscreen button overlay */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute bottom-2 right-2 z-30 h-7 w-7 bg-black/60 hover:bg-black/80 text-white border-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setIsExpandedPlayer(true)}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Tryck Escape för att minimera</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            
            {/* Channel info + controls */}
            <div className="flex-1 min-w-0 py-1">
              {selectedChannel ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-semibold truncate">{selectedChannel.name}</h2>
                    {selectedChannel.isHD && (
                      <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded font-medium shrink-0">HD</span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{selectedChannel.group}</p>
                  {epgData?.now && (
                    <div className="text-xs text-muted-foreground truncate">
                      <span className="text-primary">Nu:</span> {epgData.now.title}
                    </div>
                  )}
                  
                  {/* Expand button - visible on desktop */}
                  <div className="hidden sm:flex pt-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5 h-7"
                          onClick={() => setIsExpandedPlayer(true)}
                        >
                          <Maximize2 className="w-3 h-3" />
                          Fullskärm
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tryck Escape för att minimera</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Välj en kanal från listan
                </div>
              )}
              
              {/* Search hint - desktop */}
              <div className="hidden md:flex mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground gap-2 h-7 px-2"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="w-3 h-3" />
                  <span>Sök kanal</span>
                  <kbd className="ml-1 px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘K</kbd>
                </Button>
              </div>
            </div>
            
            {/* Mobile buttons */}
            <div className="flex flex-col gap-1 sm:hidden shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsExpandedPlayer(true)}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Tryck Escape för att minimera</p>
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Channel List - Primary area, takes remaining space */}
        <div className="flex-1 min-h-0 bg-background">
          <VirtualizedChannelList
            channels={channels}
            selectedChannel={selectedChannel || undefined}
            onSelectChannel={handleSelectChannel}
            onToggleFavorite={handleToggleFavorite}
            className="h-full"
          />
        </div>
      </div>
    </AppLayout>
  );
}
