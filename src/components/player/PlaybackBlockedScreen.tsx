/**
 * PlaybackBlockedScreen - Smart fallback UI when playback is blocked
 * Shows options for proxy, casting, and external players
 */

import { useState, useEffect } from 'react';
import {
  Shield,
  Cast,
  ExternalLink,
  Copy,
  Monitor,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  Play,
  Loader2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  PreflightResult,
  PlaybackStrategy,
  getStrategyLabel,
} from '@/player/PlaybackPreflight';
import {
  copyStreamUrl,
  generateVlcLink,
  startCasting,
  StrategyContext,
} from '@/player/PlaybackStrategyResolver';
import { getCastController, CastDevice } from '@/player/CastController';
import { localStore } from '@/data/stores/localStore';
import { toast } from 'sonner';

interface PlaybackBlockedScreenProps {
  preflight: PreflightResult;
  context: StrategyContext;
  onStrategySelect: (strategy: PlaybackStrategy, resolvedUrl?: string) => void;
  onCancel: () => void;
  className?: string;
}

// Icons for each strategy
const strategyIcons: Record<PlaybackStrategy, React.ElementType> = {
  direct: Play,
  upgraded_https: Lock,
  proxy_https: Shield,
  cast_chromecast: Cast,
  external_player: ExternalLink,
  desktop_electron: Monitor,
};

