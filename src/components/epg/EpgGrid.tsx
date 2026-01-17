import { useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChannelLogo } from "@/components/ui/custom";
import { cn } from "@/lib/utils";
import { Channel, EpgProgram } from "@/types/iptv";

interface EpgGridProps {
  channels: Channel[];
  programs: Map<string, EpgProgram[]>;
  onSelectProgram?: (program: EpgProgram, channel: Channel) => void;
  onSelectChannel?: (channel: Channel) => void;
  className?: string;
}

// Generate demo programs for display
function generateDemoPrograms(channelId: string): EpgProgram[] {
  const now = new Date();
  const programs: EpgProgram[] = [];
  
  const titles = [
    "Morning News", "Weather Update", "Talk Show", "Documentary",
    "Sports Live", "Movie: Action", "Series Episode", "Reality Show",
    "Kids Program", "Music Hour", "Late Night", "Nature Documentary"
  ];

  let currentTime = new Date(now);
  currentTime.setHours(0, 0, 0, 0);

  for (let i = 0; i < 24; i++) {
    const duration = [30, 60, 90, 120][Math.floor(Math.random() * 4)];
    const start = new Date(currentTime);
    const end = new Date(currentTime.getTime() + duration * 60000);
    
    programs.push({
      id: `${channelId}-${i}`,
      channelId,
      start,
      end,
      title: titles[i % titles.length],
      description: "Program description goes here...",
      isLive: now >= start && now < end,
    });

    currentTime = end;
  }

  return programs;
}

export function EpgGrid({
  channels,
  programs,
  onSelectProgram,
  onSelectChannel,
  className,
}: EpgGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const timelineStart = new Date(now);
  timelineStart.setHours(0, 0, 0, 0);

  // Calculate timeline hours
  const hours = useMemo(() => {
    const result = [];
    const start = new Date(timelineStart);
    for (let i = 0; i < 24; i++) {
      result.push(new Date(start.getTime() + i * 60 * 60 * 1000));
    }
    return result;
  }, []);

  // Calculate position for current time indicator
  const nowPosition = useMemo(() => {
    const minutesSinceStart = (now.getTime() - timelineStart.getTime()) / 60000;
    return (minutesSinceStart / 60) * 200; // 200px per hour
  }, [now, timelineStart]);

  const scrollToNow = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = nowPosition - 200;
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">TV Guide</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={scrollToNow}>
            <Clock className="w-4 h-4 mr-1" />
            Now
          </Button>
          <Button variant="ghost" size="icon">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Channel Column */}
        <div className="w-48 flex-shrink-0 border-r border-border">
          {/* Empty corner for timeline alignment */}
          <div className="h-10 border-b border-border bg-muted/30" />
          
          {/* Channel list */}
          <ScrollArea className="h-[calc(100%-40px)]">
            <div className="py-1">
              {channels.slice(0, 20).map((channel) => (
                <div
                  key={channel.id}
                  onClick={() => onSelectChannel?.(channel)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                >
                  <ChannelLogo src={channel.logoUrl} name={channel.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{channel.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Timeline and Programs */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollRef as any}>
            <div className="min-w-max">
              {/* Timeline Header */}
              <div className="sticky top-0 z-10 flex h-10 border-b border-border bg-background/95 backdrop-blur-sm">
                {hours.map((hour, i) => (
                  <div
                    key={i}
                    className="w-[200px] flex-shrink-0 px-3 flex items-center border-r border-border/50"
                  >
                    <span className="text-xs text-muted-foreground">
                      {hour.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Programs Grid */}
              <div className="relative">
                {/* Current Time Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-destructive z-20"
                  style={{ left: `${nowPosition}px` }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-destructive rounded-full" />
                </div>

                {/* Channel Rows */}
                {channels.slice(0, 20).map((channel) => {
                  const channelPrograms = programs.get(channel.id) || generateDemoPrograms(channel.id);
                  
                  return (
                    <div
                      key={channel.id}
                      className="flex h-14 border-b border-border/50"
                    >
                      {channelPrograms.map((program) => {
                        const startMinutes = (program.start.getTime() - timelineStart.getTime()) / 60000;
                        const durationMinutes = (program.end.getTime() - program.start.getTime()) / 60000;
                        const left = (startMinutes / 60) * 200;
                        const width = (durationMinutes / 60) * 200;
                        
                        const isPast = program.end < now;
                        const isNow = program.isLive;

                        return (
                          <div
                            key={program.id}
                            onClick={() => onSelectProgram?.(program, channel)}
                            className={cn(
                              "absolute h-12 my-1 px-2 rounded-md cursor-pointer transition-all hover:z-10",
                              isPast && "epg-cell-past",
                              isNow && "epg-cell-now hover:shadow-glow",
                              !isPast && !isNow && "epg-cell-future hover:bg-muted"
                            )}
                            style={{
                              left: `${left}px`,
                              width: `${width - 4}px`,
                            }}
                          >
                            <div className="flex flex-col justify-center h-full overflow-hidden">
                              <p className="text-sm font-medium truncate">{program.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {program.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                {" - "}
                                {program.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
