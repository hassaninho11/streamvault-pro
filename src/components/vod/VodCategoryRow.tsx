/**
 * VOD Category Row - Horizontal scrolling row of VOD items
 */
import { useRef, useCallback, memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VodCategory, VodItem } from '@/types/vod';
import { VodCard } from './VodCard';
import { useTVMode } from '@/contexts/TVModeContext';
import { Button } from '@/components/ui/button';

interface VodCategoryRowProps {
  category: VodCategory;
  onItemClick: (item: VodItem) => void;
  onItemPlay?: (item: VodItem) => void;
  onItemInfo?: (item: VodItem) => void;
  onSeeAll?: () => void;
  className?: string;
}

export const VodCategoryRow = memo(function VodCategoryRow({
  category,
  onItemClick,
  onItemPlay,
  onItemInfo,
  onSeeAll,
  className,
}: VodCategoryRowProps) {
  const { isTVMode } = useTVMode();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    
    const scrollAmount = isTVMode ? 400 : 300;
    const newScroll = scrollRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
    scrollRef.current.scrollTo({ left: newScroll, behavior: 'smooth' });
  }, [isTVMode]);
  
  const cardWidth = isTVMode ? 'w-48' : 'w-36 sm:w-40';
  
  return (
    <section className={cn("relative", className)}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between mb-3",
        isTVMode ? "mb-4 px-2" : "mb-3"
      )}>
        <h2 className={cn(
          "font-bold",
          isTVMode ? "text-2xl" : "text-lg sm:text-xl"
        )}>
          {category.name}
        </h2>
        
        <div className="flex items-center gap-2">
          {onSeeAll && (
            <Button
              variant="ghost"
              size={isTVMode ? "lg" : "sm"}
              onClick={onSeeAll}
              className="text-muted-foreground hover:text-foreground"
            >
              Visa alla
            </Button>
          )}
          
          {/* Scroll buttons (desktop) */}
          <div className="hidden sm:flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => scroll('left')}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => scroll('right')}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Scrollable row */}
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth",
          isTVMode ? "gap-4 pb-4" : "gap-3 pb-2",
          "snap-x snap-mandatory"
        )}
      >
        {category.items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex-shrink-0 snap-start",
              cardWidth
            )}
          >
            <VodCard
              item={item}
              onClick={() => onItemClick(item)}
              onPlay={onItemPlay ? () => onItemPlay(item) : undefined}
              onInfo={onItemInfo ? () => onItemInfo(item) : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  );
});
