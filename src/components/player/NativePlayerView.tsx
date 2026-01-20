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
  ExternalLink,
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
import { 
  NativePlayback, 
  isNativePlatform,
  getPlatform,
} from '@/player/NativePlaybackPlugin';
import { PlayerLock, PlayerLockOverlay } from './PlayerLock';
import { EngineSwitcher } from './EngineSwitcher';
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
  const [isNativeAvailable, setIsNativeAvailable] = useState<boolean | null>(null);
  const [pluginError, setPluginError] = useState<string | null>(null);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get stream URL
  const streamUrl = directStreamUrl || channel?.streamUrl;
  const title = vodTitle || channel?.name || 'Stream';
  const isVod = !!directStreamUrl;
  
  // Check native availability and initialize controller
  useEffect(() => {
    const checkAndInitialize = async () => {
      // First check if platform is Android
      const platform = getPlatform();
      const isNative = isNativePlatform();
      
      console.log(`[NativePlayerView] Platform: ${platform}, isNative: ${isNative}`);
      
      if (!isNative || platform !== 'android') {
        console.warn('[NativePlayerView] Not running on Android native');
        setIsNativeAvailable(false);
        setPluginError('Appen körs inte som native Android-app');
        return;
      }
      
      // Check if the NativePlayback plugin is actually available
      try {
        const info = await NativePlayback.getEngineInfo();
        console.log('[NativePlayerView] Plugin info:', info);
        
        if (info?.platform !== 'android') {
          throw new Error('Plugin returned non-Android platform');
        }
        
        setIsNativeAvailable(true);
        setPluginError(null);
      } catch (err: any) {
        console.error('[NativePlayerView] Plugin not available:', err);
        setIsNativeAvailable(false);
        
        const isNotImplemented = err?.message?.includes('not implemented') || 
                                 err?.code === 'UNIMPLEMENTED';
        setPluginError(
          isNotImplemented 
            ? 'NativePlayback-plugin ej implementerat. Bygg appen lokalt med Android Studio.'
            : `Plugin-fel: ${err?.message || 'Okänt fel'}`
        );
        
        setState(prev => ({
          ...prev,
          status: 'error',
          error: {
            code: 'NATIVE_PLUGIN_UNAVAILABLE',
            message: isNotImplemented 
              ? 'Native-plugin ej tillgängligt. Bygg appen med: git pull, npm run build, npx cap sync android, och kör från Android Studio.'
              : err?.message || 'Native-plugin kunde inte laddas',
            recoverable: false,
          },
        }));
        return;
      }
      
      // Initialize controller
      try {
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
      } catch (err) {
        console.error('[NativePlayerView] Failed to initialize controller:', err);
        setState(prev => ({
          ...prev,
          status: 'error',
          error: {
            code: 'CONTROLLER_INIT_FAILED',
            message: 'Kunde inte starta native-spelaren. Försök starta om appen.',
            recoverable: false,
          },
        }));
      }
    };
    
    checkAndInitialize();
    
    return () => {
      controllerRef.current?.destroy();
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
  
  const handleSwitchToExo = useCallback(() => {
    controllerRef.current?.switchToExoPlayer();
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
            {pluginError ? 'Native-spelare ej tillgänglig' : 'Uppspelningsfel'}
          </h3>
          <p className="text-muted-foreground text-center mb-4 max-w-md">
            {state.error?.message || pluginError || 'Kunde inte spela upp strömmen'}
          </p>
          
          {/* Build instructions for plugin error */}
          {pluginError && (
            <div className="mb-6 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground max-w-md">
              <p className="font-medium text-foreground mb-2">Så här fixar du det:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Kör <code className="bg-background px-1 rounded">git pull</code></li>
                <li>Kör <code className="bg-background px-1 rounded">npm run build</code></li>
                <li>Kör <code className="bg-background px-1 rounded">npx cap sync android</code></li>
                <li>Öppna android/-mappen i Android Studio</li>
                <li>Build → Clean Project → Rebuild</li>
                <li>Kör appen på enheten</li>
              </ol>
            </div>
          )}
          
          <div className="flex flex-wrap gap-3 justify-center">
            {!pluginError && (
              <>
                <Button onClick={handleRetry} variant="default">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Försök igen
                </Button>
                {currentEngine !== 'vlc-bridge' && (
                  <Button onClick={handleSwitchToVlc} variant="outline">
                    Prova VLC-läge
                  </Button>
                )}
              </>
            )}
            
            {/* External player option */}
            {streamUrl && (
              <Button 
                variant="outline"
                onClick={() => window.open(`vlc://${streamUrl}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Öppna i extern spelare
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
            </div>
            
            <div className="flex items-center gap-2">
              {/* Engine Switcher - Quick switch between ExoPlayer and VLC */}
              <EngineSwitcher
                currentEngine={currentEngine}
                onSwitchToExo={handleSwitchToExo}
                onSwitchToVlc={handleSwitchToVlc}
              />
              
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
