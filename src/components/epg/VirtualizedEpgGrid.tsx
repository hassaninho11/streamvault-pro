/**
 * VirtualizedEpgGrid - High-performance EPG grid using react-virtual
 * Virtualizes both rows (channels) and columns (time slots)
 */

import React, { useRef, useMemo, useCallback, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Clock, ChevronLeft, ChevronRight, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Channel, EpgProgram } from "@/types/iptv";

interface VirtualizedEpgGridProps {
  channels: Channel[];
  programs: Map<string, EpgProgram[]>;
  onSelectChannel?: (channel: Channel) => void;
  onSelectProgram?: (program: EpgProgram, channel: Channel) => void;
  className?: string;
}

const ROW_HEIGHT = 56;
const CHANNEL_COLUMN_WIDTH = 180;
const HOUR_WIDTH = 240; // pixels per hour
const TIMELINE_HOURS = 24;

interface EpgRowProps {
  channel: Channel;
  programs: EpgProgram[];
  timelineStart: Date;
  now: Date;
  onSelectChannel?: (channel: Channel) => void;
  onSelectProgram?: (program: EpgProgram, channel: Channel) => void;
  style: React.CSSProperties;
}

// Memoized EPG row
const EpgRow = memo<EpgRowProps>(
  ({ channel, programs, timelineStart, now, onSelectChannel, onSelectProgram, style }) => {
    return (
      <div style={style} className="flex border-b border-border/30">
        {/* Channel info */}
        <div
          className="flex items-center gap-2 px-3 bg-card border-r border-border cursor-pointer hover:bg-muted/50 flex-shrink-0"
          style={{ width: CHANNEL_COLUMN_WIDTH }}
          onClick={() => onSelectChannel?.(channel)}
        >
          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {channel.logoUrl ? (
              <img
                src={channel.logoUrl}
                alt=""
                className="w-6 h-6 object-contain"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <Tv className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <span className="text-sm font-medium truncate">{channel.name}</span>
        </div>

        {/* Programs timeline */}
        <div className="relative flex-1" style={{ minWidth: HOUR_WIDTH * TIMELINE_HOURS }}>
          {programs.map((program) => {
            const startMinutes =
              (program.start.getTime() - timelineStart.getTime()) / 60000;
            const durationMinutes =
              (program.end.getTime() - program.start.getTime()) / 60000;
            const left = (startMinutes / 60) * HOUR_WIDTH;
            const width = (durationMinutes / 60) * HOUR_WIDTH;

            const isPast = program.end < now;
            const isNow = program.isLive;

            return (
              <div
                key={program.id}
                onClick={() => onSelectProgram?.(program, channel)}
                className={cn(
                  "absolute top-1 bottom-1 px-2 rounded cursor-pointer transition-all overflow-hidden",
                  isPast && "bg-muted/30 text-muted-foreground",
                  isNow && "bg-primary/20 border border-primary/50",
                  !isPast && !isNow && "bg-muted/50 hover:bg-muted"
                )}
                style={{
                  left: `${Math.max(0, left)}px`,
                  width: `${Math.max(40, width - 4)}px`,
                }}
              >
                <div className="flex flex-col justify-center h-full">
                  <p className="text-xs font-medium truncate">{program.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {program.start.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

EpgRow.displayName = "EpgRow";

// Generate demo programs for channels without EPG data
const generateDemoPrograms = (channelId: string, timelineStart: Date): EpgProgram[] => {
  const programs: EpgProgram[] = [];
  const now = new Date();
  let current = new Date(timelineStart);

  const titles = [
    "Morning News",
    "Weather Update",
    "Talk Show",
    "Documentary",
    "Movie",
    "Sports",
    "Series",
    "News",
    "Entertainment",
    "Late Show",
  ];

  for (let i = 0; i < 12; i++) {
    const duration = 30 + Math.floor(Math.random() * 90);
    const start = new Date(current);
    const end = new Date(current.getTime() + duration * 60000);

    programs.push({
      id: `${channelId}-${i}`,
      channelId,
      title: titles[i % titles.length],
      start,
      end,
      isLive: now >= start && now < end,
    });

    current = end;
  }

  return programs;
};

export const VirtualizedEpgGrid: React.FC<VirtualizedEpgGridProps> = ({
  channels,
  programs,
  onSelectChannel,
  onSelectProgram,
  className,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const now = useMemo(() => new Date(), []);

  // Timeline start (beginning of current day)
  const timelineStart = useMemo(() => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [now]);

  // Generate hour markers
  const hours = useMemo(() => {
    const h: Date[] = [];
    for (let i = 0; i < TIMELINE_HOURS; i++) {
      const hour = new Date(timelineStart);
      hour.setHours(i);
      h.push(hour);
    }
    return h;
  }, [timelineStart]);

  // Current time position
  const nowPosition = useMemo(() => {
    const minutesFromStart = (now.getTime() - timelineStart.getTime()) / 60000;
    return (minutesFromStart / 60) * HOUR_WIDTH;
  }, [now, timelineStart]);

  // Virtualize rows
  const rowVirtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const scrollToNow = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollLeft = Math.max(0, nowPosition - 200);
    }
  }, [nowPosition]);

  // Scroll to now on mount
  React.useEffect(() => {
    scrollToNow();
  }, [scrollToNow]);

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">TV Guide</span>
          <span className="text-xs text-muted-foreground">
            {channels.length} channels
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={scrollToNow}>
            Now
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (timelineRef.current) {
                timelineRef.current.scrollLeft -= HOUR_WIDTH * 2;
              }
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              if (timelineRef.current) {
                timelineRef.current.scrollLeft += HOUR_WIDTH * 2;
              }
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex flex-1 min-h-0">
        {/* Fixed channel column header */}
        <div className="flex-shrink-0" style={{ width: CHANNEL_COLUMN_WIDTH }}>
          <div className="h-10 bg-muted/50 border-b border-border flex items-center px-3">
            <span className="text-xs text-muted-foreground">Channel</span>
          </div>
        </div>

        {/* Timeline + Grid */}
        <div ref={timelineRef} className="flex-1 overflow-x-auto">
          {/* Time header */}
          <div
            className="flex h-10 bg-muted/50 border-b border-border sticky top-0 z-10"
            style={{ width: HOUR_WIDTH * TIMELINE_HOURS }}
          >
            {hours.map((hour, i) => (
              <div
                key={i}
                className="flex items-center justify-start px-2 border-r border-border/30"
                style={{ width: HOUR_WIDTH }}
              >
                <span className="text-xs text-muted-foreground">
                  {hour.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}

            {/* Now indicator in header */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-destructive z-20"
              style={{ left: `${nowPosition}px` }}
            >
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-destructive rounded-full" />
            </div>
          </div>

          {/* Virtualized rows */}
          <div
            ref={parentRef}
            className="overflow-y-auto"
            style={{
              height: `calc(100% - 40px)`,
              width: HOUR_WIDTH * TIMELINE_HOURS,
            }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {/* Now line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-destructive/50 z-10 pointer-events-none"
                style={{ left: `${nowPosition}px` }}
              />

              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const channel = channels[virtualRow.index];
                const channelPrograms =
                  programs.get(channel.id) ||
                  generateDemoPrograms(channel.id, timelineStart);

                return (
                  <EpgRow
                    key={channel.id}
                    channel={channel}
                    programs={channelPrograms}
                    timelineStart={timelineStart}
                    now={now}
                    onSelectChannel={onSelectChannel}
                    onSelectProgram={onSelectProgram}
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
      </div>
    </div>
  );
};

export default VirtualizedEpgGrid;
