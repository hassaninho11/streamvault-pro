import { useState } from "react";
import { Clock, Play, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChannelLogo, EmptyState } from "@/components/ui/custom";
import { Channel, RecentlyWatched } from "@/types/iptv";

interface RecentItem extends Channel {
  lastWatched: Date;
}

const initialRecent: RecentItem[] = [
  { id: "1", providerId: "1", channelId: "ch1", name: "SVT1", group: "Sweden", streamUrl: "", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/SVT1_logo_2016.svg/512px-SVT1_logo_2016.svg.png", isHD: true, lastWatched: new Date(Date.now() - 1000 * 60 * 30) },
  { id: "4", providerId: "1", channelId: "ch4", name: "CNN International", group: "News", streamUrl: "", isHD: true, lastWatched: new Date(Date.now() - 1000 * 60 * 60 * 2) },
  { id: "6", providerId: "1", channelId: "ch6", name: "Eurosport 1", group: "Sports", streamUrl: "", isHD: true, lastWatched: new Date(Date.now() - 1000 * 60 * 60 * 5) },
  { id: "8", providerId: "1", channelId: "ch8", name: "HBO", group: "Movies", streamUrl: "", isHD: true, lastWatched: new Date(Date.now() - 1000 * 60 * 60 * 24) },
];

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function RecentPage() {
  const navigate = useNavigate();
  const [recent, setRecent] = useState<RecentItem[]>(initialRecent);

  const removeFromRecent = (channelId: string) => {
    setRecent((prev) => prev.filter((ch) => ch.id !== channelId));
  };

  const clearAll = () => {
    setRecent([]);
  };

  if (recent.length === 0) {
    return (
      <AppLayout>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Recently Watched
          </h1>
          <EmptyState
            icon={Clock}
            title="No history yet"
            description="Channels you watch will appear here"
            action={
              <Button onClick={() => navigate("/live")}>
                Start Watching
              </Button>
            }
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Recently Watched
          </h1>
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear All
          </Button>
        </div>

        <div className="space-y-3">
          {recent.map((channel) => (
            <Card
              key={channel.id}
              variant="interactive"
              className="p-4 flex items-center gap-4 group"
            >
              <ChannelLogo
                src={channel.logoUrl}
                name={channel.name}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{channel.name}</h3>
                <p className="text-sm text-muted-foreground">{channel.group}</p>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatTimeAgo(channel.lastWatched)}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFromRecent(channel.id)}
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button
                  variant="glow"
                  size="icon"
                  onClick={() => navigate(`/live?channel=${channel.id}`)}
                >
                  <Play className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
