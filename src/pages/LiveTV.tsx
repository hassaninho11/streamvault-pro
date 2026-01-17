import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, Tv } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { ChannelList } from "@/components/channels/ChannelList";
import { TVLayout } from "@/components/tv/TVLayout";
import { TVChannelList } from "@/components/tv/TVChannelList";
import { TVNowNextPanel } from "@/components/tv/TVNowNextPanel";
import { useTVMode } from "@/contexts/TVModeContext";
import { useChannelLoader } from "@/hooks/useChannelLoader";
import { useChannelStore, useFilteredChannelIds } from "@/data/stores/channelStore";
import { useRecentlyWatched } from "@/hooks/useRecentlyWatched";
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

  const { isLoading, channelCount } = useChannelLoader();
  const filteredIds = useFilteredChannelIds();
  const index = useChannelStore((state) => state.index);
  const favoriteIds = useChannelStore((state) => state.favoriteIds);
  const toggleFavorite = useChannelStore((state) => state.toggleFavorite);
  const nowNextMap = useChannelStore((state) => state.nowNextMap);

  // Convert store channels to UI channels
  const channels: Channel[] = useMemo(() => {
    if (!index) return [];
    return filteredIds.map(id => {
      const channel = index.byId.get(id);
      if (!channel) return null;
      return toUIChannel(channel, favoriteIds.has(id));
    }).filter(Boolean) as Channel[];
  }, [filteredIds, index, favoriteIds]);

  const selectedChannel = useMemo(() => {
    if (!channelId || !index) return null;
    const core = index.byId.get(channelId);
    if (!core) return null;
    return toUIChannel(core, favoriteIds.has(channelId));
  }, [channelId, index, favoriteIds]);

  // Track channel viewing
  useEffect(() => {
    if (channelId) {
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
  const epgData = selectedChannel ? nowNextMap.get(selectedChannel.id) : undefined;
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
      <div className="flex flex-col lg:flex-row h-[calc(100vh-3.5rem)] lg:h-screen">
        {/* Player Section */}
        <div className="flex-1 p-4 lg:p-6 flex flex-col">
          <VideoPlayer
            channel={selectedChannel}
            onPrevious={currentIndex > 0 ? handlePrevious : undefined}
            onNext={currentIndex < channels.length - 1 ? handleNext : undefined}
            className="flex-1"
          />
        </div>

        {/* Channel List Sidebar */}
        <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-card/30">
          <ChannelList
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
