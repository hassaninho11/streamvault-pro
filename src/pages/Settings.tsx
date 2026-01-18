import { useEffect, useState, useCallback } from "react";
import {
  Settings as SettingsIcon,
  User,
  Tv,
  Shield,
  CreditCard,
  Database,
  Info,
  Moon,
  Sun,
  Monitor,
  Globe,
  Play,
  Clock,
  Zap,
  Check,
  Server,
  AlertCircle,
  LogIn,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { CacheManagement } from "@/components/settings/CacheManagement";
import { SettingsSaveBar } from "@/components/settings/SettingsSaveBar";
import { ProtectedSetting } from "@/components/settings/ProtectedSetting";
import { UnsavedChangesDialog } from "@/components/settings/UnsavedChangesDialog";
import { APP_CONFIG } from "@/config/app";
import { cn } from "@/lib/utils";
import { useSettingsStore, PROTECTED_SETTINGS } from "@/data/stores/settingsStore";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

interface SettingsSection {
  id: string;
  icon: React.ElementType;
  labelKey: string;
}

const sections: SettingsSection[] = [
  { id: "account", icon: User, labelKey: "settings.account" },
  { id: "player", icon: Tv, labelKey: "settings.player" },
  { id: "parental", icon: Shield, labelKey: "settings.parental" },
  { id: "subscription", icon: CreditCard, labelKey: "settings.subscription" },
  { id: "cache", icon: Database, labelKey: "settings.cache" },
  { id: "about", icon: Info, labelKey: "settings.about" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, isGuest } = useAuth();
  const { 
    draftSettings, 
    isDirty, 
    isLoading, 
    initialized,
    load, 
    updateDraft, 
    resetDraft 
  } = useSettingsStore();
  
  const [activeSection, setActiveSection] = useState("account");
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Load settings on mount
  useEffect(() => {
    if (!initialized) {
      load();
    }
  }, [load, initialized]);

  // Warn before leaving page with unsaved changes (browser navigation)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleConfirmNavigation = useCallback(() => {
    resetDraft();
    setShowUnsavedDialog(false);
  }, [resetDraft]);

  const handleCancelNavigation = useCallback(() => {
    setShowUnsavedDialog(false);
  }, []);

  // Helper to check if a setting is protected
  const isProtected = (key: string): boolean => {
    return PROTECTED_SETTINGS.includes(key as any);
  };
  
  const engineOptions = [
    { id: "auto", displayName: "Auto (Recommended)" },
    { id: "shaka", displayName: "Shaka Player" },
    { id: "html5", displayName: "HTML5 (Fallback)" },
  ];

  const trialDaysRemaining = APP_CONFIG.subscription.trialDays;

  // Theme icon based on current theme
  const ThemeIcon = draftSettings.theme === 'light' ? Sun : 
                   draftSettings.theme === 'dark' ? Moon : Monitor;

  if (!initialized || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">{t('common.loading')}</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row h-full relative">
        {/* Settings Navigation */}
        <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-border">
          <div className="p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                {t('settings.title')}
              </h1>
              {isDirty && (
                <span className="flex items-center gap-1 text-xs text-warning">
                  <AlertCircle className="w-3 h-3" />
                  {t('settings.unsavedChanges')}
                </span>
              )}
            </div>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap",
                    activeSection === section.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <section.icon className="w-4 h-4" />
                  {t(section.labelKey)}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6 overflow-y-auto pb-24 lg:pb-6">
          <div className="max-w-2xl space-y-6">
            {/* Account Section */}
            {activeSection === "account" && (
              <>
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>{t('settings.profile')}</CardTitle>
                    <CardDescription>Manage your account settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-primary-foreground">
                        {user?.email?.[0]?.toUpperCase() || 'G'}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{user?.email || 'Guest User'}</p>
                        <p className="text-sm text-muted-foreground">
                          {isGuest ? 'Not logged in' : user?.email}
                        </p>
                      </div>
                      {isGuest ? (
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => navigate('/auth')}
                        >
                          <LogIn className="w-4 h-4 mr-2" />
                          Log In
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm">
                          {t('settings.editProfile')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>{t('settings.preferences')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Theme */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ThemeIcon className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label>{t('settings.theme')}</Label>
                          <p className="text-sm text-muted-foreground">
                            {draftSettings.theme === 'system' ? t('settings.themeSystem') :
                             draftSettings.theme === 'dark' ? t('settings.themeDark') : 
                             t('settings.themeLight')}
                          </p>
                        </div>
                      </div>
                      <Select 
                        value={draftSettings.theme} 
                        onValueChange={(v) => updateDraft('theme', v as 'dark' | 'light' | 'system')}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">
                            <div className="flex items-center gap-2">
                              <Monitor className="w-4 h-4" />
                              {t('settings.themeSystem')}
                            </div>
                          </SelectItem>
                          <SelectItem value="dark">
                            <div className="flex items-center gap-2">
                              <Moon className="w-4 h-4" />
                              {t('settings.themeDark')}
                            </div>
                          </SelectItem>
                          <SelectItem value="light">
                            <div className="flex items-center gap-2">
                              <Sun className="w-4 h-4" />
                              {t('settings.themeLight')}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator />
                    
                    {/* Language */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label>{t('settings.language')}</Label>
                          <p className="text-sm text-muted-foreground">Select your language</p>
                        </div>
                      </div>
                      <Select 
                        value={draftSettings.language} 
                        onValueChange={(v) => updateDraft('language', v as 'auto' | 'en' | 'sv' | 'de')}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">{t('settings.languageAuto')}</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="sv">Svenska</SelectItem>
                          <SelectItem value="de">Deutsch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Player Section */}
            {activeSection === "player" && (
              <>
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>{t('settings.player')}</CardTitle>
                    <CardDescription>{t('settings.playerEngineDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t('settings.playerEngine')}</Label>
                        <p className="text-sm text-muted-foreground">{t('settings.playerEngineDesc')}</p>
                      </div>
                      <Select 
                        value={draftSettings.preferredEngine} 
                        onValueChange={(v) => updateDraft('preferredEngine', v as any)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {engineOptions.map(opt => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t('settings.bufferMode')}</Label>
                        <p className="text-sm text-muted-foreground">{t('settings.bufferModeDesc')}</p>
                      </div>
                      <Select 
                        value={draftSettings.bufferMode} 
                        onValueChange={(v) => updateDraft('bufferMode', v as any)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low-latency">{t('settings.bufferLowLatency')}</SelectItem>
                          <SelectItem value="balanced">{t('settings.bufferBalanced')}</SelectItem>
                          <SelectItem value="stability">{t('settings.bufferStability')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator />
                    <ProtectedSetting>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>{t('settings.mkvPlayer')}</Label>
                          <p className="text-sm text-muted-foreground">{t('settings.mkvPlayerDesc')}</p>
                        </div>
                        <Select 
                          value={draftSettings.mkvPlayerPreference} 
                          onValueChange={(v) => updateDraft('mkvPlayerPreference', v as any)}
                          disabled={isGuest}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto (Recommended)</SelectItem>
                            <SelectItem value="native">Native (Standard)</SelectItem>
                            <SelectItem value="vlc">VLC (Compatibility)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </ProtectedSetting>
                  </CardContent>
                </Card>

                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>Playback Settings</CardTitle>
                    <CardDescription>Configure playback behavior</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Play className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label>{t('settings.autoPlay')}</Label>
                          <p className="text-sm text-muted-foreground">{t('settings.autoPlayDesc')}</p>
                        </div>
                      </div>
                      <Switch
                        checked={draftSettings.autoPlay}
                        onCheckedChange={(v) => updateDraft('autoPlay', v)}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label>{t('settings.startOnLastChannel')}</Label>
                          <p className="text-sm text-muted-foreground">{t('settings.startOnLastChannelDesc')}</p>
                        </div>
                      </div>
                      <Switch
                        checked={draftSettings.startOnLastChannel}
                        onCheckedChange={(v) => updateDraft('startOnLastChannel', v)}
                      />
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>{t('settings.subtitleDelay')}</Label>
                        <span className="text-sm text-muted-foreground">{draftSettings.subtitleDelay}ms</span>
                      </div>
                      <Slider
                        value={[draftSettings.subtitleDelay]}
                        onValueChange={([v]) => updateDraft('subtitleDelay', v)}
                        min={-2000}
                        max={2000}
                        step={100}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t('settings.hardwareAcceleration')}</Label>
                        <p className="text-sm text-muted-foreground">{t('settings.hardwareAccelerationDesc')}</p>
                      </div>
                      <Switch
                        checked={draftSettings.hardwareAcceleration}
                        onCheckedChange={(v) => updateDraft('hardwareAcceleration', v)}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t('settings.autoPlayNextEpisode')}</Label>
                        <p className="text-sm text-muted-foreground">Automatically play the next episode</p>
                      </div>
                      <Switch
                        checked={draftSettings.autoPlayNextEpisode}
                        onCheckedChange={(v) => updateDraft('autoPlayNextEpisode', v)}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t('settings.upNextCountdown')}</Label>
                        <p className="text-sm text-muted-foreground">Time before auto-playing next</p>
                      </div>
                      <Select 
                        value={String(draftSettings.upNextCountdown)} 
                        onValueChange={(v) => updateDraft('upNextCountdown', Number(v) as 10 | 5 | 0)}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10s</SelectItem>
                          <SelectItem value="5">5s</SelectItem>
                          <SelectItem value="0">Off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card variant="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="w-5 h-5" />
                      {t('settings.streamProxy')}
                    </CardTitle>
                    <CardDescription>
                      Configure a custom proxy server for HTTP streams. Required for playing HTTP streams on HTTPS pages when your IPTV provider blocks external proxies.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ProtectedSetting>
                      <div className="space-y-2">
                        <Label htmlFor="proxyUrl">{t('settings.customProxyUrl')}</Label>
                        <Input
                          id="proxyUrl"
                          type="url"
                          placeholder="https://your-proxy.example.com/stream?url="
                          value={draftSettings.customProxyUrl}
                          onChange={(e) => updateDraft('customProxyUrl', e.target.value)}
                          disabled={isGuest}
                        />
                        <p className="text-xs text-muted-foreground">
                          The stream URL will be appended to this URL. Leave empty to use the default proxy.
                        </p>
                      </div>
                    </ProtectedSetting>
                    <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground space-y-2">
                      <p className="font-medium text-foreground">Why use a custom proxy?</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Some IPTV providers restrict streams to your home IP address</li>
                        <li>Running your own proxy ensures streams come from your network</li>
                        <li>A local proxy avoids Mixed Content browser restrictions</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* Language preferences */}
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>Audio & Subtitles</CardTitle>
                    <CardDescription>Default language preferences</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ProtectedSetting>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>{t('settings.preferredAudioLanguage')}</Label>
                          <p className="text-sm text-muted-foreground">Default audio track language</p>
                        </div>
                        <Select 
                          value={draftSettings.preferredAudioLanguage || 'auto'}
                          onValueChange={(v) => updateDraft('preferredAudioLanguage', v === 'auto' ? '' : v)}
                          disabled={isGuest}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Auto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="sv">Svenska</SelectItem>
                            <SelectItem value="de">Deutsch</SelectItem>
                            <SelectItem value="fr">Français</SelectItem>
                            <SelectItem value="es">Español</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </ProtectedSetting>
                    <Separator />
                    <ProtectedSetting>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>{t('settings.preferredSubtitleLanguage')}</Label>
                          <p className="text-sm text-muted-foreground">Default subtitle language</p>
                        </div>
                        <Select 
                          value={draftSettings.preferredSubtitleLanguage || 'off'}
                          onValueChange={(v) => updateDraft('preferredSubtitleLanguage', v === 'off' ? '' : v)}
                          disabled={isGuest}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Off" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="off">Off</SelectItem>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="sv">Svenska</SelectItem>
                            <SelectItem value="de">Deutsch</SelectItem>
                            <SelectItem value="fr">Français</SelectItem>
                            <SelectItem value="es">Español</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </ProtectedSetting>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Parental Section */}
            {activeSection === "parental" && (
              <Card variant="glass">
                <CardHeader>
                  <CardTitle>{t('settings.parentalControls')}</CardTitle>
                  <CardDescription>{t('settings.parentalControlsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ProtectedSetting>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t('settings.enableParentalControls')}</Label>
                        <p className="text-sm text-muted-foreground">{t('settings.parentalControlsDesc')}</p>
                      </div>
                      <Switch
                        checked={draftSettings.parentalEnabled}
                        onCheckedChange={(v) => updateDraft('parentalEnabled', v)}
                        disabled={isGuest}
                      />
                    </div>
                  </ProtectedSetting>
                  {draftSettings.parentalEnabled && !isGuest && (
                    <>
                      <Separator />
                      <Button variant="outline">{t('settings.setPin')}</Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Subscription Section */}
            {activeSection === "subscription" && (
              <>
                <Card variant="glass" className="border-primary/30">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
                        <Zap className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{t('subscription.freeTrial')}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t('subscription.daysRemaining', { days: trialDaysRemaining })}
                        </p>
                        <div className="w-full bg-muted rounded-full h-2 mb-4">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${(trialDaysRemaining / 7) * 100}%` }}
                          />
                        </div>
                        <Button variant="premium" size="lg">
                          {t('subscription.upgradeToPremium')} • {APP_CONFIG.subscription.pricePerYear} {APP_CONFIG.subscription.currency}/year
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>{t('subscription.premiumFeatures')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {[
                        "Multi-profile support",
                        "Advanced EPG with catch-up",
                        "Health dashboard & diagnostics",
                        "Picture-in-picture mode",
                        "Backup & restore settings",
                        "Parental controls",
                        "Offline EPG snapshots",
                        "Unlimited providers",
                      ].map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-success" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Cache Section */}
            {activeSection === "cache" && (
              <CacheManagement />
            )}

            {/* About Section */}
            {activeSection === "about" && (
              <Card variant="glass">
                <CardHeader>
                  <CardTitle>About {APP_CONFIG.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
                      <Zap className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{APP_CONFIG.name}</h3>
                      <p className="text-sm text-muted-foreground">Version {APP_CONFIG.version}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>
                      {APP_CONFIG.name} is an IPTV playlist player that lets you watch your own content sources.
                    </p>
                    <p>
                      We do not host, provide, or recommend any content. All streams and playlists are provided by you, the user.
                    </p>
                  </div>
                  <Separator />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Privacy Policy</Button>
                    <Button variant="outline" size="sm">Terms of Service</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Save Bar */}
        <SettingsSaveBar />

        {/* Unsaved Changes Dialog */}
        <UnsavedChangesDialog
          open={showUnsavedDialog}
          onOpenChange={setShowUnsavedDialog}
          onConfirm={handleConfirmNavigation}
          onCancel={handleCancelNavigation}
        />
      </div>
    </AppLayout>
  );
}
