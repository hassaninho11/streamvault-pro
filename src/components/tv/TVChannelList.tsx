import { memo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Play, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Channel } from '@/types/iptv';
import { ChannelLogo } from '@/components/ui/custom';
import { useTVMode } from '@/contexts/TVModeContext';

interface TVChannelListProps {
  channels: Channel[];
  selectedChannel?: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite?: (channel: Channel) => void;
  className?: string;
}

const ITEM_HEIGHT = 80; // TV-optimized height
const TV_ITEM_HEIGHT = 100;

// Memoized channel row for performance
const ChannelRow = memo(({ 
  channel, 
  isSelected, 
  isFocused,
  onSelect, 
  onToggleFavorite,
  isTVMode,
  style 
}: { 
  channel: Channel;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onToggleFavorite?: () => void;
  isTVMode: boolean;
  style: React.CSSProperties;
}) => {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && itemRef.current) {
      itemRef.current.focus();
    }
  }, [isFocused]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      onToggleFavorite?.();
    }
  };

  return (
    <div style={style}>
      <div
        ref={itemRef}
        tabIndex={0}
        data-focusable
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-4 mx-2 px-4 rounded-xl cursor-pointer transition-all duration-100",
          "focus:outline-none",
          isTVMode ? "h-[92px] text-lg" : "h-[72px]",
          isSelected 
            ? "bg-primary/20 border-2 border-primary" 
            : "bg-card/50 border border-transparent hover:bg-muted hover:border-border",
          isTVMode 
            ? "focus:ring-4 focus:ring-primary focus:scale-[1.02] focus:shadow-glow"
            : "focus:ring-2 focus:ring-primary"
        )}
      >
        {/* Channel Logo */}
        <ChannelLogo
          src={channel.logoUrl}
          name={channel.name}
          size={isTVMode ? "lg" : "md"}
        />

        {/* Channel Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn(
              "font-semibold truncate",
              isTVMode ? "text-xl" : "text-base"
            )}>
              {channel.name}
            </h3>
            {channel.isHD && (
              <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-bold rounded">
                HD
              </span>
            )}
          </div>
          <p className={cn(
            "text-muted-foreground truncate",
            isTVMode ? "text-base" : "text-sm"
          )}>
            {channel.group}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {channel.isFavorite && (
            <Star className={cn(
              "text-warning fill-warning",
              isTVMode ? "w-6 h-6" : "w-5 h-5"
            )} />
          )}
          {isSelected && (
            <div className={cn(
              "rounded-full bg-primary p-2 text-primary-foreground",
              isTVMode && "p-3"
            )}>
              <Play className={isTVMode ? "w-6 h-6" : "w-4 h-4"} fill="currentColor" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ChannelRow.displayName = 'ChannelRow';

export function TVChannelList({ 
  channels, 
  selectedChannel, 
  onSelectChannel,
  onToggleFavorite,
  className 
}: TVChannelListProps) {
  const { isTVMode } = useTVMode();
  const parentRef = useRef<HTMLDivElement>(null);
  const itemHeight = isTVMode ? TV_ITEM_HEIGHT : ITEM_HEIGHT;

  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 5, // Preload items around visible area
  });

  // Scroll to selected channel
  useEffect(() => {
    if (selectedChannel) {
      const index = channels.findIndex(c => c.id === selectedChannel.id);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: 'center' });
      }
    }
  }, [selectedChannel, channels, virtualizer]);

  const handleSelectChannel = useCallback((channel: Channel) => {
    onSelectChannel(channel);
  }, [onSelectChannel]);

  const handleToggleFavorite = useCallback((channel: Channel) => {
    onToggleFavorite?.(channel);
  }, [onToggleFavorite]);

  return (
    <div 
      ref={parentRef}
      className={cn(
        "h-full overflow-y-auto scrollbar-hide",
        className
      )}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const channel = channels[virtualRow.index];
          const isSelected = selectedChannel?.id === channel.id;
          
          return (
            <ChannelRow
              key={channel.id}
              channel={channel}
              isSelected={isSelected}
              isFocused={false}
              onSelect={() => handleSelectChannel(channel)}
              onToggleFavorite={() => handleToggleFavorite(channel)}
              isTVMode={isTVMode}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
