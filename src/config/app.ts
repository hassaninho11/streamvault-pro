/**
 * StreamVault Configuration - Feature flags and app settings
 */

export const APP_CONFIG = {
  name: 'StreamVault',
  version: '1.0.0',
  
  // Subscription
  subscription: {
    trialDays: 7,
    pricePerYear: 149, // SEK
    currency: 'SEK',
  },
  
  // Guest mode settings
  guestMode: {
    enabled: true,
    allowTrial: true,
    trialDays: 7,
    maxProvidersInGuest: 3,
  },
  
  // Feature flags - premium gating configuration
  features: {
    // Features available to all users (guest + free + premium)
    freeFeatures: [
      'single_provider',
      'basic_playback',
      'favorites',
      'recently_watched',
      'basic_epg',
      'search',
    ] as const,
    
    // Features requiring premium subscription
    premiumFeatures: [
      'multi_profile',
      'advanced_epg',
      'catchup',
      'health_dashboard',
      'pip_multiscreen',
      'cloud_backup',
      'parental_controls',
      'offline_epg',
      'unlimited_providers',
      'ai_subtitles',
      'vod_continue_watching',
    ] as const,
    
    // Whether basic playback requires subscription after trial
    playbackRequiresPremiumAfterTrial: false,
  },
  
  // Player settings
  player: {
    defaultBufferLength: 30,
    reconnectAttempts: 3,
    reconnectDelay: 2000,
  },
  
  // Cache settings
  cache: {
    epgRetentionDays: 7,
    maxChannelsInMemory: 1000,
    logosCacheDays: 30,
  },
  
  // Performance
  performance: {
    virtualListOverscan: 5,
    epgBatchSize: 100,
    debounceSearch: 300,
  },
  
  // Sync settings
  sync: {
    autoSyncIntervalMs: 5 * 60 * 1000, // 5 minutes
    conflictStrategy: 'latest_wins' as const,
  },
} as const;

export type AppConfig = typeof APP_CONFIG;
export type FreeFeature = typeof APP_CONFIG.features.freeFeatures[number];
export type PremiumFeature = typeof APP_CONFIG.features.premiumFeatures[number];
export type Feature = FreeFeature | PremiumFeature;
