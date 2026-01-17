/**
 * VirtualizedChannelList - High-performance channel list using react-virtual
 * Handles 10k+ channels at 60fps
 */

import React, { useRef, useMemo, useCallback, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Star, Play, Tv } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Channel, ChannelGroup } from "@/types/iptv";

interface VirtualizedChannelListProps {
  channels: Channel[];
  groups?: ChannelGroup[];
  selectedChannel?: Channel;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite?: (channel: Channel) => void;
  className?: string;
}

interface ChannelRowProps {
  channel: Channel;
  isSelected: boolean;
  onSelect: () => void;
  onToggleFavorite?: (channel: Channel) => void;
  style: React.CSSProperties;
}

const ITEM_HEIGHT = 64;

// Memoized channel row for performance
const ChannelRow = memo<ChannelRowProps>(
  ({ channel, isSelected, onSelect, onToggleFavorite, style }) => {
    const handleFavoriteClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleFavorite?.(channel);
      },
      [channel, onToggleFavorite]
    );

    return (
      <div
        style={style}
        className={cn(
          "flex items-center gap-3 px-3 cursor-pointer transition-colors border-b border-border/30",
          isSelected
            ? "bg-primary/10 border-l-2 border-l-primary"
            : "hover:bg-muted/50"
        )}
        onClick={onSelect}
      >
        {/* Logo */}
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {channel.logoUrl ? (
            <img
              src={channel.logoUrl}
              alt=""
              className="w-8 h-8 object-contain"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <Tv className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{channel.name}</span>
            {channel.isHD && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                HD
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate block">
            {channel.group}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleFavoriteClick}
            >
              <Star
                className={cn(
                  "w-4 h-4",
                  channel.isFavorite
                    ? "fill-yellow-500 text-yellow-500"
                    : "text-muted-foreground"
                )}
              />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSelect}>
            <Play className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }
);

ChannelRow.displayName = "ChannelRow";

export const VirtualizedChannelList: React.FC<VirtualizedChannelListProps> = ({
  channels,
  groups,
  selectedChannel,
  onSelectChannel,
  onToggleFavorite,
  className,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedGroup, setSelectedGroup] = React.useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Filter channels with memoization
  const filteredChannels = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return channels.filter((ch) => {
      const matchesSearch =
        !query ||
        ch.name.toLowerCase().includes(query) ||
        ch.group.toLowerCase().includes(query);
      const matchesGroup = !selectedGroup || ch.group === selectedGroup;
      return matchesSearch && matchesGroup;
    });
  }, [channels, searchQuery, selectedGroup]);

  // Get unique groups
  const uniqueGroups = useMemo(() => {
    const groupMap = new Map<string, number>();
    channels.forEach((ch) => {
      groupMap.set(ch.group, (groupMap.get(ch.group) || 0) + 1);
    });
    return Array.from(groupMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [channels]);

  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: filteredChannels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  });

  const handleGroupClick = useCallback((group: string) => {
    setSelectedGroup((prev) => (prev === group ? null : group));
  }, []);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search */}
      <div className="p-3 border-b border-border">
        <Input
          placeholder="Search channels..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Groups sidebar + List */}
      <div className="flex flex-1 min-h-0">
        {/* Groups */}
        {uniqueGroups.length > 1 && (
          <ScrollArea className="w-44 xl:w-52 border-r border-border flex-shrink-0">
            <div className="p-2 space-y-1">
              <Button
                variant={selectedGroup === null ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => setSelectedGroup(null)}
              >
                All ({channels.length})
              </Button>
              {uniqueGroups.map((group) => (
                <Button
                  key={group.name}
                  variant={selectedGroup === group.name ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => handleGroupClick(group.name)}
                  title={group.name}
                >
                  <span className="truncate flex-1 text-left">{group.name}</span>
                  <span className="text-muted-foreground ml-1 flex-shrink-0">({group.count})</span>
                </Button>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Virtualized Channel List */}
        <div ref={parentRef} className="flex-1 overflow-auto">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const channel = filteredChannels[virtualRow.index];
              return (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  isSelected={selectedChannel?.id === channel.id}
                  onSelect={() => onSelectChannel(channel)}
                  onToggleFavorite={onToggleFavorite}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div className="p-2 border-t border-border text-xs text-muted-foreground text-center">
        {filteredChannels.length} of {channels.length} channels
      </div>
    </div>
  );
};

export default VirtualizedChannelList;
