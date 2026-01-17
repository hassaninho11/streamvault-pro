import { useState } from "react";
import {
  Settings as SettingsIcon,
  User,
  Tv,
  Shield,
  CreditCard,
  Database,
  Info,
  ChevronRight,
  Moon,
  Globe,
  Play,
  Clock,
  Trash2,
  Zap,
  Check,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CacheManagement } from "@/components/settings/CacheManagement";
import { APP_CONFIG } from "@/config/app";
import { cn } from "@/lib/utils";

interface SettingsSection {
  id: string;
  icon: React.ElementType;
  label: string;
}

const sections: SettingsSection[] = [
  { id: "account", icon: User, label: "Account" },
  { id: "player", icon: Tv, label: "Media Player" },
  { id: "parental", icon: Shield, label: "Parental Controls" },
  { id: "subscription", icon: CreditCard, label: "Subscription" },
  { id: "cache", icon: Database, label: "Data & Cache" },
  { id: "about", icon: Info, label: "About" },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("account");
  const [settings, setSettings] = useState({
    theme: "dark",
    language: "en",
    autoPlay: true,
    startOnLastChannel: true,
    showChannelNumbers: false,
    bufferSize: 30,
    hardwareAcceleration: true,
    parentalEnabled: false,
    epgRefresh: 6,
    // Player engine settings
    preferredEngine: "auto",
    bufferMode: "balanced",
    subtitleDelay: 0,
    audioLanguage: "",
  });

  const updateSetting = <K extends keyof typeof settings>(
    key: K,
    value: typeof settings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };
  
  const engineOptions = [
    { id: "auto", displayName: "Auto (Recommended)", available: true },
    { id: "shaka", displayName: "Shaka Player", available: true },
    { id: "html5", displayName: "HTML5 (Fallback)", available: true },
  ];

  const trialDaysRemaining = APP_CONFIG.subscription.trialDays;

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row h-full">
        {/* Settings Navigation */}
        <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-border">
          <div className="p-4 lg:p-6">
            <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Settings
            </h1>
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
                  {section.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl space-y-6">
            {/* Account Section */}
            {activeSection === "account" && (
              <>
                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>Manage your account settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-primary-foreground">
                        U
                      </div>
                      <div>
                        <p className="font-semibold">User</p>
                        <p className="text-sm text-muted-foreground">user@example.com</p>
                      </div>
                      <Button variant="outline" size="sm" className="ml-auto">
                        Edit Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>Preferences</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Moon className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label>Dark Mode</Label>
                          <p className="text-sm text-muted-foreground">Always on</p>
                        </div>
                      </div>
                      <Switch checked disabled />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label>Language</Label>
                          <p className="text-sm text-muted-foreground">Select your language</p>
                        </div>
                      </div>
                      <Select value={settings.language} onValueChange={(v) => updateSetting("language", v)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
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
                    <CardTitle>Media Player</CardTitle>
                    <CardDescription>Choose your preferred player engine</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Player Engine</Label>
                        <p className="text-sm text-muted-foreground">Auto selects the best player for your platform</p>
                      </div>
                      <Select value={settings.preferredEngine} onValueChange={(v) => updateSetting("preferredEngine", v)}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {engineOptions.map(opt => (
                            <SelectItem key={opt.id} value={opt.id} disabled={!opt.available}>
                              {opt.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Buffer Mode</Label>
                        <p className="text-sm text-muted-foreground">Balance between latency and stability</p>
                      </div>
                      <Select value={settings.bufferMode} onValueChange={(v) => updateSetting("bufferMode", v)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low-latency">Low Latency</SelectItem>
                          <SelectItem value="balanced">Balanced</SelectItem>
                          <SelectItem value="stability">Stability</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                          <Label>Auto-play</Label>
                          <p className="text-sm text-muted-foreground">Start playing automatically</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.autoPlay}
                        onCheckedChange={(v) => updateSetting("autoPlay", v)}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <Label>Start on last channel</Label>
                          <p className="text-sm text-muted-foreground">Resume from where you left</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings.startOnLastChannel}
                        onCheckedChange={(v) => updateSetting("startOnLastChannel", v)}
                      />
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Subtitle Delay</Label>
                        <span className="text-sm text-muted-foreground">{settings.subtitleDelay}ms</span>
                      </div>
                      <Slider
                        value={[settings.subtitleDelay]}
                        onValueChange={([v]) => updateSetting("subtitleDelay", v)}
                        min={-2000}
                        max={2000}
                        step={100}
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Hardware Acceleration</Label>
                        <p className="text-sm text-muted-foreground">Better performance when enabled</p>
                      </div>
                      <Switch
                        checked={settings.hardwareAcceleration}
                        onCheckedChange={(v) => updateSetting("hardwareAcceleration", v)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Parental Section */}
            {activeSection === "parental" && (
              <Card variant="glass">
                <CardHeader>
                  <CardTitle>Parental Controls</CardTitle>
                  <CardDescription>Restrict access to certain content</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Parental Controls</Label>
                      <p className="text-sm text-muted-foreground">Require PIN for restricted content</p>
                    </div>
                    <Switch
                      checked={settings.parentalEnabled}
                      onCheckedChange={(v) => updateSetting("parentalEnabled", v)}
                    />
                  </div>
                  {settings.parentalEnabled && (
                    <>
                      <Separator />
                      <Button variant="outline">Set PIN Code</Button>
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
                        <h3 className="text-lg font-semibold">Free Trial</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {trialDaysRemaining} days remaining in your trial
                        </p>
                        <div className="w-full bg-muted rounded-full h-2 mb-4">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${(trialDaysRemaining / 7) * 100}%` }}
                          />
                        </div>
                        <Button variant="premium" size="lg">
                          Upgrade to Premium • {APP_CONFIG.subscription.pricePerYear} {APP_CONFIG.subscription.currency}/year
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card variant="glass">
                  <CardHeader>
                    <CardTitle>Premium Features</CardTitle>
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
      </div>
    </AppLayout>
  );
}
