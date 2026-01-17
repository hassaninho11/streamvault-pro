import { useState, useMemo } from "react";
import { Search as SearchIcon, Tv, Calendar, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChannelLogo, EmptyState } from "@/components/ui/custom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useChannelLoader } from "@/hooks/useChannelLoader";
import { useChannelStore } from "@/data/stores/channelStore";
import { searchChannels } from "@/core/indexing/channelIndex";

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("channels");
  const { isLoading, channelCount } = useChannelLoader();
  const index = useChannelStore((state) => state.index);

  // Search channels using indexed search
  const filteredChannels = useMemo(() => {
    if (!query || !index) return [];
    const matchingIds = searchChannels(query, index);
    return matchingIds
      .slice(0, 50) // Limit results for performance
      .map(id => index.byId.get(id))
      .filter(Boolean);
  }, [query, index]);

  // TODO: Implement EPG program search when EPG is loaded
  const filteredPrograms: Array<{ id: string; title: string; channel: string; time: string }> = [];

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
          {channelCount > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              Search across {channelCount.toLocaleString()} channels
            </p>
          )}
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
                      key={channel!.id}
                      variant="interactive"
                      className="p-4 flex items-center gap-4"
                      onClick={() => navigate(`/live?channel=${channel!.id}`)}
                    >
                      <ChannelLogo
                        src={channel!.logoUrl}
                        name={channel!.name}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{channel!.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {channel!.group}
                        </p>
                      </div>
                      {channel!.isHD && (
                        <span className="px-2 py-0.5 text-xs font-bold bg-primary/20 text-primary rounded flex-shrink-0">
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
                  description={`No programs matching "${query}". EPG data may not be loaded yet.`}
                />
              )}
            </TabsContent>
          </Tabs>
        ) : channelCount === 0 ? (
          <div className="text-center py-12">
            <Tv className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold mb-2">No channels to search</h2>
            <p className="text-muted-foreground mb-4">
              Add a provider to start searching channels
            </p>
            <Button variant="outline" onClick={() => navigate("/providers")}>
              Add Provider
            </Button>
          </div>
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
