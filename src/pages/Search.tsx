import { useState, useMemo } from "react";
import { Search as SearchIcon, Tv, Film, Clapperboard, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChannelLogo, EmptyState } from "@/components/ui/custom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useChannelLoader } from "@/hooks/useChannelLoader";
import { useChannelStore } from "@/data/stores/channelStore";
import { useVodStore } from "@/data/stores/vodStore";
import { searchChannels } from "@/core/indexing/channelIndex";

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("channels");
  const { isLoading, channelCount } = useChannelLoader();
  const index = useChannelStore((state) => state.index);
  const movies = useVodStore((state) => state.movies);
  const series = useVodStore((state) => state.series);

  // Search channels using indexed search
  const filteredChannels = useMemo(() => {
    if (!query || !index) return [];
    const matchingIds = searchChannels(query, index);
    return matchingIds
      .slice(0, 50) // Limit results for performance
      .map(id => index.byId.get(id))
      .filter(Boolean);
  }, [query, index]);

  // Search movies
  const filteredMovies = useMemo(() => {
    if (!query || query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    return movies
      .filter(m => 
        m.title.toLowerCase().includes(lowerQuery) ||
        m.originalTitle?.toLowerCase().includes(lowerQuery) ||
        m.description?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 50);
  }, [query, movies]);

  // Search series
  const filteredSeries = useMemo(() => {
    if (!query || query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    return series
      .filter(s => 
        s.title.toLowerCase().includes(lowerQuery) ||
        s.originalTitle?.toLowerCase().includes(lowerQuery) ||
        s.description?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 50);
  }, [query, series]);

  const totalResults = filteredChannels.length + filteredMovies.length + filteredSeries.length;

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
          <h1 className="text-2xl font-bold mb-4">Sök</h1>
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Sök kanaler, filmer, serier..."
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
          <div className="flex gap-4 text-sm text-muted-foreground mt-2">
            <span>{channelCount.toLocaleString()} kanaler</span>
            <span>{movies.length.toLocaleString()} filmer</span>
            <span>{series.length.toLocaleString()} serier</span>
          </div>
        </div>

        {/* Results */}
        {query && query.length >= 2 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="channels" className="gap-2">
                <Tv className="w-4 h-4" />
                Kanaler ({filteredChannels.length})
              </TabsTrigger>
              <TabsTrigger value="movies" className="gap-2">
                <Film className="w-4 h-4" />
                Filmer ({filteredMovies.length})
              </TabsTrigger>
              <TabsTrigger value="series" className="gap-2">
                <Clapperboard className="w-4 h-4" />
                Serier ({filteredSeries.length})
              </TabsTrigger>
            </TabsList>

            {/* Channels Tab */}
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
                  title="Inga kanaler hittades"
                  description={`Inga kanaler matchar "${query}"`}
                />
              )}
            </TabsContent>

            {/* Movies Tab */}
            <TabsContent value="movies">
              {filteredMovies.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredMovies.map((movie) => (
                    <Card
                      key={movie.id}
                      variant="interactive"
                      className="overflow-hidden cursor-pointer"
                      onClick={() => navigate(`/movies?play=${movie.id}`)}
                    >
                      <div className="aspect-[2/3] relative">
                        {movie.posterUrl ? (
                          <img
                            src={movie.posterUrl}
                            alt={movie.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Film className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium text-sm truncate">{movie.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {movie.year} {movie.rating && `• ★ ${movie.rating.toFixed(1)}`}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Film}
                  title="Inga filmer hittades"
                  description={`Inga filmer matchar "${query}"`}
                />
              )}
            </TabsContent>

            {/* Series Tab */}
            <TabsContent value="series">
              {filteredSeries.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredSeries.map((show) => (
                    <Card
                      key={show.id}
                      variant="interactive"
                      className="overflow-hidden cursor-pointer"
                      onClick={() => navigate(`/series/${show.id}`)}
                    >
                      <div className="aspect-[2/3] relative">
                        {show.posterUrl ? (
                          <img
                            src={show.posterUrl}
                            alt={show.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Clapperboard className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium text-sm truncate">{show.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {show.year} {show.totalSeasons && `• ${show.totalSeasons} säsonger`}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Clapperboard}
                  title="Inga serier hittades"
                  description={`Inga serier matchar "${query}"`}
                />
              )}
            </TabsContent>
          </Tabs>
        ) : query.length > 0 && query.length < 2 ? (
          <div className="text-center py-12">
            <SearchIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold mb-2">Skriv minst 2 tecken</h2>
            <p className="text-muted-foreground">
              Ange minst två tecken för att söka
            </p>
          </div>
        ) : channelCount === 0 && movies.length === 0 && series.length === 0 ? (
          <div className="text-center py-12">
            <Tv className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold mb-2">Inget innehåll att söka</h2>
            <p className="text-muted-foreground mb-4">
              Lägg till en provider för att börja söka
            </p>
            <Button variant="outline" onClick={() => navigate("/providers")}>
              Lägg till provider
            </Button>
          </div>
        ) : (
          <div className="text-center py-12">
            <SearchIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h2 className="text-xl font-semibold mb-2">Sök ditt innehåll</h2>
            <p className="text-muted-foreground">
              Hitta kanaler, filmer och serier från alla dina providers
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}