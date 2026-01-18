/**
 * Paginated VOD Grid - Efficient grid with pagination for large datasets
 */
import { useState, useMemo, useCallback, memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VodItem, Movie, Series } from '@/types/vod';
import { VodCard } from './VodCard';
import { useTVMode } from '@/contexts/TVModeContext';
import { Button } from '@/components/ui/button';

interface PaginatedVodGridProps {
  items: (VodItem | Movie | Series)[];
  onItemClick: (item: VodItem) => void;
  onItemPlay?: (item: VodItem) => void;
  onItemInfo?: (item: VodItem) => void;
  onToggleFavorite?: (item: VodItem) => void;
  className?: string;
  itemsPerPage?: number;
}

const ITEMS_PER_PAGE_DEFAULT = 24;
const ITEMS_PER_PAGE_TV = 18;

export const PaginatedVodGrid = memo(function PaginatedVodGrid({
  items,
  onItemClick,
  onItemPlay,
  onItemInfo,
  onToggleFavorite,
  className,
  itemsPerPage: customItemsPerPage,
}: PaginatedVodGridProps) {
  const { isTVMode } = useTVMode();
  const [currentPage, setCurrentPage] = useState(1);
  
  const itemsPerPage = customItemsPerPage || (isTVMode ? ITEMS_PER_PAGE_TV : ITEMS_PER_PAGE_DEFAULT);
  const totalPages = Math.ceil(items.length / itemsPerPage);
  
  // Get current page items
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return items.slice(start, end);
  }, [items, currentPage, itemsPerPage]);
  
  // Reset to page 1 when items change significantly
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [items.length, totalPages, currentPage]);
  
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    // Scroll to top of grid
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [totalPages]);
  
  const columns = isTVMode ? 6 : 5;
  const gap = isTVMode ? 24 : 16;
  
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
  
  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const showPages = 5;
    
    if (totalPages <= showPages + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('ellipsis');
      }
      
      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  };
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Grid */}
      <div className="flex-1 overflow-y-auto pb-4">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: `${gap}px`,
          }}
        >
          {currentItems.map((item) => (
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
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4 border-t border-border bg-background/80 backdrop-blur-sm sticky bottom-0">
          {/* Previous button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Föregående</span>
          </Button>
          
          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, idx) => (
              page === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(page)}
                  className={cn(
                    "min-w-[36px]",
                    currentPage === page && "pointer-events-none"
                  )}
                >
                  {page}
                </Button>
              )
            ))}
          </div>
          
          {/* Next button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="gap-1"
          >
            <span className="hidden sm:inline">Nästa</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
          
          {/* Page info */}
          <span className="text-sm text-muted-foreground ml-4">
            {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, items.length)} av {items.length}
          </span>
        </div>
      )}
    </div>
  );
});
