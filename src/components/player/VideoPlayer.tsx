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
  Shield,
  Cast,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Channel } from "@/types/iptv";
import { useCatchup } from "@/services/CatchupService";
import { usePip } from "@/services/PipService";
import { useMultiScreen } from "@/contexts/MultiScreenContext";
import { QualitySelector, QualityLevel } from "./QualitySelector";
import { PlaybackBlockedScreen } from "./PlaybackBlockedScreen";
import { MkvCompatibilityScreen, MkvAction } from "./MkvCompatibilityScreen";
import { CastModeBanner, CastControls, CastDevicePicker, CastButton } from "./CastModeUI";
import { localStore } from "@/data/stores/localStore";
import { toast } from "sonner";
import {
  performPreflightAsync,
  PreflightResult,
  PlaybackStrategy,
  Platform,
  buildProxyUrl,
  isHlsUrl,
  detectPlatform,
} from "@/player/PlaybackPreflight";
import {
  performMediaPreflightSync,
  MkvPreflightResult,
  isUnsupportedContainer,
  detectContainerFromUrl,
} from "@/player/MediaPreflight";
import { getCastController, CastState, CastDevice } from "@/player/CastController";
import { performCastPreflight, canCastUrl } from "@/player/CastPreflight";
import { useCastIntegration } from "@/hooks/useCastIntegration";

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
  
  // Playback blocked state for smart fallback UI
  const [showBlockedScreen, setShowBlockedScreen] = useState(false);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  
  // MKV/Unsupported format state
  const [mkvPreflight, setMkvPreflight] = useState<MkvPreflightResult | null>(null);
  const [showMkvScreen, setShowMkvScreen] = useState(false);
  const [mkvRetrying, setMkvRetrying] = useState(false);
  const [isUsingProxy, setIsUsingProxy] = useState(false);
  
  // Quality levels state
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQualityLevel, setCurrentQualityLevel] = useState(-1); // -1 = Auto
  const [isAutoQuality, setIsAutoQuality] = useState(true);
  
  // PiP hook
  const { isActive: isPipActive, isSupported: isPipSupported, togglePip } = usePip(videoRef);
  
  // Multi-screen hook
  const { isMultiScreenMode, enterMultiScreen } = useMultiScreen();
  
  // Cast integration
  const castResumePositionRef = useRef<number>(0);
  const {
    castState,
    devices: castDevices,
    isCasting,
    isChromecastAvailable,
    isAirPlayAvailable,
    showDevicePicker,
    openDevicePicker,
    closeDevicePicker,
    startCast,
    stopCast,
    selectDevice: selectCastDevice,
    play: castPlay,
    pause: castPause,
    togglePlay: castTogglePlay,
    seek: castSeek,
    setVolume: castSetVolume,
    toggleMute: castToggleMute,
  } = useCastIntegration({
    onCastStart: () => {
      // Stop local playback when cast starts
      if (videoRef.current) {
        castResumePositionRef.current = videoRef.current.currentTime;
        videoRef.current.pause();
        destroyHls();
      }
    },
    onCastEnd: (resumePosition) => {
      // Resume local playback when cast ends
      castResumePositionRef.current = resumePosition;
      // Trigger re-render to restart playback
      setError(null);
      setIsBuffering(true);
    },
  });
  
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
    
    const video = videoRef.current;
    if (!video) return;
    
    // Always clean up previous playback first
    destroyHls();
    video.pause();
    video.removeAttribute('src');
    video.load();
    
    if (!streamUrl) {
      setError(null);
      setIsBuffering(false);
      return;
    }
    
    let originalUrl = streamUrl;
    let isCancelled = false;
    
    // Reset all states for new playback
    setError(null);
    setIsBuffering(true);
    setShowBlockedScreen(false);
    setShowMkvScreen(false);
    setMkvPreflight(null);
    setMkvRetrying(false);
    setIsUsingProxy(false);
    setQualityLevels([]);
    setIsPlaying(false);
    setPreflightResult(null);
    
    console.log(`[VideoPlayer] === NEW PLAYBACK REQUEST ===`);
    console.log(`[VideoPlayer] URL: ${originalUrl.substring(0, 100)}...`);
    
    // For Xtream-style URLs - detect pattern: /type/user/pass/id or /type/user/pass/id.ext
    // Examples: /live/user/pass/123, /series/user/pass/456.mkv, /movie/user/pass/789.mp4
    const isXtreamStyle = /\/(live|movie|series)\/[^/]+\/[^/]+\/\d+(\.\w+)?$/.test(originalUrl) || 
                          /\/[^/]+\/[^/]+\/\d+(\.\w+)?$/.test(originalUrl);
    
    console.log(`[VideoPlayer] Xtream style detected: ${isXtreamStyle}, URL pattern check for: ${originalUrl.substring(0, 80)}`);
    
    if (isXtreamStyle && !originalUrl.toLowerCase().includes('.')) {
      originalUrl = originalUrl + '.m3u8';
      console.log('[VideoPlayer] Converted to HLS format:', originalUrl);
    }
    
    const isHls = isHlsUrl(originalUrl);
    const isVod = !!directStreamUrl;
    
    console.log(`[VideoPlayer] Starting playback - isHls: ${isHls}, isVod: ${isVod}`);
    
    // Async preflight and playback setup
    const startPlayback = async () => {
      if (isCancelled) return;
      
      // Perform async preflight check with HTTPS upgrade attempt
      const castController = getCastController();
      const preflight = await performPreflightAsync({
        streamUrl: originalUrl,
        sourceType: isVod ? 'vod' : 'live',
        hasChromecast: castController.isChromecastAvailable(),
        hasAirPlay: castController.isAirPlayAvailable(),
      });
      
      if (isCancelled) return;
      
      setPreflightResult(preflight);
      
      // Log diagnostic code
      console.log(`[VideoPlayer] Preflight result: ${preflight.diagnosticCode}, strategy: ${preflight.recommendedStrategy}, mixedContent: ${preflight.isMixedContentBlocked}`);
      
      // Determine which URL to use based on preflight result
      let playbackUrl = originalUrl;
      let usingProxy = false;
      
      // Simple approach: just try direct playback first
      // Only use special handling if preflight explicitly says we need it
      if (preflight.recommendedStrategy === 'upgraded_https' && preflight.resolvedUrl) {
        playbackUrl = preflight.resolvedUrl;
        console.log('[VideoPlayer] Using HTTPS-upgraded URL');
      }
      
      console.log(`[VideoPlayer] Playback mode: ${isVod ? 'VOD' : 'Live'}, isHls: ${isHls}, url: ${playbackUrl.substring(0, 50)}...`);
      
      setIsUsingProxy(usingProxy);
      
      // Load custom proxy URL from settings if user has one configured
      try {
        const settings = await localStore.getSettings();
        const customProxyUrl = settings.playerSettings?.customProxyUrl;
        const savedStrategy = settings.playerSettings?.httpStreamStrategy;
        
        // If user has a saved strategy preference and we're dealing with mixed content
        if (savedStrategy && preflight.isMixedContentBlocked && savedStrategy !== 'auto') {
          if (savedStrategy === 'proxy_https' && customProxyUrl) {
            const customProxy = buildProxyUrl(originalUrl, customProxyUrl);
            if (customProxy) {
              playbackUrl = customProxy;
              setIsUsingProxy(true);
            }
          } else if (savedStrategy === 'cast_chromecast') {
            // Let user handle casting
            setIsBuffering(false);
            setShowBlockedScreen(true);
            return;
          } else if (savedStrategy === 'external_player') {
            // Let user handle external player
            setIsBuffering(false);
            setShowBlockedScreen(true);
            return;
          }
        }
      } catch (e) {
        console.warn('[VideoPlayer] Could not load settings:', e);
      }
      
      if (isCancelled) return;
      
      // Check if this is an unsupported format (MKV, AVI, WMV, FLV)
      const isUnsupportedFormatFlag = isUnsupportedContainer(originalUrl);
      
      // Build list of URLs to try (with fallbacks)
      const urlsToTry: string[] = [];
      
      if (isUnsupportedFormatFlag && isXtreamStyle) {
        // For unsupported formats on Xtream servers, try HLS version first
        // Xtream servers typically support HLS for VOD content
        // Replace container extension with .m3u8
        const hlsUrl = originalUrl.replace(/\.(mkv|avi|wmv|flv)(\?.*)?$/i, '.m3u8$2');
        if (hlsUrl !== originalUrl) {
          urlsToTry.push(hlsUrl);
          console.log('[VideoPlayer] Trying HLS version for unsupported format:', hlsUrl.substring(0, 80));
        }
        
        // Also try adding /hls/ path for some Xtream implementations
        const hlsPathUrl = originalUrl.replace(/\/(movie|series)\//, '/hls/$1/').replace(/\.(mkv|avi|wmv|flv)(\?.*)?$/i, '.m3u8$2');
        if (hlsPathUrl !== originalUrl && hlsPathUrl !== hlsUrl) {
          urlsToTry.push(hlsPathUrl);
        }
        
        // Add original as last fallback (won't work but shows proper error)
        urlsToTry.push(playbackUrl);
      } else {
        // For supported formats or non-Xtream, try direct URL first
        urlsToTry.push(playbackUrl);
      }
      
      // Add original without .m3u8 as fallback for Xtream URLs
      if (isXtreamStyle && originalUrl.endsWith('.m3u8')) {
        const withoutExt = originalUrl.replace('.m3u8', '');
        if (usingProxy) {
          const fallbackProxy = buildProxyUrl(withoutExt);
          if (fallbackProxy) urlsToTry.push(fallbackProxy);
        } else {
          urlsToTry.push(withoutExt);
        }
      }
      
      let currentUrlIndex = 0;
      
      const showFinalError = () => {
        // Check if this is an unsupported format issue (MKV, AVI, etc.)
        if (isUnsupportedFormatFlag) {
          // Perform MKV preflight to determine best strategy
          const mediaPreflight = performMediaPreflightSync(originalUrl);
          
          setIsBuffering(false);
          setMkvPreflight(mediaPreflight);
          setShowMkvScreen(true);
          console.log(`[VideoPlayer] Showing MKV compatibility screen for ${mediaPreflight.mediaInfo.container}`);
          return;
        }
        
        // Show blocked screen with alternatives if mixed content is the issue
        if (preflight.isMixedContentBlocked) {
          setIsBuffering(false);
          setShowBlockedScreen(true);
          return;
        }
        setError("Unable to play this stream. The server may be unavailable.");
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
        console.log('[VideoPlayer] Trying direct playback:', url.substring(0, 80) + '...');
        
        // Remove any existing listeners first
        const handleCanPlay = () => {
          console.log('[VideoPlayer] Direct playback ready');
          video.removeEventListener('error', handleError);
          setIsBuffering(false);
          video.play().catch((e) => {
            console.warn('[VideoPlayer] Direct autoplay blocked:', e);
          });
        };
        
        const handleError = (e: Event) => {
          video.removeEventListener('canplay', handleCanPlay);
          const videoError = (e.target as HTMLVideoElement)?.error;
          console.error('[VideoPlayer] Direct playback failed:', videoError?.message || 'Unknown error', videoError?.code);
          onFail();
        };
        
        video.addEventListener('canplay', handleCanPlay, { once: true });
        video.addEventListener('error', handleError, { once: true });
        
        video.src = url;
        video.load();
      };
      
      const tryNextUrl = () => {
        if (isCancelled) return;
        
        if (currentUrlIndex >= urlsToTry.length) {
          showFinalError();
          return;
        }
        
        const url = urlsToTry[currentUrlIndex];
        currentUrlIndex++;
        
        console.log(`[VideoPlayer] Trying URL ${currentUrlIndex}/${urlsToTry.length}:`, url.substring(0, 80) + '...');
        
        // Check if THIS specific URL is HLS (not just the original URL)
        const urlIsHls = url.toLowerCase().includes('.m3u8') || 
                         url.toLowerCase().includes('mpegurl') ||
                         /\/live\/[^/]+\/[^/]+\/\d+(?:\?|$)/.test(url);
        
        if (urlIsHls) {
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
      console.log('[VideoPlayer] Cleanup - cancelling playback');
      isCancelled = true;
      destroyHls();
      // Clean up video element
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [channel?.id, channel?.streamUrl, directStreamUrl, destroyHls]);



  // Handle strategy selection from blocked screen
  const handleStrategySelect = useCallback((strategy: PlaybackStrategy, resolvedUrl?: string) => {
    setShowBlockedScreen(false);
    
    if (strategy === 'proxy_https' && resolvedUrl) {
      // Restart playback with proxy URL
      setIsUsingProxy(true);
      setIsBuffering(true);
      
      const video = videoRef.current;
      if (!video) return;
      
      destroyHls();
      
      // Determine if HLS
      const streamUrl = directStreamUrl || channel?.streamUrl || '';
      const isHls = streamUrl.toLowerCase().includes('.m3u8') || 
                    /\/live\/[^/]+\/[^/]+\/\d+/.test(streamUrl);
      
      if (isHls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
        });
        hlsRef.current = hls;
        
        hls.loadSource(resolvedUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch((e) => {
            console.warn('[VideoPlayer] Proxy autoplay blocked:', e);
            setIsBuffering(false);
          });
        });
        
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error('[VideoPlayer] Proxy HLS error:', data);
            setError("Proxy stream failed. Try another option.");
            setIsBuffering(false);
          }
        });
      } else {
        video.src = resolvedUrl;
        video.load();
        video.play().catch((e) => {
          console.warn('[VideoPlayer] Proxy play failed:', e);
        });
      }
    } else if (strategy === 'cast_chromecast') {
      // Casting is handled by the blocked screen
      toast.success('Casting startat');
    }
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

  // Show blocked screen when mixed content is detected or user wants alternative options
  if (showBlockedScreen) {
    const streamUrl = directStreamUrl || channel?.streamUrl || '';
    const isHttpStream = streamUrl.startsWith('http://');
    const isSecurePage = window.location.protocol === 'https:';
    
    // Create a fallback preflight result if one doesn't exist
    const effectivePreflight: PreflightResult = preflightResult || {
      canPlayDirect: false,
      isMixedContentBlocked: isHttpStream && isSecurePage,
      availableStrategies: ['proxy_https', 'external_player'] as PlaybackStrategy[],
      recommendedStrategy: 'proxy_https' as PlaybackStrategy,
      diagnosticCode: 'INCOMPATIBLE' as const,
      platform: 'web' as const,
      details: {
        isHttpStream,
        isSecurePage,
        streamProtocol: streamUrl.split(':')[0] || 'http',
        pageProtocol: window.location.protocol.replace(':', ''),
        isHls: isHlsUrl(streamUrl),
        httpsUpgradeAttempted: false,
        httpsUpgradeSucceeded: false,
      },
    };
    
    return (
      <div className={cn("bg-player-bg rounded-xl aspect-video", className)}>
        <PlaybackBlockedScreen
          preflight={effectivePreflight}
          context={{
            streamUrl,
            title: vodTitle || channel?.name,
            posterUrl: channel?.logoUrl,
            sourceType: directStreamUrl ? 'vod' : 'live',
          }}
          onStrategySelect={handleStrategySelect}
          onCancel={() => setShowBlockedScreen(false)}
          className="h-full"
        />
      </div>
    );
  }
  
  // Show MKV compatibility screen with platform-specific options
  if (showMkvScreen && mkvPreflight) {
    const handleMkvAction = async (action: MkvAction) => {
      const streamUrl = directStreamUrl || channel?.streamUrl || '';
      
      switch (action) {
        case 'vlc_fallback':
          // TODO: Use VLC engine when native bridge is implemented
          toast.info('VLC-läge är inte tillgängligt i webbversionen');
          break;
          
        case 'external_vlc':
          // Already handled in component
          break;
          
        case 'external_mx':
          // Already handled in component
          break;
          
        case 'copy_url':
          // Already handled in component
          break;
          
        case 'cast':
          setShowMkvScreen(false);
          setShowBlockedScreen(true);
          break;
          
        case 'retry_native':
          setMkvRetrying(true);
          setShowMkvScreen(false);
          setIsBuffering(true);
          // Try direct playback
          if (videoRef.current) {
            videoRef.current.src = streamUrl;
            videoRef.current.load();
            try {
              await videoRef.current.play();
            } catch (e) {
              console.error('[VideoPlayer] Native retry failed:', e);
              setMkvRetrying(false);
              setShowMkvScreen(true);
              toast.error('Kunde inte spela med standardspelaren');
            }
          }
          break;
      }
    };
    
    const handleRememberChoice = async (choice: 'vlc' | 'native') => {
      const settings = await localStore.getSettings();
      await localStore.saveSettings({
        ...settings,
        playerSettings: {
          ...settings.playerSettings,
          mkvPlayerPreference: choice,
        },
      });
      toast.success(`Sparade inställning: ${choice === 'vlc' ? 'VLC-läge' : 'Standardspelare'}`);
    };
    
    return (
      <div className={cn("bg-player-bg rounded-xl aspect-video", className)}>
        <MkvCompatibilityScreen
          streamUrl={mkvPreflight.mediaInfo.url}
          format={mkvPreflight.mediaInfo.container}
          title={vodTitle || channel?.name}
          platform={mkvPreflight.platform}
          onAction={handleMkvAction}
          onCancel={() => {
            setShowMkvScreen(false);
            navigate(-1);
          }}
          onRememberChoice={handleRememberChoice}
          isRetrying={mkvRetrying}
          className="h-full"
        />
      </div>
    );
  }

  if (!channel && !directStreamUrl) {
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

  // If casting, show cast mode UI instead of video
  if (isCasting) {
    const streamUrl = directStreamUrl || channel?.streamUrl || '';
    return (
      <div className={cn("bg-player-bg rounded-xl aspect-video", className)}>
        <CastControls
          castState={castState}
          isPlaying={castState.isPlaying}
          currentTime={castState.currentTime}
          duration={castState.duration}
          volume={volume}
          onPlay={castPlay}
          onPause={castPause}
          onSeek={castSeek}
          onVolumeChange={castSetVolume}
          onStopCast={stopCast}
          title={vodTitle || channel?.name}
          posterUrl={channel?.logoUrl}
          isLive={!directStreamUrl}
          className="h-full"
        />
        
        {/* Device picker modal */}
        <CastDevicePicker
          isOpen={showDevicePicker}
          onClose={closeDevicePicker}
          devices={castDevices}
          onSelectDevice={(deviceId) => {
            selectCastDevice(deviceId, {
              url: streamUrl,
              title: vodTitle || channel?.name || 'StreamVault',
              posterUrl: channel?.logoUrl,
              type: directStreamUrl ? 'vod' : 'live',
            });
          }}
          isSearching={castState.status === 'discovering'}
          error={castState.error}
        />
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
      {/* Cast device picker modal */}
      <CastDevicePicker
        isOpen={showDevicePicker}
        onClose={closeDevicePicker}
        devices={castDevices}
        onSelectDevice={(deviceId) => {
          const streamUrl = directStreamUrl || channel?.streamUrl;
          if (streamUrl) {
            selectCastDevice(deviceId, {
              url: streamUrl,
              title: vodTitle || channel?.name || 'StreamVault',
              posterUrl: channel?.logoUrl,
              type: directStreamUrl ? 'vod' : 'live',
            });
          }
        }}
        isSearching={castState.status === 'discovering'}
        error={castState.error}
      />
      
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
        // Note: onError removed - we handle errors in useEffect with fallback logic
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

      {/* Error Overlay with External Player Options */}
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
                  const streamUrl = directStreamUrl || channel?.streamUrl;
                  if (videoRef.current && streamUrl) {
                    destroyHls();
                    setTimeout(() => {
                      videoRef.current!.src = streamUrl;
                      videoRef.current!.load();
                    }, 100);
                  }
                }}
              >
                Försök igen
              </Button>
              
              {/* Show external player options */}
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const streamUrl = directStreamUrl || channel?.streamUrl;
                  if (streamUrl) {
                    // Show full blocked screen with all options
                    setError(null);
                    setShowBlockedScreen(true);
                  }
                }}
              >
                Visa alternativ
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-2 bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground/80">Kunde inte spela strömmen</p>
              <p>
                Det kan bero på CORS-blockering, HTTP på HTTPS, eller att servern inte svarar.
              </p>
              <p className="text-left">
                <strong>Alternativ:</strong><br/>
                • Spela via proxy (HTTPS)<br/>
                • Öppna i VLC eller annan mediaspelare<br/>
                • Casta till TV
              </p>
            </div>
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
        {/* Top Bar - Channel/VOD Info */}
        <div className="absolute top-0 left-0 right-0 p-4">
          <div className="flex items-center gap-3">
            {channel?.logoUrl && (
              <img
                src={channel.logoUrl}
                alt={channel.name}
                className="w-10 h-10 rounded-lg object-contain bg-muted"
              />
            )}
            <div>
              <h3 className="font-semibold">{vodTitle || channel?.name || 'Media'}</h3>
              <p className="text-sm text-muted-foreground">
                {channel?.group || (directStreamUrl ? 'VOD' : '')}
                {isUsingProxy && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-primary">
                    <Shield className="w-3 h-3" />
                    Proxy
                  </span>
                )}
              </p>
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

            {/* Cast button */}
            {(isChromecastAvailable || isAirPlayAvailable) && (
              <CastButton
                castState={castState}
                onClick={() => {
                  const streamUrl = directStreamUrl || channel?.streamUrl;
                  if (!streamUrl) return;
                  
                  if (isCasting) {
                    stopCast();
                  } else {
                    // Check if format is castable
                    const preflight = performCastPreflight({ 
                      url: streamUrl, 
                      sourceType: directStreamUrl ? 'vod' : 'live' 
                    });
                    
                    if (!preflight.canCast) {
                      toast.warning('Formatet stöds inte', {
                        description: preflight.warnings[0] || 'Detta format kan inte castas',
                      });
                      return;
                    }
                    
                    startCast({
                      url: streamUrl,
                      title: vodTitle || channel?.name || 'StreamVault',
                      posterUrl: channel?.logoUrl,
                      type: directStreamUrl ? 'vod' : 'live',
                      mimeHint: preflight.mimeType,
                    });
                  }
                }}
              />
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
