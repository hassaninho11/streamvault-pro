import { useState } from "react";
import { Search as SearchIcon, Tv, Calendar, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChannelLogo, EmptyState } from "@/components/ui/custom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Channel } from "@/types/iptv";

// Demo data
const allChannels: Channel[] = [
  { id: "1", providerId: "1", channelId: "ch1", name: "SVT1", group: "Sweden", streamUrl: "", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/SVT1_logo_2016.svg/512px-SVT1_logo_2016.svg.png", isHD: true },
  { id: "2", providerId: "1", channelId: "ch2", name: "SVT2", group: "Sweden", streamUrl: "", isHD: true },
  { id: "3", providerId: "1", channelId: "ch3", name: "TV4", group: "Sweden", streamUrl: "", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/TV4_logo_2016.svg/512px-TV4_logo_2016.svg.png", isHD: true },
  { id: "4", providerId: "1", channelId: "ch4", name: "CNN International", group: "News", streamUrl: "", isHD: true },
  { id: "5", providerId: "1", channelId: "ch5", name: "BBC World News", group: "News", streamUrl: "", isHD: true },
  { id: "6", providerId: "1", channelId: "ch6", name: "Eurosport 1", group: "Sports", streamUrl: "", isHD: true },
  { id: "7", providerId: "1", channelId: "ch7", name: "Discovery Channel", group: "Entertainment", streamUrl: "", isHD: true },
  { id: "8", providerId: "1", channelId: "ch8", name: "HBO", group: "Movies", streamUrl: "", isHD: true },
];

const demoPrograms = [
  { id: "p1", title: "Morning News", channel: "SVT1", time: "08:00 - 09:00" },
  { id: "p2", title: "Sports Tonight", channel: "Eurosport 1", time: "20:00 - 21:00" },
  { id: "p3", title: "Movie: Inception", channel: "HBO", time: "21:00 - 23:30" },
  { id: "p4", title: "Nature Documentary", channel: "Discovery", time: "19:00 - 20:00" },
];

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("channels");

  const filteredChannels = query
    ? allChannels.filter(
        (ch) =>
          ch.name.toLowerCase().includes(query.toLowerCase()) ||
          ch.group.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const filteredPrograms = query
    ? demoPrograms.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.channel.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-4">Search</h1>
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search channels, programs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              variant="glass"
              inputSize="lg"
              className="pl-12 pr-12"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setQuery("")}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Results */}
        {query ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="channels" className="gap-2">
                <Tv className="w-4 h-4" />
                Channels ({filteredChannels.length})
              </TabsTrigger>
              <TabsTrigger value="programs" className="gap-2">
                <Calendar className="w-4 h-4" />
                Programs ({filteredPrograms.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="channels">
              {filteredChannels.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredChannels.map((channel) => (
                    <Card
                      key={channel.id}
                      variant="interactive"
                      className="p-4 flex items-center gap-4"
                      onClick={() => navigate(`/live?channel=${channel.id}`)}
                    >
                      <ChannelLogo
                        src={channel.logoUrl}
                        name={channel.name}
                        size="md"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium">{channel.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {channel.group}
                        </p>
                      </div>
                      {channel.isHD && (
                        <span className="px-2 py-0.5 text-xs font-bold bg-primary/20 text-primary rounded">
                          HD
                        </span>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Tv}
                  title="No channels found"
                  description={`No channels matching "${query}"`}
                />
              )}
            </TabsContent>

            <TabsContent value="programs">
              {filteredPrograms.length > 0 ? (
                <div className="space-y-3">
                  {filteredPrograms.map((program) => (
                    <Card
                      key={program.id}
                      variant="interactive"
                      className="p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{program.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {program.channel}
                          </p>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {program.time}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No programs found"
                  description={`No programs matching "${query}"`}
                />
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-12">
            <SearchIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold mb-2">Search your content</h2>
            <p className="text-muted-foreground">
              Find channels and programs across all your providers
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
