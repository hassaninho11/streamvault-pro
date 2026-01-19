import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SafeArea } from 'capacitor-plugin-safe-area';

/**
 * Initialize status bar and safe area configuration for Android/iOS
 * - Sets status bar style to match app theme
 * - Fetches actual safe area insets and injects them as CSS variables
 *   (env(safe-area-inset-*) returns 0 on Android WebView)
 */
export async function initializeStatusBar(): Promise<void> {
  // Only run on native platforms
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Set dark style (light text) to match dark theme
    await StatusBar.setStyle({ style: Style.Dark });

    // Set background color to match app background (Android only)
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0c1018' }); // hsl(222 47% 6%)
    }

    // Fetch actual safe area insets using native plugin
    // This is required because env(safe-area-inset-*) returns 0 on Android WebView
    await applySafeAreaInsets();

    // Listen for safe area changes (e.g., orientation change)
    SafeArea.addListener('safeAreaChanged', (data) => {
      const { insets } = data;
      setSafeAreaCSSVariables(insets);
    });

    console.log('[StatusBar] Configured successfully');
  } catch (error) {
    console.warn('[StatusBar] Configuration failed:', error);
  }
}

/**
 * Fetch and apply safe area insets as CSS variables
 */
async function applySafeAreaInsets(): Promise<void> {
  try {
    const { insets } = await SafeArea.getSafeAreaInsets();
    setSafeAreaCSSVariables(insets);
    console.log('[SafeArea] Insets applied:', insets);
  } catch (error) {
    console.warn('[SafeArea] Failed to get insets:', error);
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
}

/**
 * Hide status bar (useful for fullscreen player)
 */
export async function hideStatusBar(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await StatusBar.hide();
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
    // Re-apply safe area insets after showing status bar
    await applySafeAreaInsets();
  } catch (error) {
    console.warn('[StatusBar] Show failed:', error);
  }
}
