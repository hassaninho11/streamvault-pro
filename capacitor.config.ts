import type { CapacitorConfig } from '@capacitor/cli';

// Set to true for development (hot-reload from preview URL)
// Set to false for production/testing native features (local build)
const USE_DEV_SERVER = false;

const config: CapacitorConfig = {
  appId: 'app.lovable.c97735e8aa5e409fad248ddff56bc3a4',
  appName: 'StreamVault',
  webDir: 'dist',
  server: USE_DEV_SERVER ? {
    url: 'https://c97735e8-aa5e-409f-ad24-8ddff56bc3a4.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  } : {
    cleartext: true, // Allow HTTP streams for IPTV
  },
  android: {
    allowMixedContent: true,
    // Edge-to-edge is disabled via MainActivity.kt using
    // WindowCompat.setDecorFitsSystemWindows(window, true)
  },
  ios: {
    allowsLinkPreview: false,
  },
  plugins: {
    // Native player plugins configured here
  },
};

export default config;
