/**
 * CategoryVisibilitySettings - Settings component for managing category visibility
 * Allows users to toggle which categories are visible in Live TV, Movies, and Series
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Tv, Film, MonitorPlay, Check, X, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  useCategoryVisibilityStore, 
  CategorySection, 
  createCategoryId 
} from '@/data/stores/categoryVisibilityStore';
import { useChannelStore } from '@/data/stores/channelStore';
import { useVodStore } from '@/data/stores/vodStore';
import { getGroupsWithCounts } from '@/core/indexing/channelIndex';

interface CategoryItem {
  id: string;
  name: string;
  count: number;
}

interface SectionData {
  categories: CategoryItem[];
  totalItems: number;
}

export function CategoryVisibilitySettings() {
  const [activeTab, setActiveTab] = useState<CategorySection>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const hasStartedEditing = useRef(false);
  
  // Store state - individual selectors for stability
  const draftVisibility = useCategoryVisibilityStore((s) => s.draftVisibility);
  const isDirty = useCategoryVisibilityStore((s) => s.isDirty);
  const includeHiddenInSearch = useCategoryVisibilityStore((s) => s.includeHiddenInSearch);
  
  // Get channel index for groups
  const channelIndex = useChannelStore((s) => s.index);
  const movies = useVodStore((s) => s.movies);
  const series = useVodStore((s) => s.series);
  
  // Compute groups from index (stable reference when index doesn't change)
  const liveGroups = useMemo(() => {
    if (!channelIndex) return [];
    return getGroupsWithCounts(channelIndex);
  }, [channelIndex]);
  
  // Start editing mode on mount (only once)
  useEffect(() => {
    if (!hasStartedEditing.current) {
      hasStartedEditing.current = true;
      // Access store directly for actions - they are stable
      useCategoryVisibilityStore.getState().startEditing();
    }
    return () => {
      useCategoryVisibilityStore.getState().cancelDraft();
    };
  }, []);
  
  // Build category lists for each section
  const sectionData = useMemo((): Record<CategorySection, SectionData> => {
    // Live categories from channel groups
    const liveCategories: CategoryItem[] = liveGroups.map((g) => ({
      id: createCategoryId('default', 'live', g.name),
      name: g.name,
      count: g.count,
    }));
    
    // Movie categories from genres
    const movieGenreMap = new Map<string, number>();
    movies.forEach((m) => {
      m.genres.forEach((genre) => {
        movieGenreMap.set(genre, (movieGenreMap.get(genre) || 0) + 1);
      });
    });
    const movieCategories: CategoryItem[] = Array.from(movieGenreMap.entries())
      .map(([name, count]) => ({
        id: createCategoryId('default', 'movies', name),
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
    
    // Series categories from genres
    const seriesGenreMap = new Map<string, number>();
    series.forEach((s) => {
      s.genres.forEach((genre) => {
        seriesGenreMap.set(genre, (seriesGenreMap.get(genre) || 0) + 1);
      });
    });
    const seriesCategories: CategoryItem[] = Array.from(seriesGenreMap.entries())
      .map(([name, count]) => ({
        id: createCategoryId('default', 'series', name),
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
    
    return {
      live: {
        categories: liveCategories,
        totalItems: liveCategories.reduce((sum, c) => sum + c.count, 0),
      },
      movies: {
        categories: movieCategories,
        totalItems: movies.length,
      },
      series: {
        categories: seriesCategories,
        totalItems: series.length,
      },
    };
  }, [liveGroups, movies, series]);
  
  // Filter categories by search
  const filteredCategories = useMemo(() => {
    const data = sectionData[activeTab];
    if (!searchQuery.trim()) {
      return data.categories;
    }
    const query = searchQuery.toLowerCase();
    return data.categories.filter((c) => c.name.toLowerCase().includes(query));
  }, [sectionData, activeTab, searchQuery]);
  
  // Calculate visible counts - use draftVisibility directly
  const visibleCount = useMemo(() => {
    if (!draftVisibility) return 0;
    return draftVisibility[activeTab].size;
  }, [draftVisibility, activeTab]);
  
  const allCategoryIds = useMemo(() => {
    return sectionData[activeTab].categories.map((c) => c.id);
  }, [sectionData, activeTab]);
  
  // Check visibility using the draft directly (not a store method)
  const isVisibleInDraft = useCallback((section: CategorySection, categoryId: string): boolean => {
    if (!draftVisibility) return true;
    return draftVisibility[section].has(categoryId);
  }, [draftVisibility]);
  
  // Use store.getState() for actions to avoid dependency issues
  const handleToggle = useCallback((categoryId: string, visible: boolean) => {
    useCategoryVisibilityStore.getState().updateDraft(activeTab, categoryId, visible);
  }, [activeTab]);
  
  const handleSelectAll = useCallback(() => {
    useCategoryVisibilityStore.getState().setDraftAll(activeTab, allCategoryIds);
  }, [activeTab, allCategoryIds]);
  
  const handleDeselectAll = useCallback(() => {
    useCategoryVisibilityStore.getState().setDraftNone(activeTab);
  }, [activeTab]);
  
  const handleSave = useCallback(() => {
    const store = useCategoryVisibilityStore.getState();
    store.saveDraft();
    // Re-start editing mode for continued editing
    store.startEditing();
  }, []);
  
  const handleCancel = useCallback(() => {
    const store = useCategoryVisibilityStore.getState();
    store.cancelDraft();
    store.startEditing();
  }, []);
  
  const handleIncludeHiddenChange = useCallback((checked: boolean) => {
    useCategoryVisibilityStore.getState().setIncludeHiddenInSearch(checked);
  }, []);
  
  // Show warning if no categories are visible
  const showNoVisibleWarning = visibleCount === 0 && draftVisibility !== null;
  
  // Guard: don't render until draft is initialized
  if (!draftVisibility) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Kategorisynlighet
            </CardTitle>
            <CardDescription>
              Laddar kategorier...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Kategorisynlighet
          </CardTitle>
          <CardDescription>
            Välj vilka kategorier som ska visas. Dolda kategorier laddas inte i listor vilket förbättrar prestanda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs for sections */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CategorySection)}>
            <TabsList className="grid w-full grid-cols-3">
              {(['live', 'movies', 'series'] as const).map((section) => {
                const Icon = section === 'live' ? Tv : section === 'movies' ? Film : MonitorPlay;
                const label = section === 'live' ? 'Live TV' : section === 'movies' ? 'Filmer' : 'Serier';
                const data = sectionData[section];
                return (
                  <TabsTrigger key={section} value={section} className="gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {data.categories.length}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            
            {(['live', 'movies', 'series'] as const).map((section) => (
              <TabsContent key={section} value={section} className="space-y-4 mt-4">
                {/* Search and bulk actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Sök kategorier..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Välj alla
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAll}
                      className="gap-1"
                    >
                      <X className="w-3 h-3" />
                      Avmarkera
                    </Button>
                  </div>
                </div>
                
                {/* Stats bar */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {visibleCount} av {sectionData[section].categories.length} kategorier synliga
                  </span>
                  <span>
                    {sectionData[section].totalItems.toLocaleString()} objekt totalt
                  </span>
                </div>
                
                {/* Warning if no categories visible */}
                {showNoVisibleWarning && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Du har inte valt någon kategori. Du kommer inte se något innehåll förrän du aktiverar minst en kategori.
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Category list */}
                <ScrollArea className="h-[400px] rounded-lg border border-border">
                  <div className="p-2 space-y-1">
                    {filteredCategories.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchQuery ? 'Inga kategorier matchar sökningen' : 'Inga kategorier tillgängliga'}
                      </div>
                    ) : (
                      filteredCategories.map((category) => {
                        const isVisible = isVisibleInDraft(section, category.id);
                        return (
                          <CategoryRow
                            key={category.id}
                            category={category}
                            section={section}
                            isVisible={isVisible}
                            onToggle={handleToggle}
                          />
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
          
          <Separator />
          
          {/* Search settings */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Inkludera dolda i sök</Label>
              <p className="text-sm text-muted-foreground">
                Global sök kan inkludera dolda kategorier
              </p>
            </div>
            <Switch
              checked={includeHiddenInSearch}
              onCheckedChange={handleIncludeHiddenChange}
            />
          </div>
          
          {/* Info text */}
          <Alert>
            <EyeOff className="w-4 h-4" />
            <AlertDescription>
              Dolda kategorier kan återaktiveras när som helst. Ändringar sparas först när du klickar "Spara".
            </AlertDescription>
          </Alert>
          
          {/* Action buttons */}
          {isDirty && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleCancel}>
                Avbryt
              </Button>
              <Button onClick={handleSave}>
                Spara ändringar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Memoized category row to prevent re-renders
interface CategoryRowProps {
  category: CategoryItem;
  section: CategorySection;
  isVisible: boolean;
  onToggle: (categoryId: string, visible: boolean) => void;
}

function CategoryRow({ category, section, isVisible, onToggle }: CategoryRowProps) {
  const handleChange = useCallback((checked: boolean) => {
    onToggle(category.id, checked);
  }, [category.id, onToggle]);
  
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg transition-colors",
        "hover:bg-muted/50 focus-within:ring-2 focus-within:ring-primary",
        isVisible ? "bg-transparent" : "bg-muted/30 opacity-60"
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Switch
          id={`category-${section}-${category.id}`}
          checked={isVisible}
          onCheckedChange={handleChange}
          className="shrink-0"
        />
        <Label
          htmlFor={`category-${section}-${category.id}`}
          className="cursor-pointer flex-1 min-w-0"
        >
          <span className={cn(
            "block truncate",
            !isVisible && "line-through"
          )}>
            {category.name}
          </span>
        </Label>
      </div>
      <Badge variant="outline" className="shrink-0 ml-2">
        {category.count.toLocaleString()}
      </Badge>
    </div>
  );
}
