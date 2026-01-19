/**
 * CategoryFilter - Sidebar component for filtering channels by group/category
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useGroups, useSelectedGroup, useChannelStore } from "@/data/stores/channelStore";

export function CategoryFilter() {
  const [isExpanded, setIsExpanded] = useState(false);
  const groups = useGroups();
  const selectedGroup = useSelectedGroup();
  const setSelectedGroup = useChannelStore((state) => state.setSelectedGroup);

  // Don't render if no groups
  if (groups.length === 0) {
    return null;
  }

  // Sort groups by count (most channels first)
  const sortedGroups = [...groups].sort((a, b) => b.count - a.count);
  
  // Show top 5 groups when collapsed, all when expanded
  const displayGroups = isExpanded ? sortedGroups : sortedGroups.slice(0, 5);
  const hasMore = sortedGroups.length > 5;

  const handleSelectGroup = (groupName: string | null) => {
    setSelectedGroup(groupName);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          Kategorier
        </span>
        {selectedGroup && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => handleSelectGroup(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Selected category indicator */}
      {selectedGroup && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
          <Folder className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium truncate flex-1">{selectedGroup}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={() => handleSelectGroup(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Category list */}
      <ScrollArea className={cn("transition-all", isExpanded ? "h-48" : "h-auto")}>
        <div className="space-y-0.5">
          {/* All channels option */}
          <button
            onClick={() => handleSelectGroup(null)}
            className={cn(
              "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
              "hover:bg-muted/50",
              !selectedGroup && "bg-muted text-foreground font-medium"
            )}
          >
            <span className="truncate">Alla kanaler</span>
            <Badge variant="secondary" className="text-xs h-5 px-1.5">
              {groups.reduce((sum, g) => sum + g.count, 0)}
            </Badge>
          </button>

          {/* Group items */}
          {displayGroups.map((group) => (
            <button
              key={group.name}
              onClick={() => handleSelectGroup(group.name)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                "hover:bg-muted/50",
                selectedGroup === group.name && "bg-primary/10 text-primary font-medium"
              )}
            >
              <span className="truncate">{group.name}</span>
              <Badge variant="outline" className="text-xs h-5 px-1.5 shrink-0">
                {group.count}
              </Badge>
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Expand/collapse button */}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              Visa färre
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3 mr-1" />
              Visa alla ({sortedGroups.length})
            </>
          )}
        </Button>
      )}
    </div>
  );
}
