import { useCallback, useEffect, useRef, useState } from 'react';
import { useTVMode } from '@/contexts/TVModeContext';

interface FocusableElement {
  id: string;
  element: HTMLElement;
  row: number;
  col: number;
  group?: string;
}

interface FocusManagerOptions {
  group?: string;
  rememberLastFocus?: boolean;
  wrapAround?: boolean;
  onBack?: () => void;
}

// Global focus state per screen
const lastFocusPerScreen = new Map<string, string>();

export function useFocusManager(screenId: string, options: FocusManagerOptions = {}) {
  const { isTVMode } = useTVMode();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const elementsRef = useRef<Map<string, FocusableElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    group, 
    rememberLastFocus = true, 
    wrapAround = false,
    onBack 
  } = options;

  // Register a focusable element
  const registerFocusable = useCallback((
    id: string, 
    element: HTMLElement, 
    row: number, 
    col: number,
    elementGroup?: string
  ) => {
    elementsRef.current.set(id, { 
      id, 
      element, 
      row, 
      col, 
      group: elementGroup || group 
    });
  }, [group]);

  // Unregister a focusable element
  const unregisterFocusable = useCallback((id: string) => {
    elementsRef.current.delete(id);
  }, []);

  // Focus a specific element by ID
  const focusElement = useCallback((id: string) => {
    const item = elementsRef.current.get(id);
    if (item) {
      item.element.focus();
      setFocusedId(id);
      if (rememberLastFocus) {
        lastFocusPerScreen.set(screenId, id);
      }
    }
  }, [screenId, rememberLastFocus]);

  // Get elements in the current group (or all if no group)
  const getGroupElements = useCallback(() => {
    const elements = Array.from(elementsRef.current.values());
    if (group) {
      return elements.filter(el => el.group === group);
    }
    return elements;
  }, [group]);

  // Navigate in a direction
  const navigate = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const elements = getGroupElements();
    if (elements.length === 0) return;

    const currentElement = focusedId ? elementsRef.current.get(focusedId) : null;
    
    if (!currentElement) {
      // Focus first element if nothing focused
      const sorted = [...elements].sort((a, b) => a.row - b.row || a.col - b.col);
      if (sorted[0]) {
        focusElement(sorted[0].id);
      }
      return;
    }

    let candidates: FocusableElement[] = [];
    
    switch (direction) {
      case 'up':
        candidates = elements.filter(el => el.row < currentElement.row);
        break;
      case 'down':
        candidates = elements.filter(el => el.row > currentElement.row);
        break;
      case 'left':
        candidates = elements.filter(el => 
          el.row === currentElement.row && el.col < currentElement.col
        );
        break;
      case 'right':
        candidates = elements.filter(el => 
          el.row === currentElement.row && el.col > currentElement.col
        );
        break;
    }

    if (candidates.length === 0 && wrapAround) {
      // Wrap around logic
      switch (direction) {
        case 'up':
          candidates = elements.filter(el => el.row === Math.max(...elements.map(e => e.row)));
          break;
        case 'down':
          candidates = elements.filter(el => el.row === Math.min(...elements.map(e => e.row)));
          break;
        case 'left':
          candidates = elements.filter(el => 
            el.row === currentElement.row && el.col === Math.max(...elements.filter(e => e.row === currentElement.row).map(e => e.col))
          );
          break;
        case 'right':
          candidates = elements.filter(el => 
            el.row === currentElement.row && el.col === Math.min(...elements.filter(e => e.row === currentElement.row).map(e => e.col))
          );
          break;
      }
    }

    if (candidates.length === 0) return;

    // Find closest candidate
    let closest = candidates[0];
    let minDistance = Infinity;

    for (const candidate of candidates) {
      const distance = Math.abs(candidate.row - currentElement.row) + 
                      Math.abs(candidate.col - currentElement.col);
      if (distance < minDistance) {
        minDistance = distance;
        closest = candidate;
      }
    }

    focusElement(closest.id);
  }, [focusedId, focusElement, getGroupElements, wrapAround]);

  // Handle keyboard events
  useEffect(() => {
    if (!isTVMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if we're in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          navigate('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigate('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          navigate('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigate('right');
          break;
        case 'Enter':
        case ' ':
          // Let the focused element handle Enter/Space
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          onBack?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTVMode, navigate, onBack]);

  // Restore last focus on mount
  useEffect(() => {
    if (!isTVMode || !rememberLastFocus) return;
    
    const lastId = lastFocusPerScreen.get(screenId);
    if (lastId && elementsRef.current.has(lastId)) {
      // Small delay to ensure elements are registered
      setTimeout(() => focusElement(lastId), 50);
    }
  }, [isTVMode, screenId, rememberLastFocus, focusElement]);

  return {
    containerRef,
    focusedId,
    focusElement,
    registerFocusable,
    unregisterFocusable,
    navigate
  };
}

// Hook for individual focusable items
export function useFocusable(
  id: string,
  row: number,
  col: number,
  register: (id: string, el: HTMLElement, row: number, col: number) => void,
  unregister: (id: string) => void
) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current) {
      register(id, ref.current, row, col);
    }
    return () => unregister(id);
  }, [id, row, col, register, unregister]);

  return ref;
}
