import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Initialize status bar configuration for Android/iOS
 * - Sets status bar to NOT overlay the WebView
 * - Configures dark style to match app theme
 */
export async function initializeStatusBar(): Promise<void> {
  // Only run on native platforms
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Prevent status bar from overlaying the WebView content
    await StatusBar.setOverlaysWebView({ overlay: false });

    // Set dark style (light text) to match dark theme
    await StatusBar.setStyle({ style: Style.Dark });

    // Set background color to match app background
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0c1018' }); // hsl(222 47% 6%)
    }

    console.log('[StatusBar] Configured successfully');
  } catch (error) {
    console.warn('[StatusBar] Configuration failed:', error);
  }
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
  } catch (error) {
    console.warn('[StatusBar] Show failed:', error);
  }
}
