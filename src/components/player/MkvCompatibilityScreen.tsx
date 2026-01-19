/**
 * MkvCompatibilityScreen - Smart fallback screen for MKV and unsupported containers
 * Shows platform-specific options and handles VLC fallback
 */

import { useState, useEffect } from 'react';
import {
  FileVideo,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Cast,
  Settings,
  RefreshCw,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { detectPlatform, Platform } from '@/player/PlaybackPreflight';
import { localStore } from '@/data/stores/localStore';

export type MkvAction = 
  | 'vlc_fallback'      // Use VLC engine
  | 'external_vlc'      // Open in external VLC
  | 'external_mx'       // Open in MX Player
  | 'copy_url'          // Copy URL
  | 'cast'              // Try casting
  | 'retry_native';     // Retry with native player

interface MkvCompatibilityScreenProps {
  streamUrl: string;
  format: string;
  title?: string;
  platform: Platform;
  onAction: (action: MkvAction) => void;
  onCancel: () => void;
  onRememberChoice?: (choice: 'vlc' | 'exo') => void;
  isRetrying?: boolean;
  className?: string;
}

export function MkvCompatibilityScreen({
  streamUrl,
  format,
  title,
  platform,
  onAction,
  onCancel,
  onRememberChoice,
  isRetrying = false,
  className,
}: MkvCompatibilityScreenProps) {
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rememberChoice, setRememberChoice] = useState(false);
  const [savedPreference, setSavedPreference] = useState<'auto' | 'exo' | 'vlc'>('auto');
  
  const formatUpper = format.toUpperCase();
  const isNativePlatform = platform === 'android' || platform === 'ios';
  
  // Load saved preference
  useEffect(() => {
    localStore.getSettings().then((settings) => {
      const pref = (settings.playerSettings as { mkvPlayerPreference?: 'auto' | 'exo' | 'vlc' })?.mkvPlayerPreference;
      if (pref) {
        setSavedPreference(pref);
      }
    });
  }, []);

  const handleCopyClick = async () => {
    try {
      await navigator.clipboard.writeText(streamUrl);
      setCopied(true);
      toast.success('URL kopierad till urklipp');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Kunde inte kopiera URL');
    }
  };

  const handleVlcClick = () => {
    if (rememberChoice && onRememberChoice) {
      onRememberChoice('vlc');
    }
    
    if (isNativePlatform) {
      // Use internal VLC engine on native
      onAction('vlc_fallback');
      toast.success('Byter till kompatibelt uppspelningsläge');
    } else {
      // Open external VLC on web
      const vlcLink = `vlc://${streamUrl}`;
      const link = document.createElement('a');
      link.href = vlcLink;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      try {
        link.click();
        toast.success('Öppnar VLC...', {
          description: 'Om VLC inte öppnas, kopiera länken och öppna manuellt.',
        });
        onAction('external_vlc');
      } catch {
        handleCopyClick();
      }
    }
  };

  const handleMxPlayerClick = () => {
    const intent = `intent:${streamUrl}#Intent;type=video/*;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(title || 'Video')};end`;
    
    const link = document.createElement('a');
    link.href = intent;
    
    try {
      link.click();
      toast.info('Öppnar MX Player...');
      onAction('external_mx');
    } catch {
      handleCopyClick();
    }
  };

  const handleRetryNative = () => {
    if (rememberChoice && onRememberChoice) {
      onRememberChoice('exo');
    }
    onAction('retry_native');
  };

  const handleCast = () => {
    onAction('cast');
  };

  return (
    <div className={cn('flex flex-col items-center justify-center p-4 sm:p-8', className)}>
      <Card className="w-full max-w-lg bg-card/95 backdrop-blur border-border">
        <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-full bg-warning/20 shrink-0">
              <FileVideo className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold mb-1">
                {isNativePlatform 
                  ? 'Kräver kompatibelt uppspelningsläge'
                  : `${formatUpper}-format stöds ej`
                }
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {title && <span className="font-medium">{title}</span>}
                {title && <br />}
                {isNativePlatform 
                  ? `${formatUpper} kräver specialhantering för optimal uppspelning.`
                  : `Webbläsare kan inte spela ${formatUpper}-filer direkt.`
                }
              </p>
            </div>
          </div>

          {/* Primary actions based on platform */}
          <div className="space-y-2 sm:space-y-3">
            {/* VLC / Compatibility Mode - Primary for native */}
            <Button
              variant="default"
              className="w-full justify-start gap-3 h-auto py-2.5 sm:py-3"
              onClick={handleVlcClick}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <RefreshCw className="w-5 h-5 shrink-0 animate-spin" />
              ) : (
                <Play className="w-5 h-5 shrink-0" />
              )}
              <div className="text-left min-w-0">
                <div className="font-medium text-sm sm:text-base">
                  {isNativePlatform ? 'Spela i kompatibelt läge' : 'Öppna i VLC'}
                </div>
                <div className="text-xs opacity-80 truncate">
                  {isNativePlatform 
                    ? 'Använder VLC för bästa kompatibilitet'
                    : 'Fungerar på alla plattformar'
                  }
                </div>
              </div>
            </Button>

            {/* MX Player - Android only */}
            {platform === 'android' && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-2.5 sm:py-3"
                onClick={handleMxPlayerClick}
              >
                <Smartphone className="w-5 h-5 shrink-0" />
                <div className="text-left min-w-0">
                  <div className="font-medium text-sm sm:text-base">Öppna i MX Player</div>
                  <div className="text-xs text-muted-foreground truncate">
                    Rekommenderat för MKV på Android
                  </div>
                </div>
              </Button>
            )}

            {/* Cast option */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-2.5 sm:py-3"
              onClick={handleCast}
            >
              <Cast className="w-5 h-5 shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-medium text-sm sm:text-base">Casta till TV</div>
                <div className="text-xs text-muted-foreground truncate">
                  Chromecast eller AirPlay
                </div>
              </div>
            </Button>

            {/* Copy URL */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-2.5 sm:py-3"
              onClick={handleCopyClick}
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <Copy className="w-5 h-5 shrink-0" />
              )}
              <div className="text-left min-w-0">
                <div className="font-medium text-sm sm:text-base">
                  {copied ? 'URL kopierad!' : 'Kopiera URL'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  Klistra in i valfri mediaspelare
                </div>
              </div>
            </Button>
          </div>

          {/* Remember choice toggle */}
          {isNativePlatform && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <Label htmlFor="remember-choice" className="text-sm cursor-pointer">
                Kom ihåg mitt val för {formatUpper}
              </Label>
              <Switch
                id="remember-choice"
                checked={rememberChoice}
                onCheckedChange={setRememberChoice}
              />
            </div>
          )}

          {/* Advanced options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Avancerade alternativ
                </span>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {/* Retry with native (for debugging) */}
              {isNativePlatform && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={handleRetryNative}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Försök med standardspelare (kan misslyckas)
                </Button>
              )}
              
              {/* Open in external VLC (if not already shown) */}
              {isNativePlatform && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => {
                    const vlcLink = `vlc://${streamUrl}`;
                    window.open(vlcLink, '_blank');
                    onAction('external_vlc');
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Öppna i extern VLC-app
                </Button>
              )}

              {/* Explanation */}
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-2">
                <p>
                  <strong>{formatUpper}</strong> är ett containerformat med varierande codec-stöd.
                  {isNativePlatform 
                    ? ' VLC-läget ger bästa kompatibilitet.'
                    : ' Webbläsare stöder inte detta format.'}
                </p>
                {savedPreference !== 'auto' && (
                  <p className="text-primary">
                    Din sparade inställning: {savedPreference === 'vlc' ? 'VLC' : 'Native'}
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Cancel button */}
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            Tillbaka
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
