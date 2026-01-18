/**
 * UnsupportedFormatScreen - Shows when video format is not browser-compatible
 * Provides options for external players
 */

import { useState } from 'react';
import {
  FileVideo,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UnsupportedFormatScreenProps {
  streamUrl: string;
  format: string;
  title?: string;
  onCancel: () => void;
  className?: string;
}

export function UnsupportedFormatScreen({
  streamUrl,
  format,
  title,
  onCancel,
  className,
}: UnsupportedFormatScreenProps) {
  const [copied, setCopied] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const formatUpper = format.toUpperCase();

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
    // Try VLC deep link
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
    } catch {
      handleCopyClick();
    }
  };

  const handleMxPlayerClick = () => {
    // Android intent for MX Player
    const intent = `intent:${streamUrl}#Intent;type=video/*;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(title || 'Video')};end`;
    
    const link = document.createElement('a');
    link.href = intent;
    
    try {
      link.click();
      toast.info('Öppnar MX Player...', {
        description: 'Om appen inte öppnas, kopiera länken istället.',
      });
    } catch {
      handleCopyClick();
    }
  };

  return (
    <div className={cn('flex flex-col items-center justify-center p-4 sm:p-8', className)}>
      <Card className="w-full max-w-lg bg-card/95 backdrop-blur border-border">
        <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-full bg-destructive/20 shrink-0">
              <FileVideo className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold mb-1">
                {formatUpper}-format stöds ej i webbläsare
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {title && <span className="font-medium">{title}</span>}
                {title && <br />}
                Webbläsare kan inte spela {formatUpper}-filer direkt. 
                Använd en extern mediaspelare istället.
              </p>
            </div>
          </div>

          {/* External player options */}
          <div className="space-y-2 sm:space-y-3">
            {/* VLC */}
            <Button
              variant="default"
              className="w-full justify-start gap-3 h-auto py-2.5 sm:py-3"
              onClick={handleVlcClick}
            >
              <ExternalLink className="w-5 h-5 shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-medium text-sm sm:text-base">Öppna i VLC</div>
                <div className="text-xs opacity-80 truncate">
                  Fungerar på alla plattformar
                </div>
              </div>
            </Button>

            {/* MX Player (Android) */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-2.5 sm:py-3"
              onClick={handleMxPlayerClick}
            >
              <Smartphone className="w-5 h-5 shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-medium text-sm sm:text-base">Öppna i MX Player</div>
                <div className="text-xs text-muted-foreground truncate">
                  Android - rekommenderat för MKV
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

          {/* Explanation accordion */}
          <Collapsible open={showExplanation} onOpenChange={setShowExplanation}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm">
                <span>Varför kan jag inte spela detta?</span>
                {showExplanation ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="text-xs sm:text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 sm:p-4 space-y-2">
                <p className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <span>
                    <strong>{formatUpper}</strong> är ett containerformat som webbläsare 
                    inte stödjer. Detta beror på hur video-codecs och containrar fungerar.
                  </span>
                </p>
                <p>
                  <strong>Lösning:</strong> Använd en extern mediaspelare som VLC, 
                  MX Player, eller Infuse som har full codec-stöd.
                </p>
                <p className="text-xs">
                  <strong>Stödda format i webbläsare:</strong> MP4 (H.264/H.265), 
                  WebM, HLS (.m3u8)
                </p>
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
