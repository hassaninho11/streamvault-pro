import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface TVModeContextType {
  isTVMode: boolean;
  setTVMode: (enabled: boolean) => void;
  toggleTVMode: () => void;
}

const TVModeContext = createContext<TVModeContextType | undefined>(undefined);

// Detect if running on a TV-like environment
function detectTVEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  const tvPatterns = [
    'tizen',
    'webos',
    'web0s',
    'smart-tv',
    'smarttv',
    'netcast',
    'appletv',
    'roku',
    'crkey', // Chromecast
    'firetv',
    'android tv',
    'googletv',
    'hbbtv',
    'vidaa',
    'viera',
    'bravia'
  ];
  
  const isTVUserAgent = tvPatterns.some(pattern => ua.includes(pattern));
  
  // Check for large screen (TV typically 1920x1080+) with low pixel density
  const isLargeScreen = window.innerWidth >= 1280 && window.innerHeight >= 720;
  const isLowDensity = window.devicePixelRatio <= 1.5;
  
  // Check if no touch support (TVs typically don't have touch)
  const hasNoTouch = !('ontouchstart' in window) && navigator.maxTouchPoints === 0;
  
  return isTVUserAgent || (isLargeScreen && isLowDensity && hasNoTouch);
}

export function TVModeProvider({ children }: { children: ReactNode }) {
  const [isTVMode, setIsTVMode] = useState(() => {
    // Check localStorage first
    const stored = localStorage.getItem('streamvault-tv-mode');
    if (stored !== null) {
      return stored === 'true';
    }
    // Auto-detect
    return detectTVEnvironment();
  });

  const setTVMode = useCallback((enabled: boolean) => {
    setIsTVMode(enabled);
    localStorage.setItem('streamvault-tv-mode', String(enabled));
    
    // Update body class for global TV styling
    if (enabled) {
      document.body.classList.add('tv-mode');
    } else {
      document.body.classList.remove('tv-mode');
    }
  }, []);

  const toggleTVMode = useCallback(() => {
    setTVMode(!isTVMode);
  }, [isTVMode, setTVMode]);

  // Apply TV mode class on mount
  useEffect(() => {
    if (isTVMode) {
      document.body.classList.add('tv-mode');
    }
    return () => {
      document.body.classList.remove('tv-mode');
    };
  }, [isTVMode]);

  return (
    <TVModeContext.Provider value={{ isTVMode, setTVMode, toggleTVMode }}>
      {children}
    </TVModeContext.Provider>
  );
}

export function useTVMode() {
  const context = useContext(TVModeContext);
  if (context === undefined) {
    throw new Error('useTVMode must be used within a TVModeProvider');
  }
  return context;
}
