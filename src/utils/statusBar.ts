import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// Fallback status bar heights for common devices (in pixels)
// Pixel 9 Pro XL has high DPI, needs ~56px
const ANDROID_STATUS_BAR_FALLBACK = 56;
const IOS_STATUS_BAR_FALLBACK = 47;

/**
 * Initialize status bar and safe area configuration for Android/iOS
 * Uses multiple strategies to ensure content doesn't overlap status bar
 */
export async function initializeStatusBar(): Promise<void> {
  // Only run on native platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('[StatusBar] Not a native platform, skipping');
    return;
  }

  const platform = Capacitor.getPlatform();
  console.log('[StatusBar] Initializing for platform:', platform);

  try {
    // Strategy 1: Try to prevent overlay (works on some Android versions)
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      console.log('[StatusBar] setOverlaysWebView(false) succeeded');
    } catch (e) {
      console.warn('[StatusBar] setOverlaysWebView failed:', e);
    }

    // Set dark style (light text) to match dark theme
    await StatusBar.setStyle({ style: Style.Dark });

    // Set background color to match app background (Android only)
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0c1018' });
    }

    // Strategy 2: Try capacitor-plugin-safe-area
    let insetsApplied = false;
    try {
      const { SafeArea } = await import('capacitor-plugin-safe-area');
      const { insets } = await SafeArea.getSafeAreaInsets();
      console.log('[SafeArea] Got insets from plugin:', insets);
      
      if (insets.top > 0) {
        setSafeAreaCSSVariables(insets);
        insetsApplied = true;
      }

      // Listen for changes
      SafeArea.addListener('safeAreaChanged', (data) => {
        console.log('[SafeArea] Insets changed:', data.insets);
        setSafeAreaCSSVariables(data.insets);
      });
    } catch (e) {
      console.warn('[SafeArea] Plugin not available or failed:', e);
    }

    // Strategy 3: Fallback - apply default values if plugin didn't work
    if (!insetsApplied) {
      console.log('[StatusBar] Applying fallback safe area values');
      const fallbackTop = platform === 'android' ? ANDROID_STATUS_BAR_FALLBACK : IOS_STATUS_BAR_FALLBACK;
      setSafeAreaCSSVariables({
        top: fallbackTop,
        right: 0,
        bottom: 0,
        left: 0
      });
    }

    console.log('[StatusBar] Configured successfully');
  } catch (error) {
    console.error('[StatusBar] Configuration failed:', error);
    
    // Even if everything fails, apply fallback
    const platform = Capacitor.getPlatform();
    const fallbackTop = platform === 'android' ? ANDROID_STATUS_BAR_FALLBACK : IOS_STATUS_BAR_FALLBACK;
    setSafeAreaCSSVariables({
      top: fallbackTop,
      right: 0,
      bottom: 0,
      left: 0
    });
  }
}

/**
 * Set CSS variables for safe area insets
 */
function setSafeAreaCSSVariables(insets: { top: number; right: number; bottom: number; left: number }): void {
  const root = document.documentElement;
  root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
  root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
  root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
  root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
  console.log('[SafeArea] CSS variables set:', {
    top: `${insets.top}px`,
    right: `${insets.right}px`,
    bottom: `${insets.bottom}px`,
    left: `${insets.left}px`
  });
}

/**
 * Hide status bar (useful for fullscreen player)
 */
export async function hideStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await StatusBar.hide();
    // Reset safe area top when hidden
    document.documentElement.style.setProperty('--safe-area-inset-top', '0px');
  } catch (error) {
    console.warn('[StatusBar] Hide failed:', error);
  }
}

/**
 * Show status bar (restore after fullscreen)
 */
export async function showStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await StatusBar.show();
    
    // Re-apply safe area
    const platform = Capacitor.getPlatform();
    try {
      const { SafeArea } = await import('capacitor-plugin-safe-area');
      const { insets } = await SafeArea.getSafeAreaInsets();
      setSafeAreaCSSVariables(insets);
    } catch {
      // Fallback
      const fallbackTop = platform === 'android' ? ANDROID_STATUS_BAR_FALLBACK : IOS_STATUS_BAR_FALLBACK;
      setSafeAreaCSSVariables({ top: fallbackTop, right: 0, bottom: 0, left: 0 });
    }
  } catch (error) {
    console.warn('[StatusBar] Show failed:', error);
  }
}
