import { useState, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Loader2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Radio,
  History,
  Rewind,
  FastForward,
  PictureInPicture2,
  Grid2X2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Channel } from "@/types/iptv";
import { useCatchup } from "@/services/CatchupService";
import { usePip } from "@/services/PipService";
import { useMultiScreen } from "@/contexts/MultiScreenContext";

interface VideoPlayerProps {
  channel: Channel | null;
  onPrevious?: () => void;
  onNext?: () => void;
  onOpenCatchup?: () => void;
  onOpenMultiScreen?: () => void;
  className?: string;
}

export function VideoPlayer({ channel, onPrevious, onNext, onOpenCatchup, onOpenMultiScreen, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  
  // PiP hook
  const { isActive: isPipActive, isSupported: isPipSupported, togglePip } = usePip(videoRef);
  
  // Multi-screen hook
  const { isMultiScreenMode, enterMultiScreen } = useMultiScreen();
  
  // Timeshift/Catch-up hook
  const {
    timeshiftState,
    isTimeshifting,
    behindLiveDisplay,
    goToLive,
    seekBack,
    seekForward,
    hasCatchup,
    catchupSource,
  } = useCatchup({ 
    channelId: channel?.id || '', 
    videoElement: videoRef.current 
  });

  // Cleanup HLS on unmount or channel change
  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!channel || !videoRef.current) return;
    
    const video = videoRef.current;
    const url = channel.streamUrl;
    
    setError(null);
    setIsBuffering(true);
    destroyHls();
    
    // Check if it's an HLS stream
    const isHls = url.includes('.m3u8') || url.includes('m3u8');
    
    if (isHls && Hls.isSupported()) {
      // Use HLS.js for HLS streams
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hlsRef.current = hls;
      
      hls.loadSource(url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          setError("Failed to start playback");
          setIsBuffering(false);
        });
      });
      
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError("Network error - stream unavailable");
              hls.startLoad(); // Try to recover
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError("Media error - trying to recover");
              hls.recoverMediaError();
              break;
            default:
              setError("Stream unavailable");
              break;
          }
          setIsBuffering(false);
        }
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = url;
      video.play().catch(() => {
        setError("Failed to play stream");
        setIsBuffering(false);
      });
    } else {
      // Direct playback for non-HLS streams
      video.src = url;
      video.play().catch(() => {
        setError("Failed to play stream");
        setIsBuffering(false);
      });
    }
    
    return () => {
      destroyHls();
    };
  }, [channel, destroyHls]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // Helper functions for timeshift
  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return '--:--';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };
  
  const calculateBufferProgress = (state: typeof timeshiftState): number => {
    if (!state) return 100;
    const range = state.livePosition - state.bufferStart;
    if (range <= 0) return 100;
    return ((state.playbackPosition - state.bufferStart) / range) * 100;
  };

  if (!channel) {
    return (
      <div
        className={cn(
          "bg-player-bg rounded-xl aspect-video flex items-center justify-center",
          className
        )}
      >
        <div className="text-center">
          <Play className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Select a channel to start watching</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-player-bg rounded-xl overflow-hidden aspect-video group",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onPlay={() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onError={() => {
          setError("Stream unavailable");
          setIsBuffering(false);
        }}
      />

      {/* Buffering Overlay */}
      {isBuffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-player-bg/80">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-player-bg/80">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setError(null);
                if (videoRef.current) {
                  videoRef.current.load();
                  videoRef.current.play();
                }
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-player-bg via-transparent to-player-bg/50 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Top Bar - Channel Info */}
        <div className="absolute top-0 left-0 right-0 p-4">
          <div className="flex items-center gap-3">
            {channel.logoUrl && (
              <img
                src={channel.logoUrl}
                alt={channel.name}
                className="w-10 h-10 rounded-lg object-contain bg-muted"
              />
            )}
            <div>
              <h3 className="font-semibold">{channel.name}</h3>
              <p className="text-sm text-muted-foreground">{channel.group}</p>
            </div>
          </div>
        </div>

        {/* Center Play Button */}
        <button
          onClick={togglePlay}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center shadow-glow-lg hover:scale-110 transition-transform"
        >
          {isPlaying ? (
            <Pause className="w-10 h-10" />
          ) : (
            <Play className="w-10 h-10 ml-1" />
          )}
        </button>

        {/* Channel Navigation (for TV mode) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          <Button
            variant="player"
            size="icon"
            onClick={onPrevious}
            disabled={!onPrevious}
          >
            <ChevronUp className="w-5 h-5" />
          </Button>
          <Button
            variant="player"
            size="icon"
            onClick={onNext}
            disabled={!onNext}
          >
            <ChevronDown className="w-5 h-5" />
          </Button>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
          {/* Timeshift progress bar */}
          {catchupSource?.supportsTimeshift && (
            <div className="flex items-center gap-3">
              {/* Buffer start time */}
              <span className="text-xs text-muted-foreground min-w-[45px]">
                {timeshiftState ? formatTime(timeshiftState.bufferStart) : '--:--'}
              </span>
              
              {/* Progress slider */}
              <div className="flex-1 relative">
                <Slider
                  value={[calculateBufferProgress(timeshiftState)]}
                  onValueChange={(v) => {
                    if (videoRef.current && timeshiftState) {
                      const progress = v[0] / 100;
                      const bufferDuration = (timeshiftState.livePosition - timeshiftState.bufferStart) / 1000;
                      videoRef.current.currentTime = progress * bufferDuration;
                    }
                  }}
                  max={100}
                  step={0.1}
                  className="w-full"
                />
                {/* Live dot indicator */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
              </div>
              
              {/* Live / Behind indicator button */}
              <Button
                variant={isTimeshifting ? 'outline' : 'default'}
                size="sm"
                onClick={goToLive}
                className={cn(
                  'min-w-[70px] gap-1 text-xs',
                  !isTimeshifting && 'bg-red-600 hover:bg-red-700 text-white'
                )}
              >
                <Radio className={cn('w-2.5 h-2.5', !isTimeshifting && 'animate-pulse')} />
                {behindLiveDisplay}
              </Button>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {/* Rewind controls (when timeshift available) */}
            {catchupSource?.supportsTimeshift && (
              <>
                <Button
                  variant="player"
                  size="icon"
                  onClick={() => seekBack(30)}
                  disabled={!timeshiftState?.canSeekBack}
                  title="Spola tillbaka 30s"
                >
                  <Rewind className="w-4 h-4" />
                </Button>
                <Button
                  variant="player"
                  size="icon"
                  onClick={() => seekBack(10)}
                  disabled={!timeshiftState?.canSeekBack}
                  title="Spola tillbaka 10s"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
              </>
            )}
            
            {/* Play/Pause */}
            <Button variant="player" size="icon" onClick={togglePlay}>
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </Button>

            {/* Forward controls (when timeshift available) */}
            {catchupSource?.supportsTimeshift && (
              <>
                <Button
                  variant="player"
                  size="icon"
                  onClick={() => seekForward(10)}
                  disabled={!timeshiftState?.canSeekForward}
                  title="Spola fram 10s"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
                <Button
                  variant="player"
                  size="icon"
                  onClick={() => seekForward(30)}
                  disabled={!timeshiftState?.canSeekForward}
                  title="Spola fram 30s"
                >
                  <FastForward className="w-4 h-4" />
                </Button>
              </>
            )}
            
            {/* Channel navigation (when no timeshift or as secondary) */}
            {!catchupSource?.supportsTimeshift && (
              <>
                <Button
                  variant="player"
                  size="icon"
                  onClick={onPrevious}
                  disabled={!onPrevious}
                >
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button
                  variant="player"
                  size="icon"
                  onClick={onNext}
                  disabled={!onNext}
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
              </>
            )}

            {/* Volume */}
            <div className="flex items-center gap-2 ml-2">
              <Button variant="player" size="icon" onClick={toggleMute}>
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="w-24"
              />
            </div>

            <div className="flex-1" />

            {/* Catch-up browser button */}
            {hasCatchup && onOpenCatchup && (
              <Button 
                variant="player" 
                size="icon" 
                onClick={onOpenCatchup}
                title="Catch-up / Arkiv"
              >
                <History className="w-5 h-5" />
              </Button>
            )}

            {/* PiP button */}
            {isPipSupported && (
              <Button 
                variant="player" 
                size="icon" 
                onClick={togglePip}
                title={isPipActive ? 'Avsluta bild-i-bild' : 'Bild-i-bild'}
                className={cn(isPipActive && 'text-primary')}
              >
                <PictureInPicture2 className="w-5 h-5" />
              </Button>
            )}

            {/* Multi-screen button */}
            <Button 
              variant="player" 
              size="icon" 
              onClick={() => {
                if (onOpenMultiScreen) {
                  onOpenMultiScreen();
                } else {
                  enterMultiScreen();
                }
              }}
              title="Multi-screen"
              className={cn(isMultiScreenMode && 'text-primary')}
            >
              <Grid2X2 className="w-5 h-5" />
            </Button>

            {/* Settings */}
            <Button variant="player" size="icon">
              <Settings className="w-5 h-5" />
            </Button>

            {/* Fullscreen */}
            <Button variant="player" size="icon" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
