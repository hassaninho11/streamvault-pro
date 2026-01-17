/**
 * PlaylistLoadingOverlay - Shows progress when parsing large playlists
 * Displays percentage, stage, and ETA
 */

import { useEffect, useState, useMemo } from 'react';
import { Loader2, Download, Database, Search, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useChannelStore } from '@/data/stores/channelStore';

interface LoadingStage {
  id: string;
  label: string;
  icon: React.ReactNode;
  range: [number, number]; // Progress range for this stage
}

const STAGES: LoadingStage[] = [
  { id: 'fetch', label: 'Fetching playlist...', icon: <Download className="w-5 h-5" />, range: [0, 30] },
  { id: 'parse', label: 'Parsing channels...', icon: <Database className="w-5 h-5" />, range: [30, 70] },
  { id: 'index', label: 'Building search index...', icon: <Search className="w-5 h-5" />, range: [70, 95] },
  { id: 'complete', label: 'Complete!', icon: <CheckCircle2 className="w-5 h-5" />, range: [95, 100] },
];

function formatEta(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) return '';
  if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `~${mins}m ${secs}s remaining`;
}

export function PlaylistLoadingOverlay() {
  const isLoading = useChannelStore((state) => state.isLoading);
  const progress = useChannelStore((state) => state.parseProgress);
  const channelCount = useChannelStore((state) => state.channels.length);
  
  const [startTime, setStartTime] = useState<number | null>(null);
  const [progressHistory, setProgressHistory] = useState<{ time: number; progress: number }[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  // Track when loading starts
  useEffect(() => {
    if (isLoading && !startTime) {
      setStartTime(Date.now());
      setProgressHistory([]);
      // Small delay before showing to avoid flash for cached loads
      const timer = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timer);
    }
    if (!isLoading && startTime) {
      // Keep visible briefly after completion
      const timer = setTimeout(() => {
        setIsVisible(false);
        setStartTime(null);
        setProgressHistory([]);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, startTime]);

  // Track progress for ETA calculation
  useEffect(() => {
    if (isLoading && progress > 0) {
      setProgressHistory(prev => {
        const now = Date.now();
        // Keep last 10 samples for smoothing
        const newHistory = [...prev.slice(-9), { time: now, progress }];
        return newHistory;
      });
    }
  }, [isLoading, progress]);

  // Calculate ETA based on progress rate
  const eta = useMemo(() => {
    if (progressHistory.length < 2 || progress >= 100) return '';
    
    const first = progressHistory[0];
    const last = progressHistory[progressHistory.length - 1];
    const elapsed = (last.time - first.time) / 1000; // seconds
    const progressMade = last.progress - first.progress;
    
    if (progressMade <= 0 || elapsed <= 0) return '';
    
    const rate = progressMade / elapsed; // % per second
    const remaining = 100 - progress;
    const etaSeconds = remaining / rate;
    
    return formatEta(etaSeconds);
  }, [progressHistory, progress]);

  // Determine current stage
  const currentStage = useMemo(() => {
    return STAGES.find(stage => progress >= stage.range[0] && progress < stage.range[1]) || STAGES[STAGES.length - 1];
  }, [progress]);

  // Don't render if not visible or very quick load
  if (!isVisible || (!isLoading && progress === 0)) {
    return null;
  }

  const isComplete = progress >= 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md mx-4 p-6 bg-card rounded-2xl border border-border shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-3 rounded-xl transition-colors",
            isComplete ? "bg-green-500/20 text-green-500" : "bg-primary/20 text-primary"
          )}>
            {isComplete ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <Loader2 className="w-6 h-6 animate-spin" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {isComplete ? 'Channels Loaded!' : 'Loading Playlist'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isComplete 
                ? `${channelCount.toLocaleString()} channels ready`
                : 'Preparing your channels...'
              }
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress 
            value={progress} 
            className="h-3"
          />
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">{Math.round(progress)}%</span>
            {eta && !isComplete && (
              <span className="text-muted-foreground">{eta}</span>
            )}
          </div>
        </div>

        {/* Stage indicators */}
        <div className="space-y-2">
          {STAGES.slice(0, -1).map((stage, index) => {
            const isActive = currentStage.id === stage.id;
            const isCompleted = progress >= stage.range[1];
            
            return (
              <div 
                key={stage.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-all duration-300",
                  isActive && "bg-primary/10",
                  isCompleted && "opacity-60"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isActive && "bg-primary/20 text-primary",
                  isCompleted && "bg-green-500/20 text-green-500",
                  !isActive && !isCompleted && "text-muted-foreground"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-current opacity-30" />
                  )}
                </div>
                <span className={cn(
                  "text-sm transition-colors",
                  isActive && "text-foreground font-medium",
                  isCompleted && "text-muted-foreground",
                  !isActive && !isCompleted && "text-muted-foreground/50"
                )}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Channel count during loading */}
        {!isComplete && channelCount > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{channelCount.toLocaleString()}</span> channels loaded so far
          </div>
        )}
      </div>
    </div>
  );
}

export default PlaylistLoadingOverlay;
