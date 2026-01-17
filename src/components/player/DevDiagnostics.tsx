/**
 * DevDiagnostics - Developer-only diagnostics panel for player metrics
 * Only visible in development mode
 */

import { useState, useEffect } from "react";
import {
  Bug,
  X,
  Activity,
  Zap,
  AlertTriangle,
  HardDrive,
  Wifi,
  Clock,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMetricsStore } from "@/data/stores/metricsStore";

interface DiagnosticsData {
  currentEngine: string;
  fallbackCount: number;
  lastError: string | null;
  loadLatency: number;
  playLatency: number;
  bufferingEvents: number;
  bufferingDuration: number;
  castStatus: string;
  workerParseTime: number;
  cacheHitRatio: number;
  fps: number;
  droppedFrames: number;
  bitrate: number;
  resolution: string;
}

const isDev = import.meta.env.DEV;

export function DevDiagnostics() {
  const [isOpen, setIsOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const metrics = useMetricsStore();

  // FPS counter
  useEffect(() => {
    if (!isOpen || !isDev) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      
      if (now - lastTime >= 1000) {
        setFps(Math.round(frameCount * 1000 / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      
      animationId = requestAnimationFrame(measureFps);
    };

    animationId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animationId);
  }, [isOpen]);

  if (!isDev) return null;

  const diagnostics: DiagnosticsData = {
    currentEngine: 'Shaka', // TODO: Get from PlayerController
    fallbackCount: metrics.playerReconnects,
    lastError: metrics.playerErrors > 0 ? `${metrics.playerErrors} errors` : null,
    loadLatency: metrics.coldStartMs ?? 0,
    playLatency: metrics.lastRenderMs ?? 0,
    bufferingEvents: 0, // TODO: Track separately
    bufferingDuration: 0,
    castStatus: 'idle',
    workerParseTime: metrics.workerParseMs ?? 0,
    cacheHitRatio: metrics.cacheHitRatio,
    fps,
    droppedFrames: 0, // TODO: Track separately
    bitrate: 0,
    resolution: 'N/A',
  };

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-4 right-4 z-50",
          "bg-background/80 backdrop-blur-sm border border-border",
          isOpen && "bg-primary/20"
        )}
        title="Developer Diagnostics"
      >
        <Bug className="w-5 h-5" />
      </Button>

      {/* Diagnostics Panel */}
      {isOpen && (
        <div className={cn(
          "fixed bottom-16 right-4 z-50 w-80",
          "bg-background/95 backdrop-blur-lg rounded-xl border border-border",
          "shadow-xl overflow-hidden"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Dev Diagnostics</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* Player Engine */}
            <DiagSection title="Player Engine" icon={Activity}>
              <DiagRow label="Engine" value={diagnostics.currentEngine} />
              <DiagRow 
                label="Fallbacks" 
                value={diagnostics.fallbackCount} 
                warn={diagnostics.fallbackCount > 0}
              />
              {diagnostics.lastError && (
                <DiagRow 
                  label="Last Error" 
                  value={diagnostics.lastError} 
                  error 
                />
              )}
            </DiagSection>

            {/* Performance */}
            <DiagSection title="Performance" icon={Zap}>
              <DiagRow label="FPS" value={diagnostics.fps} warn={diagnostics.fps < 30} />
              <DiagRow 
                label="Dropped Frames" 
                value={diagnostics.droppedFrames} 
                warn={diagnostics.droppedFrames > 10}
              />
              <DiagRow label="Load Latency" value={`${diagnostics.loadLatency}ms`} />
              <DiagRow label="Play Latency" value={`${diagnostics.playLatency}ms`} />
            </DiagSection>

            {/* Buffering */}
            <DiagSection title="Buffering" icon={Clock}>
              <DiagRow 
                label="Events" 
                value={diagnostics.bufferingEvents} 
                warn={diagnostics.bufferingEvents > 5}
              />
              <DiagRow 
                label="Total Duration" 
                value={`${(diagnostics.bufferingDuration / 1000).toFixed(1)}s`}
              />
            </DiagSection>

            {/* Stream */}
            <DiagSection title="Stream" icon={Gauge}>
              <DiagRow label="Resolution" value={diagnostics.resolution || 'N/A'} />
              <DiagRow 
                label="Bitrate" 
                value={diagnostics.bitrate ? `${(diagnostics.bitrate / 1000).toFixed(0)} kbps` : 'N/A'} 
              />
            </DiagSection>

            {/* Cache */}
            <DiagSection title="Cache & Workers" icon={HardDrive}>
              <DiagRow 
                label="Cache Hit" 
                value={`${(diagnostics.cacheHitRatio * 100).toFixed(0)}%`}
                warn={diagnostics.cacheHitRatio < 0.5}
              />
              <DiagRow label="Worker Parse" value={`${diagnostics.workerParseTime}ms`} />
            </DiagSection>

            {/* Casting */}
            <DiagSection title="Casting" icon={Wifi}>
              <DiagRow label="Status" value={diagnostics.castStatus} />
            </DiagSection>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-muted/30 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Development mode only
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// Helper Components
interface DiagSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

function DiagSection({ title, icon: Icon, children }: DiagSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="space-y-1 pl-6">
        {children}
      </div>
    </div>
  );
}

interface DiagRowProps {
  label: string;
  value: string | number;
  warn?: boolean;
  error?: boolean;
}

function DiagRow({ label, value, warn, error }: DiagRowProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        "font-mono",
        warn && "text-warning",
        error && "text-destructive"
      )}>
        {error && <AlertTriangle className="w-3 h-3 inline mr-1" />}
        {value}
      </span>
    </div>
  );
}

export default DevDiagnostics;
