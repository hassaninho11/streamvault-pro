import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c97735e8aa5e409fad248ddff56bc3a4',
  appName: 'A Lovable project',
  webDir: 'dist',
  server: {
    url: 'https://c97735e8-aa5e-409f-ad24-8ddff56bc3a4.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    // Handle edge-to-edge display for Android 15+ (API 35)
    // 'force' ensures margins are applied on all Android versions
    adjustMarginsForEdgeToEdge: 'force',
  },
  ios: {
    allowsLinkPreview: false,
  },
  plugins: {
    // Native player plugins will be configured here
  },
};

export default config;
