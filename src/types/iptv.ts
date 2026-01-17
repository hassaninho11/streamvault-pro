// IPTV Types for StreamVault

export interface User {
  id: string;
  email: string;
  createdAt: Date;
  subscription: SubscriptionStatus;
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  isChild: boolean;
  pin?: string;
}

export interface SubscriptionStatus {
  plan: 'trial' | 'premium' | 'expired';
  trialStart?: Date;
  trialEnd?: Date;
  expiresAt?: Date;
  provider?: 'stripe' | 'apple' | 'google';
}

export type ProviderType = 'm3u' | 'xtream';

export interface Provider {
  id: string;
  userId: string;
  name: string;
  type: ProviderType;
  m3uUrl?: string;
  xtreamHost?: string;
  xtreamUser?: string;
  xtreamPass?: string; // encrypted
  epgUrl?: string;
  lastSync?: Date;
  channelCount?: number;
  isActive: boolean;
}

export interface Channel {
  id: string;
  providerId: string;
  channelId: string;
  name: string;
  group: string;
  logoUrl?: string;
  streamUrl: string;
  epgId?: string;
  number?: number;
  isHD?: boolean;
  isFavorite?: boolean;
}

export interface ChannelGroup {
  name: string;
  channels: Channel[];
  count: number;
}

export interface EpgProgram {
  id: string;
  channelId: string;
  start: Date;
  end: Date;
  title: string;
  description?: string;
  category?: string;
  icon?: string;
  isLive?: boolean;
  hasRecording?: boolean;
}

export interface Favorite {
  id: string;
  userId: string;
  profileId?: string;
  channelId: string;
  addedAt: Date;
}

export interface RecentlyWatched {
  id: string;
  userId: string;
  profileId?: string;
  channelId: string;
  lastWatchedAt: Date;
  watchDuration?: number;
}

export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  isFullscreen: boolean;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  duration?: number;
  quality?: string;
  error?: string;
}

export interface PlayerSettings {
  bufferLength: number;
  autoReconnect: boolean;
  preferredQuality: 'auto' | 'low' | 'medium' | 'high';
  hardwareAcceleration: boolean;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  language: string;
  epgRefreshInterval: number; // hours
  showChannelNumbers: boolean;
  startOnLastChannel: boolean;
  parentalPin?: string;
}

// M3U Parser types
export interface M3UItem {
  name: string;
  group: string;
  logo?: string;
  url: string;
  tvgId?: string;
  tvgName?: string;
  extras: Record<string, string>;
}

export interface ParsedM3U {
  items: M3UItem[];
  groups: string[];
  totalCount: number;
}
