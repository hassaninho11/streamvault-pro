/**
 * LanguageContext - i18n provider with real translations
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useSettingsStore } from '@/data/stores/settingsStore';

type Language = 'en' | 'sv' | 'de';

// Translation type for type safety
type TranslationKey = keyof typeof translations.en;

const translations = {
  en: {
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.undo': 'Undo',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.search': 'Search',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.play': 'Play',
    'common.pause': 'Pause',
    'common.stop': 'Stop',
    
    // Navigation
    'nav.home': 'Home',
    'nav.livetv': 'Live TV',
    'nav.movies': 'Movies',
    'nav.series': 'Series',
    'nav.epg': 'TV Guide',
    'nav.search': 'Search',
    'nav.favorites': 'Favorites',
    'nav.recent': 'Recent',
    'nav.providers': 'Providers',
    'nav.settings': 'Settings',
    
    // Settings
    'settings.title': 'Settings',
    'settings.account': 'Account',
    'settings.player': 'Media Player',
    'settings.parental': 'Parental Controls',
    'settings.subscription': 'Subscription',
    'settings.cache': 'Data & Cache',
    'settings.about': 'About',
    
    'settings.profile': 'Profile',
    'settings.editProfile': 'Edit Profile',
    'settings.preferences': 'Preferences',
    
    'settings.theme': 'Theme',
    'settings.themeSystem': 'System',
    'settings.themeDark': 'Dark',
    'settings.themeLight': 'Light',
    
    'settings.language': 'Language',
    'settings.languageAuto': 'Auto (System)',
    
    'settings.playerEngine': 'Player Engine',
    'settings.playerEngineDesc': 'Auto selects the best player for your platform',
    'settings.bufferMode': 'Buffer Mode',
    'settings.bufferModeDesc': 'Balance between latency and stability',
    'settings.bufferLowLatency': 'Low Latency',
    'settings.bufferBalanced': 'Balanced',
    'settings.bufferStability': 'Stability',
    
    'settings.autoPlay': 'Auto-play',
    'settings.autoPlayDesc': 'Start playing automatically',
    'settings.startOnLastChannel': 'Start on last channel',
    'settings.startOnLastChannelDesc': 'Resume from where you left',
    
    'settings.subtitleDelay': 'Subtitle Delay',
    'settings.hardwareAcceleration': 'Hardware Acceleration',
    'settings.hardwareAccelerationDesc': 'Better performance when enabled',
    
    'settings.preferredAudioLanguage': 'Preferred Audio Language',
    'settings.preferredSubtitleLanguage': 'Preferred Subtitle Language',
    'settings.autoPlayNextEpisode': 'Autoplay Next Episode',
    'settings.upNextCountdown': 'Up Next Countdown',
    
    'settings.mkvPlayer': 'MKV Player',
    'settings.mkvPlayerDesc': 'Choose player for MKV and other container formats',
    
    'settings.parentalControls': 'Parental Controls',
    'settings.parentalControlsDesc': 'Require PIN for restricted content',
    'settings.enableParentalControls': 'Enable Parental Controls',
    'settings.setPin': 'Set PIN Code',
    
    'settings.streamProxy': 'Stream Proxy',
    'settings.customProxyUrl': 'Custom Proxy URL',
    
    'settings.saveChanges': 'Save Changes',
    'settings.unsavedChanges': 'Unsaved Changes',
    'settings.settingsSaved': 'Settings saved',
    'settings.unsavedChangesWarning': 'You have unsaved changes',
    'settings.discardChanges': 'Discard Changes',
    
    // Auth gating
    'settings.loginRequired': 'Login required',
    'settings.loginToEdit': 'Log in to change this setting',
    'settings.loginToSync': 'Log in to save and sync settings',
    
    // Subscription
    'subscription.freeTrial': 'Free Trial',
    'subscription.daysRemaining': '{days} days remaining in your trial',
    'subscription.upgradeToPremium': 'Upgrade to Premium',
    'subscription.premiumFeatures': 'Premium Features',
    
    // Player
    'player.lock': 'Lock',
    'player.unlock': 'Unlock',
    'player.skipIntro': 'Skip Intro',
    'player.skipRecap': 'Skip Recap',
    'player.nextEpisode': 'Next Episode',
    'player.episodes': 'Episodes',
    'player.subtitles': 'Subtitles',
    'player.audio': 'Audio',
    'player.quality': 'Quality',
    'player.speed': 'Speed',
    'player.upNext': 'Up Next',
    
    // VOD
    'vod.continueWatching': 'Continue Watching',
    'vod.watchNow': 'Watch Now',
    'vod.seasons': 'Seasons',
    'vod.episodes': 'Episodes',
  },
  sv: {
    // Common
    'common.save': 'Spara',
    'common.cancel': 'Avbryt',
    'common.undo': 'Ångra',
    'common.edit': 'Redigera',
    'common.delete': 'Ta bort',
    'common.loading': 'Laddar...',
    'common.error': 'Fel',
    'common.success': 'Klart',
    'common.close': 'Stäng',
    'common.confirm': 'Bekräfta',
    'common.search': 'Sök',
    'common.back': 'Tillbaka',
    'common.next': 'Nästa',
    'common.previous': 'Föregående',
    'common.play': 'Spela',
    'common.pause': 'Paus',
    'common.stop': 'Stopp',
    
    // Navigation
    'nav.home': 'Hem',
    'nav.livetv': 'Live TV',
    'nav.movies': 'Filmer',
    'nav.series': 'Serier',
    'nav.epg': 'TV-Guide',
    'nav.search': 'Sök',
    'nav.favorites': 'Favoriter',
    'nav.recent': 'Senaste',
    'nav.providers': 'Leverantörer',
    'nav.settings': 'Inställningar',
    
    // Settings
    'settings.title': 'Inställningar',
    'settings.account': 'Konto',
    'settings.player': 'Mediaspelare',
    'settings.parental': 'Föräldrakontroll',
    'settings.subscription': 'Prenumeration',
    'settings.cache': 'Data & Cache',
    'settings.about': 'Om',
    
    'settings.profile': 'Profil',
    'settings.editProfile': 'Redigera profil',
    'settings.preferences': 'Inställningar',
    
    'settings.theme': 'Tema',
    'settings.themeSystem': 'System',
    'settings.themeDark': 'Mörkt',
    'settings.themeLight': 'Ljust',
    
    'settings.language': 'Språk',
    'settings.languageAuto': 'Auto (System)',
    
    'settings.playerEngine': 'Spelarmotor',
    'settings.playerEngineDesc': 'Väljer automatiskt bästa spelaren för din plattform',
    'settings.bufferMode': 'Buffringsläge',
    'settings.bufferModeDesc': 'Balans mellan latens och stabilitet',
    'settings.bufferLowLatency': 'Låg latens',
    'settings.bufferBalanced': 'Balanserad',
    'settings.bufferStability': 'Stabilitet',
    
    'settings.autoPlay': 'Auto-spela',
    'settings.autoPlayDesc': 'Starta uppspelning automatiskt',
    'settings.startOnLastChannel': 'Starta på senaste kanal',
    'settings.startOnLastChannelDesc': 'Återuppta där du slutade',
    
    'settings.subtitleDelay': 'Undertextfördröjning',
    'settings.hardwareAcceleration': 'Hårdvaruacceleration',
    'settings.hardwareAccelerationDesc': 'Bättre prestanda när aktiverad',
    
    'settings.preferredAudioLanguage': 'Föredraget ljudspråk',
    'settings.preferredSubtitleLanguage': 'Föredraget undertextspråk',
    'settings.autoPlayNextEpisode': 'Spela nästa avsnitt automatiskt',
    'settings.upNextCountdown': 'Nedräkning till nästa',
    
    'settings.mkvPlayer': 'MKV-spelare',
    'settings.mkvPlayerDesc': 'Välj spelare för MKV och andra containerformat',
    
    'settings.parentalControls': 'Föräldrakontroll',
    'settings.parentalControlsDesc': 'Kräv PIN för begränsat innehåll',
    'settings.enableParentalControls': 'Aktivera föräldrakontroll',
    'settings.setPin': 'Ställ in PIN-kod',
    
    'settings.streamProxy': 'Strömproxy',
    'settings.customProxyUrl': 'Anpassad proxy-URL',
    
    'settings.saveChanges': 'Spara ändringar',
    'settings.unsavedChanges': 'Osparade ändringar',
    'settings.settingsSaved': 'Inställningar sparade',
    'settings.unsavedChangesWarning': 'Du har osparade ändringar',
    'settings.discardChanges': 'Kasta ändringar',
    
    // Auth gating
    'settings.loginRequired': 'Inloggning krävs',
    'settings.loginToEdit': 'Logga in för att ändra denna inställning',
    'settings.loginToSync': 'Logga in för att spara och synka inställningar',
    
    // Subscription
    'subscription.freeTrial': 'Gratis provperiod',
    'subscription.daysRemaining': '{days} dagar kvar av din provperiod',
    'subscription.upgradeToPremium': 'Uppgradera till Premium',
    'subscription.premiumFeatures': 'Premium-funktioner',
    
    // Player
    'player.lock': 'Lås',
    'player.unlock': 'Lås upp',
    'player.skipIntro': 'Hoppa intro',
    'player.skipRecap': 'Hoppa recap',
    'player.nextEpisode': 'Nästa avsnitt',
    'player.episodes': 'Avsnitt',
    'player.subtitles': 'Undertexter',
    'player.audio': 'Ljud',
    'player.quality': 'Kvalitet',
    'player.speed': 'Hastighet',
    'player.upNext': 'Nästa',
    
    // VOD
    'vod.continueWatching': 'Fortsätt titta',
    'vod.watchNow': 'Titta nu',
    'vod.seasons': 'Säsonger',
    'vod.episodes': 'Avsnitt',
  },
  de: {
    // Common
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.undo': 'Rückgängig',
    'common.edit': 'Bearbeiten',
    'common.delete': 'Löschen',
    'common.loading': 'Laden...',
    'common.error': 'Fehler',
    'common.success': 'Erfolg',
    'common.close': 'Schließen',
    'common.confirm': 'Bestätigen',
    'common.search': 'Suchen',
    'common.back': 'Zurück',
    'common.next': 'Weiter',
    'common.previous': 'Zurück',
    'common.play': 'Abspielen',
    'common.pause': 'Pause',
    'common.stop': 'Stopp',
    
    // Navigation
    'nav.home': 'Startseite',
    'nav.livetv': 'Live TV',
    'nav.movies': 'Filme',
    'nav.series': 'Serien',
    'nav.epg': 'TV-Guide',
    'nav.search': 'Suchen',
    'nav.favorites': 'Favoriten',
    'nav.recent': 'Zuletzt',
    'nav.providers': 'Anbieter',
    'nav.settings': 'Einstellungen',
    
    // Settings
    'settings.title': 'Einstellungen',
    'settings.account': 'Konto',
    'settings.player': 'Mediaplayer',
    'settings.parental': 'Kindersicherung',
    'settings.subscription': 'Abonnement',
    'settings.cache': 'Daten & Cache',
    'settings.about': 'Über',
    
    'settings.profile': 'Profil',
    'settings.editProfile': 'Profil bearbeiten',
    'settings.preferences': 'Einstellungen',
    
    'settings.theme': 'Design',
    'settings.themeSystem': 'System',
    'settings.themeDark': 'Dunkel',
    'settings.themeLight': 'Hell',
    
    'settings.language': 'Sprache',
    'settings.languageAuto': 'Auto (System)',
    
    'settings.playerEngine': 'Player-Engine',
    'settings.playerEngineDesc': 'Wählt automatisch den besten Player für Ihre Plattform',
    'settings.bufferMode': 'Puffermodus',
    'settings.bufferModeDesc': 'Balance zwischen Latenz und Stabilität',
    'settings.bufferLowLatency': 'Niedrige Latenz',
    'settings.bufferBalanced': 'Ausgewogen',
    'settings.bufferStability': 'Stabilität',
    
    'settings.autoPlay': 'Automatische Wiedergabe',
    'settings.autoPlayDesc': 'Automatisch abspielen',
    'settings.startOnLastChannel': 'Beim letzten Kanal starten',
    'settings.startOnLastChannelDesc': 'Fortsetzen, wo Sie aufgehört haben',
    
    'settings.subtitleDelay': 'Untertitelverzögerung',
    'settings.hardwareAcceleration': 'Hardwarebeschleunigung',
    'settings.hardwareAccelerationDesc': 'Bessere Leistung wenn aktiviert',
    
    'settings.preferredAudioLanguage': 'Bevorzugte Audiosprache',
    'settings.preferredSubtitleLanguage': 'Bevorzugte Untertitelsprache',
    'settings.autoPlayNextEpisode': 'Nächste Folge automatisch abspielen',
    'settings.upNextCountdown': 'Countdown zur nächsten Folge',
    
    'settings.mkvPlayer': 'MKV-Player',
    'settings.mkvPlayerDesc': 'Player für MKV und andere Containerformate wählen',
    
    'settings.parentalControls': 'Kindersicherung',
    'settings.parentalControlsDesc': 'PIN für eingeschränkte Inhalte erforderlich',
    'settings.enableParentalControls': 'Kindersicherung aktivieren',
    'settings.setPin': 'PIN festlegen',
    
    'settings.streamProxy': 'Stream-Proxy',
    'settings.customProxyUrl': 'Benutzerdefinierte Proxy-URL',
    
    'settings.saveChanges': 'Änderungen speichern',
    'settings.unsavedChanges': 'Nicht gespeicherte Änderungen',
    'settings.settingsSaved': 'Einstellungen gespeichert',
    'settings.unsavedChangesWarning': 'Sie haben nicht gespeicherte Änderungen',
    'settings.discardChanges': 'Änderungen verwerfen',
    
    // Auth gating
    'settings.loginRequired': 'Anmeldung erforderlich',
    'settings.loginToEdit': 'Melden Sie sich an, um diese Einstellung zu ändern',
    'settings.loginToSync': 'Melden Sie sich an, um Einstellungen zu speichern und zu synchronisieren',
    
    // Subscription
    'subscription.freeTrial': 'Kostenlose Testversion',
    'subscription.daysRemaining': '{days} Tage verbleibend in Ihrer Testversion',
    'subscription.upgradeToPremium': 'Auf Premium upgraden',
    'subscription.premiumFeatures': 'Premium-Funktionen',
    
    // Player
    'player.lock': 'Sperren',
    'player.unlock': 'Entsperren',
    'player.skipIntro': 'Intro überspringen',
    'player.skipRecap': 'Recap überspringen',
    'player.nextEpisode': 'Nächste Folge',
    'player.episodes': 'Folgen',
    'player.subtitles': 'Untertitel',
    'player.audio': 'Audio',
    'player.quality': 'Qualität',
    'player.speed': 'Geschwindigkeit',
    'player.upNext': 'Als Nächstes',
    
    // VOD
    'vod.continueWatching': 'Weiterschauen',
    'vod.watchNow': 'Jetzt ansehen',
    'vod.seasons': 'Staffeln',
    'vod.episodes': 'Folgen',
  },
} as const;

interface LanguageContextType {
  language: Language;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLanguage: (lang: Language | 'auto') => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getSystemLanguage(): Language {
  const browserLang = navigator.language.split('-')[0];
  if (browserLang === 'sv') return 'sv';
  if (browserLang === 'de') return 'de';
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { draftSettings, updateDraft, initialized } = useSettingsStore();
  const [language, setLanguageState] = useState<Language>('en');
  
  useEffect(() => {
    if (!initialized) return;
    
    const settingsLang = draftSettings.language;
    if (settingsLang === 'auto') {
      setLanguageState(getSystemLanguage());
    } else {
      setLanguageState(settingsLang as Language);
    }
  }, [draftSettings.language, initialized]);
  
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const translationSet = translations[language] || translations.en;
    let text = (translationSet as Record<string, string>)[key] || 
               (translations.en as Record<string, string>)[key] || 
               key;
    
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    
    return text;
  }, [language]);
  
  const setLanguage = useCallback((lang: Language | 'auto') => {
    updateDraft('language', lang);
    if (lang === 'auto') {
      setLanguageState(getSystemLanguage());
    } else {
      setLanguageState(lang);
    }
  }, [updateDraft]);
  
  return (
    <LanguageContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

export default LanguageContext;
