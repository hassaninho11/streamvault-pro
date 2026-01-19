/**
 * SettingsStore - Centralized settings management with draft/current pattern
 * 
 * - currentSettings: The persisted, applied settings
 * - draftSettings: Changes being made before save
 * - isDirty: Whether there are unsaved changes
 */

import { create } from 'zustand';
import { localStore, LocalSettings } from './localStore';
import { syncEngine } from './syncEngine';

export interface AppSettings {
  // UI
  theme: 'dark' | 'light' | 'system';
  language: 'auto' | 'en' | 'sv' | 'de';
  
  // Playback - Engine Selection (TiviMate-style)
  preferredEngine: 'auto' | 'exo' | 'vlc' | 'external';
  autoPlayerSelection: boolean; // Enable smart auto-switching
  bufferMode: 'low-latency' | 'balanced' | 'stability';
  autoPlay: boolean;
  startOnLastChannel: boolean;
  hardwareAcceleration: boolean;
  
  // VOD
  autoPlayNextEpisode: boolean;
  upNextCountdown: 10 | 5 | 0;
  
  // Subtitles & Audio
  preferredSubtitleLanguage: string;
  preferredAudioLanguage: string;
  subtitleDelay: number;
  subtitleSize: 'small' | 'medium' | 'large';
  subtitleBackground: boolean;
  
  // Advanced
  mkvPlayerPreference: 'auto' | 'exo' | 'vlc';
  customProxyUrl: string;
  showChannelNumbers: boolean;
  epgRefreshHours: number;
  allowExternalPlayer: boolean; // Advanced: allow opening in external app
  
  // Parental Controls
  parentalEnabled: boolean;
  parentalPin?: string;
  
  // Player Lock
  playerLockEnabled: boolean;
  
  // Playlist Update Settings
  playlistUpdateIntervalMinutes: number; // 0 = disabled
  playlistUpdateWifiOnly: boolean;
  playlistUpdateIdleOnly: boolean;
  playlistUpdatePauseLowBattery: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'auto',
  preferredEngine: 'auto',
  autoPlayerSelection: true,
  bufferMode: 'balanced',
  autoPlay: true,
  startOnLastChannel: true,
  hardwareAcceleration: true,
  autoPlayNextEpisode: true,
  upNextCountdown: 10,
  preferredSubtitleLanguage: '',
  preferredAudioLanguage: '',
  subtitleDelay: 0,
  subtitleSize: 'medium',
  subtitleBackground: true,
  mkvPlayerPreference: 'auto',
  customProxyUrl: '',
  showChannelNumbers: false,
  epgRefreshHours: 6,
  allowExternalPlayer: false,
  parentalEnabled: false,
  playerLockEnabled: true,
  // Playlist update defaults
  playlistUpdateIntervalMinutes: 360, // 6 hours default
  playlistUpdateWifiOnly: true,
  playlistUpdateIdleOnly: true,
  playlistUpdatePauseLowBattery: true,
};

// Settings that require login to edit (only sync-related)
// All other settings work for guests - only playlist sync requires login
export const PROTECTED_SETTINGS: (keyof AppSettings)[] = [];

interface SettingsState {
  // Current applied settings
  currentSettings: AppSettings;
  // Draft settings being edited
  draftSettings: AppSettings;
  // Whether there are unsaved changes
  isDirty: boolean;
  // Loading state
  isLoading: boolean;
  // Initialized
  initialized: boolean;
  
  // Actions
  load: () => Promise<void>;
  updateDraft: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  save: (userId?: string) => Promise<void>;
  resetDraft: () => void;
  applyTheme: (theme: 'dark' | 'light' | 'system') => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  currentSettings: DEFAULT_SETTINGS,
  draftSettings: DEFAULT_SETTINGS,
  isDirty: false,
  isLoading: true,
  initialized: false,

