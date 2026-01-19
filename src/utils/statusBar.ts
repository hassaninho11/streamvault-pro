import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Initialize status bar and safe area configuration for Android/iOS
 * 
 * IMPORTANT: On Android, we use WindowCompat.setDecorFitsSystemWindows(window, true)
 * in MainActivity.kt which means the system handles safe areas natively.
 * Therefore, we set CSS variables to 0 on Android to avoid double padding.
 */
export async function initializeStatusBar(): Promise<void> {
  // Only run on native platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('[StatusBar] Not a native platform, skipping');
    // Set to 0 for web preview
    setSafeAreaCSSVariables({ top: 0, right: 0, bottom: 0, left: 0 });
    return;
  }

  const platform = Capacitor.getPlatform();
  console.log('[StatusBar] Initializing for platform:', platform);

  try {
    // Set dark style (light text) to match dark theme
    await StatusBar.setStyle({ style: Style.Dark });

    // Set background color to match app background (Android only)
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0c1018' });
      
      // On Android, WindowCompat.setDecorFitsSystemWindows handles safe areas natively
      // So we set CSS variables to 0 to avoid double padding
      console.log('[StatusBar] Android native mode - CSS safe areas set to 0');
      setSafeAreaCSSVariables({ top: 0, right: 0, bottom: 0, left: 0 });
      return;
    }

    // For iOS, try to get actual insets from plugin
    try {
      const { SafeArea } = await import('capacitor-plugin-safe-area');
      const { insets } = await SafeArea.getSafeAreaInsets();
      console.log('[SafeArea] Got insets from plugin:', insets);
      setSafeAreaCSSVariables(insets);

      // Listen for changes
      SafeArea.addListener('safeAreaChanged', (data) => {
        console.log('[SafeArea] Insets changed:', data.insets);
        setSafeAreaCSSVariables(data.insets);
      });
    } catch (e) {
      console.warn('[SafeArea] Plugin not available or failed:', e);
      // iOS fallback
      setSafeAreaCSSVariables({ top: 47, right: 0, bottom: 0, left: 0 });
    }

    console.log('[StatusBar] Configured successfully');
  } catch (error) {
    console.error('[StatusBar] Configuration failed:', error);
    // Safe fallback - no padding on Android, iOS gets default
    if (platform === 'android') {
      setSafeAreaCSSVariables({ top: 0, right: 0, bottom: 0, left: 0 });
    } else {
      setSafeAreaCSSVariables({ top: 47, right: 0, bottom: 0, left: 0 });
    }
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
