import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { ChannelList } from "@/components/channels/ChannelList";
import { TVLayout } from "@/components/tv/TVLayout";
import { TVChannelList } from "@/components/tv/TVChannelList";
import { TVNowNextPanel } from "@/components/tv/TVNowNextPanel";
import { useTVMode } from "@/contexts/TVModeContext";
import { Channel } from "@/types/iptv";

// Demo channels with more variety
const demoChannels: Channel[] = [
  { id: "1", providerId: "1", channelId: "ch1", name: "SVT1", group: "Sweden", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/SVT1_logo_2016.svg/512px-SVT1_logo_2016.svg.png", isHD: true },
  { id: "2", providerId: "1", channelId: "ch2", name: "SVT2", group: "Sweden", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "3", providerId: "1", channelId: "ch3", name: "TV4", group: "Sweden", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/TV4_logo_2016.svg/512px-TV4_logo_2016.svg.png", isHD: true },
  { id: "4", providerId: "1", channelId: "ch4", name: "Kanal 5", group: "Sweden", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "5", providerId: "1", channelId: "ch5", name: "TV3", group: "Sweden", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: false },
  { id: "6", providerId: "1", channelId: "ch6", name: "CNN International", group: "News", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "7", providerId: "1", channelId: "ch7", name: "BBC World News", group: "News", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "8", providerId: "1", channelId: "ch8", name: "Sky News", group: "News", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "9", providerId: "1", channelId: "ch9", name: "Al Jazeera", group: "News", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "10", providerId: "1", channelId: "ch10", name: "Eurosport 1", group: "Sports", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "11", providerId: "1", channelId: "ch11", name: "Eurosport 2", group: "Sports", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "12", providerId: "1", channelId: "ch12", name: "ESPN", group: "Sports", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "13", providerId: "1", channelId: "ch13", name: "Discovery Channel", group: "Entertainment", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "14", providerId: "1", channelId: "ch14", name: "National Geographic", group: "Entertainment", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "15", providerId: "1", channelId: "ch15", name: "HBO", group: "Movies", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "16", providerId: "1", channelId: "ch16", name: "Cartoon Network", group: "Kids", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: false },
  { id: "17", providerId: "1", channelId: "ch17", name: "Disney Channel", group: "Kids", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
  { id: "18", providerId: "1", channelId: "ch18", name: "MTV", group: "Music", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", isHD: true },
];

// Demo EPG data (matches EpgProgram type)
import { EpgProgram } from "@/types/iptv";

const createEpgProgram = (channelId: string, title: string, start: Date, end: Date, description?: string): EpgProgram => ({
  id: `epg-${channelId}-${start.getTime()}`,
  channelId,
  title,
  start,
  end,
  description,
});

const demoEpgData: Record<string, { now: EpgProgram; next: EpgProgram }> = {
  "1": { 
    now: createEpgProgram("1", "Nyheterna", new Date(), new Date(Date.now() + 1800000), "Dagens nyheter från Sverige och världen"),
    next: createEpgProgram("1", "Väder", new Date(Date.now() + 1800000), new Date(Date.now() + 3600000))
  },
  "2": { 
    now: createEpgProgram("2", "Dokumentär: Naturen", new Date(), new Date(Date.now() + 3600000), "En fascinerande resa genom svenska naturlandskap"),
    next: createEpgProgram("2", "Kulturnytt", new Date(Date.now() + 3600000), new Date(Date.now() + 5400000))
  },
  "3": { 
    now: createEpgProgram("3", "Nyhetsmorgon", new Date(), new Date(Date.now() + 7200000), "Morgonnyheter med gäster och reportage"),
    next: createEpgProgram("3", "Kalla Fakta", new Date(Date.now() + 7200000), new Date(Date.now() + 10800000))
  },
  "6": { 
    now: createEpgProgram("6", "CNN Newsroom", new Date(), new Date(Date.now() + 3600000), "Breaking news and analysis from around the world"),
    next: createEpgProgram("6", "World Sport", new Date(Date.now() + 3600000), new Date(Date.now() + 5400000))
  },
  "10": { 
    now: createEpgProgram("10", "Tour de France", new Date(), new Date(Date.now() + 10800000), "Live coverage of today's stage"),
    next: createEpgProgram("10", "Tennis Live", new Date(Date.now() + 10800000), new Date(Date.now() + 14400000))
  },
};

export default function LiveTVPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isTVMode } = useTVMode();
  const channelId = searchParams.get("channel");

  const [channels, setChannels] = useState<Channel[]>(demoChannels);
  
  const selectedChannel = useMemo(() => {
    if (channelId) {
      return channels.find((ch) => ch.id === channelId) || null;
    }
    return null;
  }, [channels, channelId]);

  const handleSelectChannel = useCallback((channel: Channel) => {
    navigate(`/live?channel=${channel.id}`);
  }, [navigate]);

  const handleToggleFavoriteById = useCallback((channelId: string) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId ? { ...ch, isFavorite: !ch.isFavorite } : ch
      )
    );
  }, []);

  const handleToggleFavorite = useCallback((channel: Channel) => {
    handleToggleFavoriteById(channel.id);
  }, [handleToggleFavoriteById]);

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
                {demoEpgData[selectedChannel.id as keyof typeof demoEpgData] && (
                  <div className="mt-2 text-lg text-muted-foreground">
                    Nu: {demoEpgData[selectedChannel.id as keyof typeof demoEpgData].now.title}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Now/Next Panel - Right */}
          <div className="w-96 flex-shrink-0 border-l border-border">
            {(() => {
              const epg = selectedChannel ? demoEpgData[selectedChannel.id as keyof typeof demoEpgData] : undefined;
              return (
                <TVNowNextPanel
                  channel={selectedChannel}
                  currentProgram={epg?.now}
                  nextProgram={epg?.next}
                />
              );
            })()}
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