  load: async () => {
    set({ isLoading: true });
    
    try {
      const stored = await localStore.getSettings();
      
      // Map LocalSettings to AppSettings
      const loadedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        theme: stored.theme || DEFAULT_SETTINGS.theme,
        language: (stored.language as AppSettings['language']) || DEFAULT_SETTINGS.language,
        autoPlay: stored.playerSettings?.autoplay ?? DEFAULT_SETTINGS.autoPlay,
        customProxyUrl: stored.playerSettings?.customProxyUrl || '',
        mkvPlayerPreference: (stored.playerSettings?.mkvPlayerPreference as AppSettings['mkvPlayerPreference']) || DEFAULT_SETTINGS.mkvPlayerPreference,
        preferredEngine: (stored.playerSettings?.preferredEngine as AppSettings['preferredEngine']) || DEFAULT_SETTINGS.preferredEngine,
        autoPlayerSelection: stored.playerSettings?.autoPlayerSelection ?? DEFAULT_SETTINGS.autoPlayerSelection,
        allowExternalPlayer: stored.playerSettings?.allowExternalPlayer ?? DEFAULT_SETTINGS.allowExternalPlayer,
      };
      
      set({
        currentSettings: loadedSettings,
        draftSettings: loadedSettings,
        isDirty: false,
        isLoading: false,
        initialized: true,
      });
      
      // Apply theme on load
      get().applyTheme(loadedSettings.theme);
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoading: false, initialized: true });
    }
  },

  updateDraft: (key, value) => {
    const { draftSettings, currentSettings } = get();
    const newDraft = { ...draftSettings, [key]: value };
    
    // Check if any setting differs from current
    const isDirty = Object.keys(newDraft).some(
      k => JSON.stringify(newDraft[k as keyof AppSettings]) !== 
           JSON.stringify(currentSettings[k as keyof AppSettings])
    );
    
    set({ draftSettings: newDraft, isDirty });
    
    // Apply theme immediately for preview
    if (key === 'theme') {
      get().applyTheme(value as 'dark' | 'light' | 'system');
    }
  },

  save: async (userId?: string) => {
    const { draftSettings } = get();
    
    set({ isLoading: true });
    
    try {
      // Map AppSettings back to LocalSettings
      const localSettings: Partial<LocalSettings> = {
        theme: draftSettings.theme,
        language: draftSettings.language === 'auto' ? 'en' : draftSettings.language,
        playerSettings: {
          autoplay: draftSettings.autoPlay,
          defaultQuality: 'auto',
          bufferSize: draftSettings.bufferMode === 'stability' ? 60 : 
                      draftSettings.bufferMode === 'low-latency' ? 10 : 30,
          customProxyUrl: draftSettings.customProxyUrl || undefined,
          mkvPlayerPreference: draftSettings.mkvPlayerPreference,
          preferredEngine: draftSettings.preferredEngine,
          autoPlayerSelection: draftSettings.autoPlayerSelection,
          allowExternalPlayer: draftSettings.allowExternalPlayer,
        },
      };
      
      await localStore.saveSettings(localSettings);
      
      // Trigger sync if logged in
      if (userId) {
        await syncEngine.sync(userId, 'merge');
      }
      
      set({
        currentSettings: draftSettings,
        isDirty: false,
        isLoading: false,
      });
      
      // Apply theme after save
      get().applyTheme(draftSettings.theme);
    } catch (error) {
      console.error('Failed to save settings:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  resetDraft: () => {
    const { currentSettings } = get();
    set({ draftSettings: currentSettings, isDirty: false });
    // Reset theme to current
    get().applyTheme(currentSettings.theme);
  },

  applyTheme: (theme) => {
    const html = document.documentElement;
    
    // Remove existing theme classes
    html.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.classList.add(prefersDark ? 'dark' : 'light');
      html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      html.classList.add(theme);
      html.setAttribute('data-theme', theme);
    }
  },
}));

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const state = useSettingsStore.getState();
    if (state.currentSettings.theme === 'system') {
      state.applyTheme('system');
    }
  });
}

export default useSettingsStore;
