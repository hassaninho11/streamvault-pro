import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c97735e8aa5e409fad248ddff56bc3a4',
  appName: 'StreamVault',
  webDir: 'dist',
  // Local build mode - no remote server URL
  // Run: npm run build && npx cap sync android && npx cap run android
  server: {
    cleartext: true, // Allow HTTP for IPTV streams
  },
  android: {
    allowMixedContent: true,
    // Edge-to-edge is disabled via MainActivity.kt using
    // WindowCompat.setDecorFitsSystemWindows(window, true)
    // Do NOT use adjustMarginsForEdgeToEdge as it doesn't work reliably
  },
  ios: {
    allowsLinkPreview: false,
  },
  plugins: {
    // Native player plugins will be configured here
  },
};

export default config;
