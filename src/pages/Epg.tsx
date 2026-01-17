import { useMemo } from "react";
import { Loader2, Calendar, Tv } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EpgGrid } from "@/components/epg/EpgGrid";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useChannelLoader } from "@/hooks/useChannelLoader";
import { useChannelStore, useFilteredChannelIds } from "@/data/stores/channelStore";
import { Channel, EpgProgram } from "@/types/iptv";
import type { CoreChannel } from "@/core/types";

// Convert CoreChannel to Channel for UI components
function toUIChannel(core: CoreChannel): Channel {
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
  };
}

export default function EpgPage() {
  const navigate = useNavigate();
  const { isLoading, channelCount } = useChannelLoader();
  const filteredIds = useFilteredChannelIds();
  const index = useChannelStore((state) => state.index);

  // Convert store channels to UI channels (limit for EPG grid performance)
  const channels: Channel[] = useMemo(() => {
    if (!index) return [];
    return filteredIds
      .slice(0, 100) // Limit channels shown in EPG
      .map(id => {
        const channel = index.byId.get(id);
        if (!channel) return null;
        return toUIChannel(channel);
      })
      .filter(Boolean) as Channel[];
  }, [filteredIds, index]);

  // TODO: Load EPG data from EPG store when implemented
  const programs = useMemo(() => new Map<string, EpgProgram[]>(), []);

  const handleSelectChannel = (channel: Channel) => {
    navigate(`/live?channel=${channel.id}`);
  };

  const handleSelectProgram = (program: EpgProgram, channel: Channel) => {
    navigate(`/live?channel=${channel.id}`);
  };

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

  if (!isLoading && channelCount === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
          <Calendar className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No EPG Data</h2>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Add a provider with an EPG URL to view the program guide
          </p>
          <Button variant="glow" onClick={() => navigate("/providers")}>
            <Tv className="w-4 h-4 mr-2" />
            Add Provider
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col">
        {/* EPG Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Program Guide</h1>
            <p className="text-sm text-muted-foreground">
              {channels.length} channels {channels.length < channelCount && `(showing ${channels.length} of ${channelCount})`}
            </p>
          </div>
          {programs.size === 0 && (
            <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
              EPG data not loaded yet
            </div>
          )}
        </div>

        {/* EPG Grid */}
        <div className="flex-1 overflow-hidden">
          <EpgGrid
            channels={channels}
            programs={programs}
            onSelectChannel={handleSelectChannel}
            onSelectProgram={handleSelectProgram}
          />
        </div>
      </div>
    </AppLayout>
  );
}
