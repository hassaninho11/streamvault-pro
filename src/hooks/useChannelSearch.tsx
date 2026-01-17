/**
 * useChannelSearch - Hook for global channel search shortcut
 * Opens search dialog with Ctrl+K / Cmd+K
 */

import { useState, useEffect, useCallback } from "react";

export function useChannelSearch() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        toggle();
        return;
      }
      
      // Also open with / when not in input
      if (e.key === "/" && !isOpen) {
        const activeEl = document.activeElement;
        const isInputFocused =
          activeEl?.tagName === "INPUT" ||
          activeEl?.tagName === "TEXTAREA" ||
          activeEl?.getAttribute("contenteditable") === "true";
        
        if (!isInputFocused) {
          e.preventDefault();
          open();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, open, toggle]);

  return {
    isOpen,
    setIsOpen,
    open,
    close,
    toggle,
  };
}
