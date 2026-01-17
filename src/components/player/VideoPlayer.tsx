import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  Settings,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Channel } from "@/types/iptv";
import { useCatchup } from "@/services/CatchupService";
import { usePip } from "@/services/PipService";
import { useMultiScreen } from "@/contexts/MultiScreenContext";
import { QualitySelector, QualityLevel } from "./QualitySelector";
import { localStore } from "@/data/stores/localStore";
import { toast } from "sonner";

interface VideoPlayerProps {
  channel: Channel | null;
  /** Direct stream URL for VOD playback */
  directStreamUrl?: string;
  /** Title for VOD content */
  vodTitle?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onOpenCatchup?: () => void;
  onOpenMultiScreen?: () => void;
  className?: string;
}

export function VideoPlayer({ channel, directStreamUrl, vodTitle, onPrevious, onNext, onOpenCatchup, onOpenMultiScreen, className }: VideoPlayerProps) {
  const navigate = useNavigate();
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
  
  // Quality levels state
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQualityLevel, setCurrentQualityLevel] = useState(-1); // -1 = Auto
  const [isAutoQuality, setIsAutoQuality] = useState(true);
  
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
  
  // Handle quality level selection
  const handleQualityChange = useCallback((levelIndex: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    
    if (levelIndex === -1) {
      // Enable auto quality
      hls.currentLevel = -1;
      setIsAutoQuality(true);
      console.log('[VideoPlayer] Quality set to Auto');
    } else {
      // Set specific quality level
      hls.currentLevel = levelIndex;
      setIsAutoQuality(false);
      const level = qualityLevels.find(l => l.index === levelIndex);
      console.log(`[VideoPlayer] Quality set to ${level?.label || levelIndex}`);
    }
  }, [qualityLevels]);

  // Cleanup HLS on unmount or channel change
  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Support both channel-based and direct URL playback
    const streamUrl = directStreamUrl || channel?.streamUrl;
    
    if (!streamUrl || !videoRef.current) return;
    
    const video = videoRef.current;
    let originalUrl = streamUrl;
    
    if (!originalUrl) {
      setError("No stream URL available");
      return;
    }
    
    setError(null);
    setIsBuffering(true);
    destroyHls();
    setQualityLevels([]);
    
    // Check if this is an HTTP stream on an HTTPS page
    const isHttpStream = originalUrl.startsWith('http://');
    const isSecurePage = window.location.protocol === 'https:';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    // Detect stream type
    const lowerUrl = originalUrl.toLowerCase();
    
    // For Xtream-style URLs without extension, try adding .m3u8 for HLS
    const isXtreamStyle = /\/live\/[^/]+\/[^/]+\/\d+$/.test(originalUrl) || 
                          /\/[^/]+\/[^/]+\/\d+$/.test(originalUrl);
    
    if (isXtreamStyle && !lowerUrl.includes('.')) {
      originalUrl = originalUrl + '.m3u8';
      console.log('[VideoPlayer] Converted to HLS format:', originalUrl);
    }
    
    const isHls = lowerUrl.includes('.m3u8') || 
                  lowerUrl.includes('m3u8') || 
                  isXtreamStyle;
    
    const showFinalError = () => {
      if (isHttpStream && isSecurePage) {
        setError("Cannot play HTTP streams on this secure page. Your IPTV provider may also restrict playback to your home IP address. Try a different channel or contact your provider.");
      } else {
        setError("Unable to play this stream. The server may be unavailable.");
      }
      setIsBuffering(false);
    };
    
    const tryHlsPlayback = (url: string, onFail: () => void) => {
      if (!Hls.isSupported()) {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
          
          const handleError = () => {
            console.error('[VideoPlayer] Native HLS failed');
            onFail();
          };
          
          video.addEventListener('error', handleError, { once: true });
          
          video.play().catch((e) => {
            console.error('[VideoPlayer] Native HLS play failed:', e);
            video.removeEventListener('error', handleError);
            onFail();
          });
          return;
        }
        onFail();
        return;
      }
      
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        fragLoadingTimeOut: 15000,
        manifestLoadingTimeOut: 10000,
        levelLoadingTimeOut: 15000,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = hls;
      
      let manifestLoaded = false;
      
      hls.loadSource(url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        manifestLoaded = true;
        console.log('[VideoPlayer] HLS manifest parsed, levels:', data.levels?.length);
        
        if (data.levels && data.levels.length > 0) {
          const levels: QualityLevel[] = data.levels.map((level: { height: number; width: number; bitrate: number }, index: number) => ({
            index,
            height: level.height || 0,
            width: level.width || 0,
            bitrate: level.bitrate || 0,
            label: level.height ? `${level.height}p` : `Kvalitet ${index + 1}`,
          }));
          setQualityLevels(levels);
        }
        
        setIsAutoQuality(true);
        setCurrentQualityLevel(-1);
        
        video.play().catch((e) => {
          console.warn('[VideoPlayer] Autoplay blocked:', e);
          setIsBuffering(false);
        });
      });
      
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentQualityLevel(data.level);
      });
      
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[VideoPlayer] HLS error:', data.type, data.details);
        
        if (data.fatal) {
          destroyHls();
          
          if (!manifestLoaded) {
            onFail();
          } else {
            setError("Stream playback failed");
            setIsBuffering(false);
          }
        }
      });
    };
    
    const tryDirectPlayback = (url: string, onFail: () => void) => {
      console.log('[VideoPlayer] Trying direct playback');
      video.src = url;
      
      const handleCanPlay = () => {
        console.log('[VideoPlayer] Direct playback ready');
        setIsBuffering(false);
        video.play().catch((e) => {
          console.warn('[VideoPlayer] Direct autoplay blocked:', e);
        });
      };
      
      const handleError = () => {
        console.error('[VideoPlayer] Direct playback failed');
        onFail();
      };
      
      video.addEventListener('canplay', handleCanPlay, { once: true });
      video.addEventListener('error', handleError, { once: true });
      
      video.load();
    };
    
    // Async function to load settings and start playback
    const startPlayback = async () => {
      // Load custom proxy URL from settings
      let customProxyUrl: string | undefined;
      try {
        const settings = await localStore.getSettings();
        customProxyUrl = settings.playerSettings?.customProxyUrl;
        if (customProxyUrl) {
          console.log('[VideoPlayer] Using custom proxy URL:', customProxyUrl);
        }
      } catch (e) {
        console.warn('[VideoPlayer] Could not load settings:', e);
      }
      
      // Helper to build proxy URL
      const buildProxyUrl = (streamUrl: string): string | null => {
        if (customProxyUrl) {
          if (customProxyUrl.includes('?') || customProxyUrl.endsWith('=')) {
            return `${customProxyUrl}${encodeURIComponent(streamUrl)}`;
          }
          return `${customProxyUrl}?url=${encodeURIComponent(streamUrl)}`;
        }
        if (supabaseUrl) {
          return `${supabaseUrl}/functions/v1/stream-proxy?url=${encodeURIComponent(streamUrl)}`;
        }
        return null;
      };
      
      // Build all possible URLs to try
      const urlsToTry: string[] = [];
      
      if (isHttpStream && isSecurePage) {
        const proxyUrl = buildProxyUrl(originalUrl);
        if (proxyUrl) {
          urlsToTry.push(proxyUrl);
          
          if (isXtreamStyle && originalUrl.endsWith('.m3u8')) {
            const withoutExt = originalUrl.replace('.m3u8', '');
            const proxyUrlWithoutExt = buildProxyUrl(withoutExt);
            if (proxyUrlWithoutExt) {
              urlsToTry.push(proxyUrlWithoutExt);
            }
          }
        }
      } else {
        urlsToTry.push(originalUrl);
        
        if (isXtreamStyle && originalUrl.endsWith('.m3u8')) {
          urlsToTry.push(originalUrl.replace('.m3u8', ''));
        }
      }
      
      let currentUrlIndex = 0;
      
      const tryNextUrl = () => {
        if (currentUrlIndex >= urlsToTry.length) {
          showFinalError();
          return;
        }
        
        const url = urlsToTry[currentUrlIndex];
        currentUrlIndex++;
        
        console.log(`[VideoPlayer] Trying URL ${currentUrlIndex}/${urlsToTry.length}:`, url.substring(0, 80) + '...');
        
        if (isHls) {
          tryHlsPlayback(url, tryNextUrl);
        } else {
          tryDirectPlayback(url, tryNextUrl);
        }
      };
      
      if (urlsToTry.length === 0) {
        showFinalError();
      } else {
        tryNextUrl();
      }
    };
    
    // Start playback
    startPlayback();
    
    return () => {
      destroyHls();
    };
  }, [channel, directStreamUrl, destroyHls]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if input element is focused
      const activeEl = document.activeElement;
      const isInputFocused = activeEl?.tagName === 'INPUT' || 
                             activeEl?.tagName === 'TEXTAREA' || 
                             activeEl?.getAttribute('contenteditable') === 'true';
      
      if (isInputFocused) return;
      
      switch (e.key) {
        case ' ':
        case 'k': // YouTube-style
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => {
            const newVol = Math.min(100, prev + 10);
            if (videoRef.current) {
              videoRef.current.volume = newVol / 100;
              setIsMuted(newVol === 0);
            }
            return newVol;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => {
            const newVol = Math.max(0, prev - 10);
            if (videoRef.current) {
              videoRef.current.volume = newVol / 100;
              setIsMuted(newVol === 0);
            }
            return newVol;
          });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (catchupSource?.supportsTimeshift) {
            seekBack(10);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (catchupSource?.supportsTimeshift) {
            seekForward(10);
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'Escape':
          if (isFullscreen) {
            e.preventDefault();
            document.exitFullscreen();
            setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, catchupSource?.supportsTimeshift, seekBack, seekForward, togglePlay, toggleMute, toggleFullscreen]);
  
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
          <div className="text-center max-w-lg px-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setIsBuffering(true);
                  if (videoRef.current && channel?.streamUrl) {
                    destroyHls();
                    setTimeout(() => {
                      if (channel) {
                        videoRef.current!.src = channel.streamUrl;
                        videoRef.current!.load();
                      }
                    }, 100);
                  }
                }}
              >
                Retry
              </Button>
              
              {channel?.streamUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(channel.streamUrl).then(() => {
                      toast.success('Stream URL copied! Open in VLC or your preferred media player.');
                    });
                  }}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy URL for VLC
                </Button>
              )}
              
              {channel?.streamUrl.startsWith('http://') && window.location.protocol === 'https:' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/settings')}
                >
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  Configure Proxy
                </Button>
              )}
            </div>
            
            {channel?.streamUrl.startsWith('http://') && window.location.protocol === 'https:' && (
              <div className="text-xs text-muted-foreground space-y-2 bg-muted/30 rounded-lg p-3">
                <p className="font-medium text-foreground/80">Why can't I watch?</p>
                <p>
                  Your browser blocks HTTP streams on secure (HTTPS) pages for security reasons.
                </p>
                <p className="text-left">
                  <strong>Solutions:</strong><br/>
                  • Copy the URL and open it in VLC, Kodi, or another media player<br/>
                  • Configure a custom CORS proxy in Settings → Media Player<br/>
                  • Some IPTV providers also block streams from different IP addresses
                </p>
              </div>
            )}
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

            {/* Quality Selector */}
            <QualitySelector
              levels={qualityLevels}
              currentLevel={currentQualityLevel}
              onSelectLevel={handleQualityChange}
              isAuto={isAutoQuality}
              autoLabel="Auto"
            />

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
