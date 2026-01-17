import { useState } from "react";
import { Star, Play, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChannelLogo, EmptyState } from "@/components/ui/custom";
import { Channel } from "@/types/iptv";

const initialFavorites: Channel[] = [
  { id: "1", providerId: "1", channelId: "ch1", name: "SVT1", group: "Sweden", streamUrl: "", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/SVT1_logo_2016.svg/512px-SVT1_logo_2016.svg.png", isHD: true, isFavorite: true },
  { id: "3", providerId: "1", channelId: "ch3", name: "TV4", group: "Sweden", streamUrl: "", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/TV4_logo_2016.svg/512px-TV4_logo_2016.svg.png", isHD: true, isFavorite: true },
  { id: "6", providerId: "1", channelId: "ch6", name: "Eurosport 1", group: "Sports", streamUrl: "", isHD: true, isFavorite: true },
];

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Channel[]>(initialFavorites);

  const removeFavorite = (channelId: string) => {
    setFavorites((prev) => prev.filter((ch) => ch.id !== channelId));
  };

  if (favorites.length === 0) {
    return (
      <AppLayout>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Star className="w-6 h-6 text-warning" />
            Favorites
          </h1>
          <EmptyState
            icon={Star}
            title="No favorites yet"
            description="Start adding channels to your favorites for quick access"
            action={
              <Button onClick={() => navigate("/live")}>
                Browse Channels
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
            <Star className="w-6 h-6 text-warning" />
            Favorites
          </h1>
          <p className="text-muted-foreground">{favorites.length} channels</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((channel) => (
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
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFavorite(channel.id)}
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
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
