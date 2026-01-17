import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EpgGrid } from "@/components/epg/EpgGrid";
import { Channel, EpgProgram } from "@/types/iptv";
import { useNavigate } from "react-router-dom";

// Demo channels
const demoChannels: Channel[] = [
  { id: "1", providerId: "1", channelId: "ch1", name: "SVT1", group: "Sweden", streamUrl: "", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/SVT1_logo_2016.svg/512px-SVT1_logo_2016.svg.png", isHD: true },
  { id: "2", providerId: "1", channelId: "ch2", name: "SVT2", group: "Sweden", streamUrl: "", isHD: true },
  { id: "3", providerId: "1", channelId: "ch3", name: "TV4", group: "Sweden", streamUrl: "", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/TV4_logo_2016.svg/512px-TV4_logo_2016.svg.png", isHD: true },
  { id: "4", providerId: "1", channelId: "ch4", name: "Kanal 5", group: "Sweden", streamUrl: "", isHD: true },
  { id: "5", providerId: "1", channelId: "ch5", name: "TV3", group: "Sweden", streamUrl: "", isHD: false },
  { id: "6", providerId: "1", channelId: "ch6", name: "CNN International", group: "News", streamUrl: "", isHD: true },
  { id: "7", providerId: "1", channelId: "ch7", name: "BBC World News", group: "News", streamUrl: "", isHD: true },
  { id: "8", providerId: "1", channelId: "ch8", name: "Sky News", group: "News", streamUrl: "", isHD: true },
  { id: "9", providerId: "1", channelId: "ch9", name: "Al Jazeera", group: "News", streamUrl: "", isHD: true },
  { id: "10", providerId: "1", channelId: "ch10", name: "Eurosport 1", group: "Sports", streamUrl: "", isHD: true },
  { id: "11", providerId: "1", channelId: "ch11", name: "Eurosport 2", group: "Sports", streamUrl: "", isHD: true },
  { id: "12", providerId: "1", channelId: "ch12", name: "ESPN", group: "Sports", streamUrl: "", isHD: true },
  { id: "13", providerId: "1", channelId: "ch13", name: "Discovery Channel", group: "Entertainment", streamUrl: "", isHD: true },
  { id: "14", providerId: "1", channelId: "ch14", name: "National Geographic", group: "Entertainment", streamUrl: "", isHD: true },
  { id: "15", providerId: "1", channelId: "ch15", name: "HBO", group: "Movies", streamUrl: "", isHD: true },
];

export default function EpgPage() {
  const navigate = useNavigate();
  const [programs] = useState<Map<string, EpgProgram[]>>(new Map());

  const handleSelectChannel = (channel: Channel) => {
    navigate(`/live?channel=${channel.id}`);
  };

  const handleSelectProgram = (program: EpgProgram, channel: Channel) => {
    // Could show program details modal or navigate to channel
    navigate(`/live?channel=${channel.id}`);
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3.5rem)] lg:h-screen">
        <EpgGrid
          channels={demoChannels}
          programs={programs}
          onSelectChannel={handleSelectChannel}
          onSelectProgram={handleSelectProgram}
        />
      </div>
    </AppLayout>
  );
}