export function PlaybackBlockedScreen({
  preflight,
  context,
  onStrategySelect,
  onCancel,
  className,
}: PlaybackBlockedScreenProps) {
  const [isLoading, setIsLoading] = useState<PlaybackStrategy | null>(null);
  const [rememberChoice, setRememberChoice] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [castDevices, setCastDevices] = useState<CastDevice[]>([]);
  const [showCastPicker, setShowCastPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  // Get cast devices
  useEffect(() => {
    const controller = getCastController();
    setCastDevices(controller.getDevices());
  }, []);

  // Save preference if remember is checked
  const savePreference = async (strategy: PlaybackStrategy) => {
    if (!rememberChoice) return;
    
    // Only save web-compatible strategies
    const validStrategies: Array<'auto' | 'proxy_https' | 'cast_chromecast' | 'external_player'> = 
      ['proxy_https', 'cast_chromecast', 'external_player'];
    
    if (!validStrategies.includes(strategy as typeof validStrategies[number])) return;
    
    try {
      const settings = await localStore.getSettings();
      await localStore.saveSettings({
        ...settings,
        playerSettings: {
          ...settings.playerSettings,
          httpStreamStrategy: strategy as 'proxy_https' | 'cast_chromecast' | 'external_player',
        },
      });
      toast.success('Val sparat');
    } catch (e) {
      console.error('Failed to save preference:', e);
    }
  };

  const handleProxyClick = async () => {
    setIsLoading('proxy_https');
    
    try {
      // Build proxy URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const settings = await localStore.getSettings();
      const customProxyUrl = settings.playerSettings?.customProxyUrl;
      
      let proxyUrl: string;
      if (customProxyUrl) {
        if (customProxyUrl.includes('?') || customProxyUrl.endsWith('=')) {
          proxyUrl = `${customProxyUrl}${encodeURIComponent(context.streamUrl)}`;
        } else {
          proxyUrl = `${customProxyUrl}?url=${encodeURIComponent(context.streamUrl)}`;
        }
      } else if (supabaseUrl) {
        proxyUrl = `${supabaseUrl}/functions/v1/stream-proxy?url=${encodeURIComponent(context.streamUrl)}`;
      } else {
        toast.error('Ingen proxy tillgänglig');
        setIsLoading(null);
        return;
      }
      
      await savePreference('proxy_https');
      onStrategySelect('proxy_https', proxyUrl);
    } catch (error) {
      console.error('Proxy setup failed:', error);
      toast.error('Kunde inte konfigurera proxy');
    } finally {
      setIsLoading(null);
    }
  };

  const handleCastClick = () => {
    if (castDevices.length === 0) {
      toast.error('Inga Cast-enheter hittades', {
        description: 'Se till att din Chromecast är på samma nätverk.',
      });
      return;
    }
    
    setShowCastPicker(true);
  };

  const handleCastToDevice = async (device: CastDevice) => {
    setIsLoading('cast_chromecast');
    setShowCastPicker(false);
    
    try {
      const success = await startCasting(device, context);
      if (success) {
        await savePreference('cast_chromecast');
        onStrategySelect('cast_chromecast');
      }
    } catch (error) {
      console.error('Cast failed:', error);
      toast.error('Kunde inte starta casting');
    } finally {
      setIsLoading(null);
    }
  };

  const handleExternalClick = async () => {
    // Try VLC deep link first
    const vlcLink = generateVlcLink(context.streamUrl);
    
    // Create a temporary link and try to open it
    const link = document.createElement('a');
    link.href = vlcLink;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    // Some browsers block this, so we also copy to clipboard
    await copyStreamUrl(context.streamUrl);
    
    try {
      link.click();
      toast.success('Öppnar VLC...', {
        description: 'Om VLC inte öppnas, använd den kopierade länken.',
      });
    } catch {
      toast.info('URL kopierad', {
        description: 'Klistra in länken i VLC eller annan mediaspelare.',
      });
    }
    
    await savePreference('external_player');
  };

  const handleCopyClick = async () => {
    const success = await copyStreamUrl(context.streamUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Cast device picker
  if (showCastPicker) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8', className)}>
        <Card className="w-full max-w-md bg-card/95 backdrop-blur border-border">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Cast className="w-6 h-6 text-primary" />
              <h2 className="text-lg font-semibold">Välj Cast-enhet</h2>
            </div>
            
            <div className="space-y-2">
              {castDevices.map((device) => (
                <Button
                  key={device.id}
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => handleCastToDevice(device)}
                  disabled={isLoading !== null}
                >
                  <Cast className="w-4 h-4" />
                  {device.name}
                </Button>
              ))}
            </div>
            
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowCastPicker(false)}
            >
              Avbryt
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center p-8', className)}>
      <Card className="w-full max-w-lg bg-card/95 backdrop-blur border-border">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-warning/20">
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-1">
                Kan inte spela HTTP-kanaler i webbläsaren
              </h2>
              <p className="text-sm text-muted-foreground">
                Din webbläsare blockerar HTTP-video på en säker (HTTPS) sida.
                Välj ett alternativ nedan:
              </p>
            </div>
          </div>

          {/* Strategy buttons */}
          <div className="space-y-3">
            {/* Proxy option */}
            {preflight.availableStrategies.includes('proxy_https') && (
              <Button
                variant="default"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={handleProxyClick}
                disabled={isLoading !== null}
              >
                {isLoading === 'proxy_https' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Shield className="w-5 h-5" />
                )}
                <div className="text-left">
                  <div className="font-medium">Spela via Proxy (HTTPS)</div>
                  <div className="text-xs opacity-80">Rekommenderat - Bäst UX</div>
                </div>
              </Button>
            )}

            {/* Cast option */}
            {preflight.availableStrategies.includes('cast_chromecast') && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={handleCastClick}
                disabled={isLoading !== null}
              >
                {isLoading === 'cast_chromecast' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Cast className="w-5 h-5" />
                )}
                <div className="text-left">
                  <div className="font-medium">Casta till TV</div>
                  <div className="text-xs text-muted-foreground">
                    Chromecast eller AirPlay
                  </div>
                </div>
              </Button>
            )}

            {/* External player option */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={handleExternalClick}
              disabled={isLoading !== null}
            >
              <ExternalLink className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">Öppna i VLC</div>
                <div className="text-xs text-muted-foreground">
                  Eller annan extern mediaspelare
                </div>
              </div>
            </Button>

            {/* Copy URL option */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={handleCopyClick}
              disabled={isLoading !== null}
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
              <span>{copied ? 'Kopierad!' : 'Kopiera länk'}</span>
            </Button>
          </div>

          {/* Remember choice */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberChoice}
              onCheckedChange={(checked) => setRememberChoice(checked === true)}
            />
            <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
              Kom ihåg mitt val för HTTP-kanaler
            </Label>
          </div>

          {/* Explanation accordion */}
          <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm">
                <span>Varför händer detta?</span>
                {showExplanation ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 space-y-2">
                <p>
                  <strong>Mixed Content:</strong> Moderna webbläsare blockerar 
                  osäkra (HTTP) resurser på säkra (HTTPS) sidor för att skydda dig.
                </p>
                <p>
                  <strong>Lösningar:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>Proxy:</strong> Vi konverterar strömmen till HTTPS</li>
                  <li><strong>Cast:</strong> Skicka till en TV-enhet</li>
                  <li><strong>VLC:</strong> Desktop-appar har inte denna begränsning</li>
                </ul>
                <p className="text-xs mt-2">
                  Diagnostikkod: <code className="bg-background px-1 rounded">
                    {preflight.diagnosticCode}
                  </code>
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Cancel button */}
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            Avbryt
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
