import { useState, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { ChannelList } from "@/components/channels/ChannelList";
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

export default function LiveTVPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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

  const handleToggleFavorite = useCallback((channel: Channel) => {
    setChannels((prev) =>
      prev.map((ch) =>
        ch.id === channel.id ? { ...ch, isFavorite: !ch.isFavorite } : ch
      )
    );
  }, []);

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
