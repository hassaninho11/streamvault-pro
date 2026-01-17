// StreamVault Configuration
export const APP_CONFIG = {
  name: 'StreamVault',
  version: '1.0.0',
  
  // Subscription
  subscription: {
    trialDays: 7,
    pricePerYear: 149, // SEK
    currency: 'SEK',
  },
  
  // Feature flags
  features: {
    freeFeatures: [
      'single_provider',
      'basic_playback',
      'favorites',
      'recently_watched',
    ],
    premiumFeatures: [
      'multi_profile',
      'advanced_epg',
      'catchup',
      'health_dashboard',
      'pip_multiscreen',
      'backup_restore',
      'parental_controls',
      'offline_epg',
      'unlimited_providers',
    ],
  },
  
  // Player settings
  player: {
    defaultBufferLength: 30, // seconds
    reconnectAttempts: 3,
    reconnectDelay: 2000, // ms
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
} as const;

export type AppConfig = typeof APP_CONFIG;
