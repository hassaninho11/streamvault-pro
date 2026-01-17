/**
 * VOD Grid - Virtualized grid for movies/series
 */
import { useRef, useMemo, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { VodItem, Movie, Series } from '@/types/vod';
import { VodCard } from './VodCard';
import { useTVMode } from '@/contexts/TVModeContext';

interface VodGridProps {
  items: (VodItem | Movie | Series)[];
  onItemClick: (item: VodItem) => void;
  onItemPlay?: (item: VodItem) => void;
  onItemInfo?: (item: VodItem) => void;
  onToggleFavorite?: (item: VodItem) => void;
  className?: string;
  columns?: number;
}

export const VodGrid = memo(function VodGrid({
  items,
  onItemClick,
  onItemPlay,
  onItemInfo,
  onToggleFavorite,
  className,
  columns: customColumns,
}: VodGridProps) {
  const { isTVMode } = useTVMode();
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Calculate columns based on mode and container width
  const columns = customColumns || (isTVMode ? 6 : 5);
  const gap = isTVMode ? 24 : 16;
  const rowHeight = isTVMode ? 340 : 280;
  
  // Group items into rows
  const rows = useMemo(() => {
    const result: (VodItem | Movie | Series)[][] = [];
    for (let i = 0; i < items.length; i += columns) {
      result.push(items.slice(i, i + columns));
    }
    return result;
  }, [items, columns]);
  
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 2,
  });
  
  if (items.length === 0) {
    return (
      <div className={cn(
        "flex items-center justify-center py-20",
        className
      )}>
        <p className="text-muted-foreground text-center">
          Inget innehåll hittades
        </p>
      </div>
    );
  }
  
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
          const row = rows[virtualRow.index];
          
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="flex"
            >
              <div
                className="grid w-full"
                style={{
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gap: `${gap}px`,
                }}
              >
                {row.map((item) => (
                  <VodCard
                    key={item.id}
                    item={item}
                    onClick={() => onItemClick(item)}
                    onPlay={onItemPlay ? () => onItemPlay(item) : undefined}
                    onInfo={onItemInfo ? () => onItemInfo(item) : undefined}
                    onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(item) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
