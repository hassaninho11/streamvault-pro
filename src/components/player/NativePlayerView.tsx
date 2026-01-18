/**
 * NativePlayerView - Player component for Android/iOS native playback
 * Uses ExoPlayer on Android and AVPlayer on iOS with VLC fallback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize,
  SkipBack,
  SkipForward,
  Loader2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Settings,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Channel } from '@/types/iptv';
import { PlayerState, MediaSource } from '@/player/types';
import { 
  AndroidPlaybackController, 
  getAndroidPlaybackController,
  isAndroidPlaybackAvailable,
} from '@/player/AndroidPlaybackController';
import { PlayerLock, PlayerLockOverlay } from './PlayerLock';
import { useTVMode } from '@/contexts/TVModeContext';
import { toast } from 'sonner';

interface NativePlayerViewProps {
  channel?: Channel | null;
  directStreamUrl?: string;
  vodTitle?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onBack?: () => void;
  className?: string;
}

export function NativePlayerView({
  channel,
  directStreamUrl,
  vodTitle,
  onPrevious,
  onNext,
  onBack,
  className,
}: NativePlayerViewProps) {
  const { isTVMode } = useTVMode();
  const controllerRef = useRef<AndroidPlaybackController | null>(null);
  
  const [state, setState] = useState<PlayerState>({
    status: 'idle',
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    error: null,
  });
  
  const [showControls, setShowControls] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [currentEngine, setCurrentEngine] = useState<string>('none');
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get stream URL
  const streamUrl = directStreamUrl || channel?.streamUrl;
  const title = vodTitle || channel?.name || 'Stream';
  const isVod = !!directStreamUrl;
  
  // Initialize controller
  useEffect(() => {
    if (!isAndroidPlaybackAvailable()) {
      console.warn('[NativePlayerView] Android playback not available');
      return;
    }
    
    const controller = getAndroidPlaybackController({
      onStateChange: (newState) => {
        setState(newState);
      },
      onEngineChange: (engineId, reason) => {
        setCurrentEngine(engineId);
        console.log(`[NativePlayerView] Engine changed to ${engineId} (${reason})`);
      },
      onError: (error) => {
        console.error('[NativePlayerView] Playback error:', error);
        if (!error.recoverable) {
          toast.error(error.message);
        }
      },
    });
    
    controllerRef.current = controller;
    
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);
  
  // Load stream when URL changes
  useEffect(() => {
    if (!streamUrl || !controllerRef.current) return;
    
    const source: MediaSource = {
      url: streamUrl,
      type: isVod ? 'vod' : 'live',
      title,
    };
    
    controllerRef.current.load(source);
    
    return () => {
      controllerRef.current?.stop();
    };
  }, [streamUrl, isVod, title]);
  
  // Controls visibility
  const showControlsTemporarily = useCallback(() => {
    if (isLocked) return;
    
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      if (state.status === 'playing') {
        setShowControls(false);
      }
    }, 4000);
  }, [isLocked, state.status]);
  
  // Control handlers
  const handlePlayPause = useCallback(() => {
    if (state.status === 'playing') {
      controllerRef.current?.pause();
    } else {
      controllerRef.current?.play();
    }
  }, [state.status]);
  
  const handleSeek = useCallback((value: number[]) => {
    controllerRef.current?.seek(value[0]);
  }, []);
  
  const handleVolumeChange = useCallback((value: number[]) => {
    controllerRef.current?.setVolume(value[0] / 100);
  }, []);
  
  const handleMuteToggle = useCallback(() => {
    controllerRef.current?.toggleMute();
  }, []);
  
  const handleRetry = useCallback(() => {
    if (streamUrl && controllerRef.current) {
      const source: MediaSource = {
        url: streamUrl,
        type: isVod ? 'vod' : 'live',
        title,
      };
      controllerRef.current.load(source);
    }
  }, [streamUrl, isVod, title]);
  
  const handleSwitchToVlc = useCallback(() => {
    controllerRef.current?.switchToVlc();
  }, []);
  
  // Format time
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  
  const isBuffering = state.status === 'loading' || state.status === 'buffering';
  const isPlaying = state.status === 'playing';
  const hasError = state.status === 'error';
  
  return (
    <div 
      className={cn(
        "relative bg-black aspect-video w-full overflow-hidden",
        isTVMode && "aspect-auto h-full",
        className
      )}
      onClick={showControlsTemporarily}
      onMouseMove={showControlsTemporarily}
    >
      {/* Native player renders here via Capacitor - this is just the overlay UI */}
      <div className="absolute inset-0 bg-black">
        {/* Placeholder for native player surface */}
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          {state.status === 'idle' && !streamUrl && (
            <p>Ingen stream vald</p>
          )}
        </div>
      </div>
      
      {/* Buffering indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="w-16 h-16 animate-spin text-primary" />
        </div>
      )}
      
      {/* Error screen */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Uppspelningsfel
          </h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            {state.error?.message || 'Kunde inte spela upp strömmen'}
          </p>
          <div className="flex gap-3">
            <Button onClick={handleRetry} variant="default">
              <RefreshCw className="w-4 h-4 mr-2" />
              Försök igen
            </Button>
            {currentEngine !== 'vlc-bridge' && (
              <Button onClick={handleSwitchToVlc} variant="outline">
                Prova VLC-läge
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Player Lock Overlay */}
      <PlayerLockOverlay 
        isLocked={isLocked}
        onUnlock={() => setIsLocked(false)}
      />
      
      {/* Controls overlay */}
      {!isLocked && showControls && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="text-white">
                <ArrowLeft className="w-6 h-6" />
              </Button>
            )}
            
            <div className="flex-1 mx-4">
              <h2 className={cn(
                "font-semibold text-white truncate",
                isTVMode ? "text-2xl" : "text-lg"
              )}>
                {title}
              </h2>
              {currentEngine && (
                <p className="text-xs text-white/60">
                  {currentEngine === 'exo-bridge' ? 'ExoPlayer' : 
                   currentEngine === 'vlc-bridge' ? 'VLC' : currentEngine}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <PlayerLock 
                isLocked={isLocked}
                onLockToggle={setIsLocked}
              />
              <Button variant="ghost" size="icon" className="text-white">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          {/* Center controls */}
          <div className="absolute inset-0 flex items-center justify-center gap-8">
            {onPrevious && (
              <Button
                variant="ghost"
                size="lg"
                onClick={onPrevious}
                className="text-white hover:bg-white/20"
              >
                <SkipBack className={cn("w-8 h-8", isTVMode && "w-12 h-12")} />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="lg"
              onClick={handlePlayPause}
              className="text-white hover:bg-white/20"
              disabled={isBuffering}
            >
              {isPlaying ? (
                <Pause className={cn("w-16 h-16", isTVMode && "w-24 h-24")} />
              ) : (
                <Play className={cn("w-16 h-16", isTVMode && "w-24 h-24")} />
              )}
            </Button>
            
            {onNext && (
              <Button
                variant="ghost"
                size="lg"
                onClick={onNext}
                className="text-white hover:bg-white/20"
              >
                <SkipForward className={cn("w-8 h-8", isTVMode && "w-12 h-12")} />
              </Button>
            )}
          </div>
          
          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
            {/* Progress bar (VOD only) */}
            {isVod && state.duration > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-white text-sm w-16 text-right">
                  {formatTime(state.currentTime)}
                </span>
                <Slider
                  value={[state.currentTime]}
                  max={state.duration}
                  step={1}
                  onValueChange={handleSeek}
                  className="flex-1"
                />
                <span className="text-white text-sm w-16">
                  {formatTime(state.duration)}
                </span>
              </div>
            )}
            
            {/* Volume and other controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleMuteToggle}
                  className="text-white"
                >
                  {state.isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </Button>
                <Slider
                  value={[state.isMuted ? 0 : state.volume * 100]}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                  className="w-24"
                />
              </div>
              
              <div className="flex items-center gap-2">
                {!isVod && (
                  <span className="flex items-center gap-1 text-red-500 text-sm font-medium">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
                <Button variant="ghost" size="icon" className="text-white">
                  <Maximize className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Channel navigation arrows (Live TV) */}
          {!isVod && (onPrevious || onNext) && (
            <>
              {onPrevious && (
                <button
                  onClick={onPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronUp className="w-6 h-6" />
                </button>
              )}
              {onNext && (
                <button
                  onClick={onNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <ChevronDown className="w-6 h-6" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default NativePlayerView;
