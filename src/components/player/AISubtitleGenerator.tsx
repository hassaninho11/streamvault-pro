/**
 * AISubtitleGenerator - Premium AI subtitle generation UI
 */

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { SubtitleService } from '@/services/SubtitleService';
import { SubtitleGenerationProgress } from '@/types/vod';
import { useVodStore } from '@/data/stores/vodStore';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useTVMode } from '@/contexts/TVModeContext';

interface AISubtitleGeneratorProps {
  vodItemId: string;
  streamUrl: string;
  onSubtitleGenerated: (subtitleId: string) => void;
  onClose: () => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'auto', label: 'Automatisk' },
  { code: 'sv', label: 'Svenska' },
  { code: 'en', label: 'Engelska' },
  { code: 'no', label: 'Norska' },
  { code: 'da', label: 'Danska' },
  { code: 'fi', label: 'Finska' },
  { code: 'de', label: 'Tyska' },
  { code: 'fr', label: 'Franska' },
  { code: 'es', label: 'Spanska' },
];

export function AISubtitleGenerator({
  vodItemId,
  streamUrl,
  onSubtitleGenerated,
  onClose,
}: AISubtitleGeneratorProps) {
  const { isTVMode } = useTVMode();
  const { canAccessFeature, isPremium } = useEntitlements();
  const { addSubtitle } = useVodStore();
  
  const [targetLanguage, setTargetLanguage] = useState('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<SubtitleGenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const hasAccess = canAccessFeature('ai_subtitles');
  // Quota tracking - placeholder until we implement backend tracking
  const quotaUsage = isPremium ? { used: 0, limit: 10 } : null;
  
  const handleGenerate = async () => {
    if (!hasAccess) return;
    
    setIsGenerating(true);
    setError(null);
    setProgress(null);
    
    try {
      const result = await SubtitleService.generateSubtitle(
        vodItemId,
        streamUrl,
        targetLanguage,
        (prog) => setProgress(prog)
      );
      
      // Add to store
      addSubtitle(result.subtitle);
      
      setSuccess(true);
      onSubtitleGenerated(result.subtitle.id);
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte skapa undertext');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Render success state
  if (success) {
    return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className={cn(
          "bg-background rounded-xl shadow-2xl p-8 text-center",
          isTVMode ? "w-[500px]" : "w-[350px]"
        )}>
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Undertext skapad!</h2>
          <p className="text-muted-foreground">
            AI-genererad undertext har aktiverats.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={cn(
        "bg-background rounded-xl shadow-2xl overflow-hidden",
        isTVMode ? "w-[500px]" : "w-[380px]"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className={cn(
              "font-semibold",
              isTVMode ? "text-xl" : "text-lg"
            )}>
              Skapa AI-undertext
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isGenerating}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Premium check */}
          {!hasAccess && (
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning">Premium-funktion</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    AI-undertexter kräver Premium-prenumeration.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Quota info */}
          {hasAccess && quotaUsage && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Kvot</span>
                <span>{quotaUsage.used} / {quotaUsage.limit} timmar</span>
              </div>
              <Progress 
                value={(quotaUsage.used / quotaUsage.limit) * 100} 
                className="h-1.5 mt-2" 
              />
            </div>
          )}
          
          {/* Language selector */}
          {hasAccess && !isGenerating && (
            <div>
              <label className="text-sm font-medium mb-2 block">Språk</label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj språk" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Progress display */}
          {isGenerating && progress && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm">{progress.message || 'Bearbetar...'}</span>
              </div>
              <Progress value={progress.progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progress.progress}% klart
              </p>
            </div>
          )}
          
          {/* Error display */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}
          
          {/* Disclaimer */}
          {hasAccess && !isGenerating && (
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <p>
                <strong>OBS:</strong> AI-genererade undertexter skapas från ljudspåret och kan 
                innehålla fel. Undertexten sparas lokalt och synkas med ditt konto om du är inloggad.
              </p>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="p-4 border-t border-border flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1"
          >
            Avbryt
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!hasAccess || isGenerating}
            className={cn("flex-1 gap-2", isTVMode && "h-12")}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Skapar...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Skapa undertext
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
