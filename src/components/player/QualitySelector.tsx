import { useState } from "react";
import { Check, Settings, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QualityLevel {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
}

interface QualitySelectorProps {
  levels: QualityLevel[];
  currentLevel: number; // -1 = Auto
  onSelectLevel: (level: number) => void;
  isAuto: boolean;
  autoLabel?: string;
  className?: string;
}

export function QualitySelector({
  levels,
  currentLevel,
  onSelectLevel,
  isAuto,
  autoLabel = "Auto",
  className,
}: QualitySelectorProps) {
  const [open, setOpen] = useState(false);

  const getCurrentLabel = () => {
    if (isAuto) {
      const active = levels.find((l) => l.index === currentLevel);
      return active ? `Auto (${active.label})` : autoLabel;
    }
    const level = levels.find((l) => l.index === currentLevel);
    return level?.label || autoLabel;
  };

  const formatBitrate = (bitrate: number) => {
    if (bitrate >= 1000000) {
      return `${(bitrate / 1000000).toFixed(1)} Mbps`;
    }
    return `${Math.round(bitrate / 1000)} Kbps`;
  };

  if (levels.length === 0) {
    return null;
  }

  // Sort levels by height descending (highest quality first)
  const sortedLevels = [...levels].sort((a, b) => b.height - a.height);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="player"
          size="icon"
          className={cn("relative", className)}
          title={`Kvalitet: ${getCurrentLabel()}`}
        >
          <Settings className="w-5 h-5" />
          {!isAuto && (
            <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-primary text-primary-foreground rounded px-1">
              {levels.find((l) => l.index === currentLevel)?.height || ""}p
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] bg-popover/95 backdrop-blur-md border-border"
      >
        {/* Auto option */}
        <DropdownMenuItem
          onClick={() => onSelectLevel(-1)}
          className="flex items-center justify-between gap-2 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            {isAuto && <Check className="w-4 h-4 text-primary" />}
            {!isAuto && <span className="w-4" />}
            <span>{autoLabel}</span>
          </span>
          {isAuto && currentLevel >= 0 && (
            <span className="text-xs text-muted-foreground">
              {levels.find((l) => l.index === currentLevel)?.label}
            </span>
          )}
        </DropdownMenuItem>

        {/* Quality levels */}
        {sortedLevels.map((level) => (
          <DropdownMenuItem
            key={level.index}
            onClick={() => onSelectLevel(level.index)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {!isAuto && currentLevel === level.index && (
                <Check className="w-4 h-4 text-primary" />
              )}
              {(isAuto || currentLevel !== level.index) && <span className="w-4" />}
              <span className={cn(level.height >= 720 && "font-semibold")}>
                {level.label}
              </span>
              {level.height >= 1080 && (
                <span className="text-[10px] bg-primary/20 text-primary px-1 rounded">
                  HD
                </span>
              )}
              {level.height >= 2160 && (
                <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded">
                  4K
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatBitrate(level.bitrate)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
