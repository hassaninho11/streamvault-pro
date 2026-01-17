/**
 * ChannelSearchCommand - Quick channel search with fuzzy matching
 * Opens with Ctrl+K / Cmd+K, supports keyboard navigation
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tv, Star, Clock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useChannelStore } from "@/data/stores/channelStore";
import { cn } from "@/lib/utils";
import type { CoreChannel } from "@/core/types";

interface ChannelSearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Simple fuzzy match scoring
function fuzzyScore(query: string, target: string): number {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();
  
  // Exact match gets highest score
  if (targetLower === queryLower) return 100;
  
  // Starts with query
  if (targetLower.startsWith(queryLower)) return 80;
  
  // Contains query as substring
  if (targetLower.includes(queryLower)) return 60;
  
  // Fuzzy character matching
  let score = 0;
  let queryIndex = 0;
  let consecutiveMatches = 0;
  
  for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
    if (targetLower[i] === queryLower[queryIndex]) {
      score += 10 + consecutiveMatches * 5;
      consecutiveMatches++;
      queryIndex++;
    } else {
      consecutiveMatches = 0;
    }
  }
  
  // All query characters must be found
  if (queryIndex < queryLower.length) return 0;
  
  // Bonus for shorter targets (more relevant)
  score += Math.max(0, 20 - target.length);
  
  return score;
}

interface SearchResult {
  channel: CoreChannel;
  score: number;
  isFavorite: boolean;
}

export const ChannelSearchCommand: React.FC<ChannelSearchCommandProps> = ({
  open,
  onOpenChange,
}) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  
  const index = useChannelStore((state) => state.index);
  const favoriteIds = useChannelStore((state) => state.favoriteIds);
  
  // Get recently watched from localStorage for quick access
  const recentChannelIds = useMemo(() => {
    try {
      const stored = localStorage.getItem("recentChannels");
      if (stored) {
        return JSON.parse(stored) as string[];
      }
    } catch {
      // ignore
    }
    return [];
  }, [open]); // Refresh when dialog opens
  
  // Search results with fuzzy matching
  const searchResults = useMemo((): SearchResult[] => {
    if (!index || !search.trim()) return [];
    
    const query = search.trim();
    const results: SearchResult[] = [];
    
    // Search through all channels
    for (const [, channel] of index.byId) {
      const nameScore = fuzzyScore(query, channel.name);
      const groupScore = fuzzyScore(query, channel.group) * 0.5;
      const score = Math.max(nameScore, groupScore);
      
      if (score > 0) {
        results.push({
          channel,
          score,
          isFavorite: favoriteIds.has(channel.id),
        });
      }
    }
    
    // Sort by score descending, limit to 50
    return results
      .sort((a, b) => {
        // Favorites get a boost
        const aBoost = a.isFavorite ? 10 : 0;
        const bBoost = b.isFavorite ? 10 : 0;
        return (b.score + bBoost) - (a.score + aBoost);
      })
      .slice(0, 50);
  }, [index, search, favoriteIds]);
  
  // Favorite channels for quick access
  const favoriteChannels = useMemo((): CoreChannel[] => {
    if (!index) return [];
    const channels: CoreChannel[] = [];
    for (const id of favoriteIds) {
      const channel = index.byId.get(id);
      if (channel) channels.push(channel);
    }
    return channels.slice(0, 10);
  }, [index, favoriteIds]);
  
  // Recent channels
  const recentChannels = useMemo((): CoreChannel[] => {
    if (!index) return [];
    const channels: CoreChannel[] = [];
    for (const id of recentChannelIds) {
      const channel = index.byId.get(id);
      if (channel) channels.push(channel);
    }
    return channels.slice(0, 5);
  }, [index, recentChannelIds]);
  
  const handleSelect = useCallback((channelId: string) => {
    navigate(`/live?channel=${channelId}`);
    onOpenChange(false);
    setSearch("");
  }, [navigate, onOpenChange]);
  
  // Reset search when closed
  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command className="rounded-lg border shadow-md">
        <CommandInput 
          placeholder="Search channels..." 
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center py-6 text-muted-foreground">
              <Search className="w-10 h-10 mb-2 opacity-50" />
              <p>No channels found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          </CommandEmpty>
          
          {/* Search Results */}
          {search.trim() && searchResults.length > 0 && (
            <CommandGroup heading="Search Results">
              {searchResults.map(({ channel, isFavorite }) => (
                <CommandItem
                  key={channel.id}
                  value={`${channel.name} ${channel.group}`}
                  onSelect={() => handleSelect(channel.id)}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {channel.logoUrl ? (
                      <img
                        src={channel.logoUrl}
                        alt=""
                        className="w-6 h-6 object-contain"
                      />
                    ) : (
                      <Tv className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{channel.name}</span>
                      {channel.isHD && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          HD
                        </Badge>
                      )}
                      {isFavorite && (
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{channel.group}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {/* Favorites (when not searching) */}
          {!search.trim() && favoriteChannels.length > 0 && (
            <CommandGroup heading="Favorites">
              {favoriteChannels.map((channel) => (
                <CommandItem
                  key={channel.id}
                  value={`fav-${channel.name}`}
                  onSelect={() => handleSelect(channel.id)}
                  className="flex items-center gap-3 py-2"
                >
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {channel.logoUrl ? (
                      <img src={channel.logoUrl} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      <Tv className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <span className="truncate">{channel.name}</span>
                  {channel.isHD && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">HD</Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {/* Recent (when not searching) */}
          {!search.trim() && recentChannels.length > 0 && (
            <CommandGroup heading="Recently Watched">
              {recentChannels.map((channel) => (
                <CommandItem
                  key={channel.id}
                  value={`recent-${channel.name}`}
                  onSelect={() => handleSelect(channel.id)}
                  className="flex items-center gap-3 py-2"
                >
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {channel.logoUrl ? (
                      <img src={channel.logoUrl} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      <Tv className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <span className="truncate">{channel.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {/* Quick tip */}
          {!search.trim() && favoriteChannels.length === 0 && recentChannels.length === 0 && (
            <div className="py-6 text-center text-muted-foreground text-sm">
              <p>Start typing to search channels</p>
              <p className="text-xs mt-1">Use ↑↓ to navigate, Enter to select</p>
            </div>
          )}
        </CommandList>
        
        {/* Footer with keyboard hints */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">esc</kbd>
              close
            </span>
          </div>
        </div>
      </Command>
    </CommandDialog>
  );
};

export default ChannelSearchCommand;
