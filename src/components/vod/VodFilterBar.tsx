/**
 * VOD Filter Bar - Genre, year, sort filters
 */
import { useState } from 'react';
import { Filter, SortAsc, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VodFilter } from '@/types/vod';
import { useTVMode } from '@/contexts/TVModeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

interface VodFilterBarProps {
  filter: VodFilter;
  availableGenres: string[];
  onFilterChange: (filter: Partial<VodFilter>) => void;
  onClearFilters: () => void;
  totalCount: number;
  className?: string;
}

const sortOptions: { value: VodFilter['sortBy']; label: string }[] = [
  { value: 'addedAt', label: 'Senast tillagda' },
  { value: 'title', label: 'Titel A-Ö' },
  { value: 'year', label: 'År' },
  { value: 'rating', label: 'Betyg' },
];

export function VodFilterBar({
  filter,
  availableGenres,
  onFilterChange,
  onClearFilters,
  totalCount,
  className,
}: VodFilterBarProps) {
  const { isTVMode } = useTVMode();
  const [searchValue, setSearchValue] = useState(filter.searchQuery || '');
  
  const hasActiveFilters = 
    (filter.genres?.length ?? 0) > 0 || 
    filter.yearFrom || 
    filter.yearTo ||
    filter.favoritesOnly;
  
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    // Debounce search
    setTimeout(() => {
      onFilterChange({ searchQuery: value || undefined });
    }, 300);
  };
  
  const toggleGenre = (genre: string) => {
    const currentGenres = filter.genres || [];
    const newGenres = currentGenres.includes(genre)
      ? currentGenres.filter(g => g !== genre)
      : [...currentGenres, genre];
    onFilterChange({ genres: newGenres.length > 0 ? newGenres : undefined });
  };
  
  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-start sm:items-center gap-3",
      isTVMode && "gap-4",
      className
    )}>
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Input
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Sök filmer och serier..."
          className={cn(
            isTVMode && "h-12 text-lg"
          )}
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => handleSearchChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Genre filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={isTVMode ? "lg" : "default"}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Genre
            {filter.genres?.length ? (
              <Badge variant="secondary" className="ml-1">
                {filter.genres.length}
              </Badge>
            ) : null}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
          {availableGenres.map(genre => (
            <DropdownMenuCheckboxItem
              key={genre}
              checked={filter.genres?.includes(genre) || false}
              onCheckedChange={() => toggleGenre(genre)}
            >
              {genre}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={isTVMode ? "lg" : "default"}
            className="gap-2"
          >
            <SortAsc className="h-4 w-4" />
            {sortOptions.find(o => o.value === filter.sortBy)?.label || 'Sortera'}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {sortOptions.map(option => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onFilterChange({ sortBy: option.value })}
              className={cn(
                filter.sortBy === option.value && "bg-muted"
              )}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onFilterChange({ 
              sortOrder: filter.sortOrder === 'asc' ? 'desc' : 'asc' 
            })}
          >
            {filter.sortOrder === 'asc' ? 'Fallande' : 'Stigande'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Favorites toggle */}
      <Button
        variant={filter.favoritesOnly ? "default" : "outline"}
        size={isTVMode ? "lg" : "default"}
        onClick={() => onFilterChange({ favoritesOnly: !filter.favoritesOnly })}
      >
        Favoriter
      </Button>
      
      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size={isTVMode ? "lg" : "default"}
          onClick={onClearFilters}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Rensa filter
        </Button>
      )}
      
      {/* Count */}
      <span className="text-sm text-muted-foreground ml-auto">
        {totalCount} {totalCount === 1 ? 'titel' : 'titlar'}
      </span>
    </div>
  );
}
