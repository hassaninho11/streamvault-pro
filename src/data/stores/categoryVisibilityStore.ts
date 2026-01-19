/**
 * CategoryVisibilityStore - Manages which categories are visible in each section
 * Used to filter out unwanted categories from UI and indexing for better performance
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CategorySection = 'live' | 'movies' | 'series';

export interface Category {
  id: string;
  providerId: string;
  section: CategorySection;
  name: string;
  normalizedName: string;
  itemCount: number;
}

interface CategoryVisibilityState {
  // Visible category IDs by section
  visibleCategoryIds: {
    live: Set<string>;
    movies: Set<string>;
    series: Set<string>;
  };
  
  // Track if visibility has been configured (to distinguish from "show all" default)
  hasConfigured: {
    live: boolean;
    movies: boolean;
    series: boolean;
  };
  
  // Include hidden categories in search
  includeHiddenInSearch: boolean;
  
  // Draft state for Settings UI
  draftVisibility: {
    live: Set<string>;
    movies: Set<string>;
    series: Set<string>;
  } | null;
  
  isDirty: boolean;
  
  // Actions
  isVisible: (section: CategorySection, categoryId: string) => boolean;
  setVisible: (section: CategorySection, categoryId: string, visible: boolean) => void;
  setBulkVisible: (section: CategorySection, categoryIds: string[], visible: boolean) => void;
  setAllVisible: (section: CategorySection, categoryIds: string[]) => void;
  setNoneVisible: (section: CategorySection) => void;
  getVisibleIds: (section: CategorySection) => Set<string>;
  
  // Draft management for Settings
  startEditing: () => void;
  updateDraft: (section: CategorySection, categoryId: string, visible: boolean) => void;
  updateDraftBulk: (section: CategorySection, categoryIds: string[], visible: boolean) => void;
  setDraftAll: (section: CategorySection, categoryIds: string[]) => void;
  setDraftNone: (section: CategorySection) => void;
  saveDraft: () => void;
  cancelDraft: () => void;
  getDraftVisibility: (section: CategorySection, categoryId: string) => boolean;
  
  // Search setting
  setIncludeHiddenInSearch: (include: boolean) => void;
  
  // Initialize with all categories visible for a section
  initializeSection: (section: CategorySection, categoryIds: string[]) => void;
}

// Helper to create stable category ID
export function createCategoryId(providerId: string, section: CategorySection, name: string): string {
  const normalized = name.toLowerCase().trim().replace(/\s+/g, '_');
  return `${providerId}-${section}-${normalized}`;
}

// Helper to normalize category name
export function normalizeCategoryName(name: string): string {
  return name.toLowerCase().trim();
}

export const useCategoryVisibilityStore = create<CategoryVisibilityState>()(
  persist(
    (set, get) => ({
      visibleCategoryIds: {
        live: new Set<string>(),
        movies: new Set<string>(),
        series: new Set<string>(),
      },
      hasConfigured: {
        live: false,
        movies: false,
        series: false,
      },
      includeHiddenInSearch: false,
      draftVisibility: null,
      isDirty: false,
      
      isVisible: (section, categoryId) => {
        const state = get();
        // If not configured yet, treat all as visible
        if (!state.hasConfigured[section]) {
          return true;
        }
        return state.visibleCategoryIds[section].has(categoryId);
      },
      
      setVisible: (section, categoryId, visible) => {
        set((state) => {
          const newSet = new Set(state.visibleCategoryIds[section]);
          if (visible) {
            newSet.add(categoryId);
          } else {
            newSet.delete(categoryId);
          }
          return {
            visibleCategoryIds: {
              ...state.visibleCategoryIds,
              [section]: newSet,
            },
            hasConfigured: {
              ...state.hasConfigured,
              [section]: true,
            },
          };
        });
      },
      
      setBulkVisible: (section, categoryIds, visible) => {
        set((state) => {
          const newSet = new Set(state.visibleCategoryIds[section]);
          for (const id of categoryIds) {
            if (visible) {
              newSet.add(id);
            } else {
              newSet.delete(id);
            }
          }
          return {
            visibleCategoryIds: {
              ...state.visibleCategoryIds,
              [section]: newSet,
            },
            hasConfigured: {
              ...state.hasConfigured,
              [section]: true,
            },
          };
        });
      },
      
      setAllVisible: (section, categoryIds) => {
        set((state) => ({
          visibleCategoryIds: {
            ...state.visibleCategoryIds,
            [section]: new Set(categoryIds),
          },
          hasConfigured: {
            ...state.hasConfigured,
            [section]: true,
          },
        }));
      },
      
      setNoneVisible: (section) => {
        set((state) => ({
          visibleCategoryIds: {
            ...state.visibleCategoryIds,
            [section]: new Set<string>(),
          },
          hasConfigured: {
            ...state.hasConfigured,
            [section]: true,
          },
        }));
      },
      
      getVisibleIds: (section) => {
        return get().visibleCategoryIds[section];
      },
      
      // Draft management
      startEditing: () => {
        const state = get();
        set({
          draftVisibility: {
            live: new Set(state.visibleCategoryIds.live),
            movies: new Set(state.visibleCategoryIds.movies),
            series: new Set(state.visibleCategoryIds.series),
          },
          isDirty: false,
        });
      },
      
      updateDraft: (section, categoryId, visible) => {
        set((state) => {
          if (!state.draftVisibility) return state;
          const newDraft = {
            ...state.draftVisibility,
            [section]: new Set(state.draftVisibility[section]),
          };
          if (visible) {
            newDraft[section].add(categoryId);
          } else {
            newDraft[section].delete(categoryId);
          }
          return { draftVisibility: newDraft, isDirty: true };
        });
      },
      
      updateDraftBulk: (section, categoryIds, visible) => {
        set((state) => {
          if (!state.draftVisibility) return state;
          const newDraft = {
            ...state.draftVisibility,
            [section]: new Set(state.draftVisibility[section]),
          };
          for (const id of categoryIds) {
            if (visible) {
              newDraft[section].add(id);
            } else {
              newDraft[section].delete(id);
            }
          }
          return { draftVisibility: newDraft, isDirty: true };
        });
      },
      
      setDraftAll: (section, categoryIds) => {
        set((state) => {
          if (!state.draftVisibility) return state;
          return {
            draftVisibility: {
              ...state.draftVisibility,
              [section]: new Set(categoryIds),
            },
            isDirty: true,
          };
        });
      },
      
      setDraftNone: (section) => {
        set((state) => {
          if (!state.draftVisibility) return state;
          return {
            draftVisibility: {
              ...state.draftVisibility,
              [section]: new Set<string>(),
            },
            isDirty: true,
          };
        });
      },
      
      saveDraft: () => {
        const state = get();
        if (!state.draftVisibility) return;
        
        set({
          visibleCategoryIds: {
            live: new Set(state.draftVisibility.live),
            movies: new Set(state.draftVisibility.movies),
            series: new Set(state.draftVisibility.series),
          },
          hasConfigured: {
            live: true,
            movies: true,
            series: true,
          },
          draftVisibility: null,
          isDirty: false,
        });
      },
      
      cancelDraft: () => {
        set({
          draftVisibility: null,
          isDirty: false,
        });
      },
      
      getDraftVisibility: (section, categoryId) => {
        const state = get();
        if (state.draftVisibility) {
          return state.draftVisibility[section].has(categoryId);
        }
        // Fall back to current visibility
        if (!state.hasConfigured[section]) {
          return true;
        }
        return state.visibleCategoryIds[section].has(categoryId);
      },
      
      setIncludeHiddenInSearch: (include) => {
        set({ includeHiddenInSearch: include });
      },
      
      initializeSection: (section, categoryIds) => {
        const state = get();
        // Only initialize if not already configured
        if (!state.hasConfigured[section]) {
          set({
            visibleCategoryIds: {
              ...state.visibleCategoryIds,
              [section]: new Set(categoryIds),
            },
          });
        }
      },
    }),
    {
      name: 'streamvault-category-visibility',
      partialize: (state) => ({
        visibleCategoryIds: {
          live: Array.from(state.visibleCategoryIds.live),
          movies: Array.from(state.visibleCategoryIds.movies),
          series: Array.from(state.visibleCategoryIds.series),
        },
        hasConfigured: state.hasConfigured,
        includeHiddenInSearch: state.includeHiddenInSearch,
      }),
      merge: (persisted: any, current) => ({
        ...current,
        visibleCategoryIds: {
          live: new Set(persisted?.visibleCategoryIds?.live || []),
          movies: new Set(persisted?.visibleCategoryIds?.movies || []),
          series: new Set(persisted?.visibleCategoryIds?.series || []),
        },
        hasConfigured: persisted?.hasConfigured || { live: false, movies: false, series: false },
        includeHiddenInSearch: persisted?.includeHiddenInSearch || false,
      }),
    }
  )
);

// ============= Selectors =============

export const useVisibleCategoryIds = (section: CategorySection): Set<string> => {
  return useCategoryVisibilityStore((state) => state.visibleCategoryIds[section]);
};

export const useHasConfigured = (section: CategorySection): boolean => {
  return useCategoryVisibilityStore((state) => state.hasConfigured[section]);
};

export const useIncludeHiddenInSearch = (): boolean => {
  return useCategoryVisibilityStore((state) => state.includeHiddenInSearch);
};
