import { useMemo, useState, useCallback } from "react";
import { Star, Play, Search, Filter, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChannelLogo, LiveIndicator } from "@/components/ui/custom";
import { cn } from "@/lib/utils";
import { Channel, ChannelGroup } from "@/types/iptv";

interface ChannelListProps {
  channels: Channel[];
  groups?: ChannelGroup[];
  selectedChannel?: Channel;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite?: (channel: Channel) => void;
  className?: string;
}

export function ChannelList({
  channels,
  groups,
  selectedChannel,
  onSelectChannel,
  onToggleFavorite,
  className,
}: ChannelListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showGroups, setShowGroups] = useState(true);

  // Filter channels based on search and group
  const filteredChannels = useMemo(() => {
    let result = channels;

    if (selectedGroup) {
      result = result.filter((ch) => ch.group === selectedGroup);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (ch) =>
          ch.name.toLowerCase().includes(query) ||
          ch.group.toLowerCase().includes(query)
      );
    }

    return result;
  }, [channels, selectedGroup, searchQuery]);

  // Get unique groups
  const uniqueGroups = useMemo(() => {
    const groupMap = new Map<string, number>();
    channels.forEach((ch) => {
      groupMap.set(ch.group, (groupMap.get(ch.group) || 0) + 1);
    });
    return Array.from(groupMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  }, [channels]);

  const handleGroupClick = useCallback((groupName: string) => {
    setSelectedGroup((prev) => (prev === groupName ? null : groupName));
  }, []);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search Bar */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            variant="glass"
            className="pl-9"
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredChannels.length} channels
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGroups(!showGroups)}
            className="text-xs"
          >
            <Filter className="w-3 h-3 mr-1" />
            {showGroups ? "Hide Groups" : "Show Groups"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Groups Sidebar */}
        {showGroups && uniqueGroups.length > 1 && (
          <ScrollArea className="w-48 border-r border-border">
            <div className="p-2 space-y-1">
              <button
                onClick={() => setSelectedGroup(null)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                  !selectedGroup
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span>All Channels</span>
                <span className="text-xs opacity-70">{channels.length}</span>
              </button>
              {uniqueGroups.map((group) => (
                <button
                  key={group.name}
                  onClick={() => handleGroupClick(group.name)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left",
                    selectedGroup === group.name
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <span className="truncate">{group.name}</span>
                  <span className="text-xs opacity-70 ml-2">{group.count}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Channel List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredChannels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                isSelected={selectedChannel?.id === channel.id}
                onSelect={() => onSelectChannel(channel)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

interface ChannelRowProps {
  channel: Channel;
  isSelected: boolean;
  onSelect: () => void;
  onToggleFavorite?: (channel: Channel) => void;
}

function ChannelRow({
  channel,
  isSelected,
  onSelect,
  onToggleFavorite,
}: ChannelRowProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "channel-card flex items-center gap-3 group",
        isSelected && "active"
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      {/* Channel Logo */}
      <ChannelLogo src={channel.logoUrl} name={channel.name} size="md" />

      {/* Channel Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{channel.name}</h4>
          {channel.isHD && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary/20 text-primary rounded">
              HD
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{channel.group}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(channel);
          }}
        >
          <Star
            className={cn(
              "w-4 h-4",
              channel.isFavorite
                ? "fill-warning text-warning"
                : "text-muted-foreground"
            )}
          />
        </Button>
        <Button variant="ghost" size="iconSm">
          <Play className="w-4 h-4" />
        </Button>
      </div>

      {/* Live indicator for selected */}
      {isSelected && <LiveIndicator />}
    </div>
  );
}
