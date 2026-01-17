import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Channel } from "@/types/iptv";

interface VideoPlayerProps {
  channel: Channel | null;
  onPrevious?: () => void;
  onNext?: () => void;
  className?: string;
}

export function VideoPlayer({ channel, onPrevious, onNext, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (channel && videoRef.current) {
      setError(null);
      setIsBuffering(true);
      // In a real app, we'd use HLS.js here for .m3u8 streams
      videoRef.current.src = channel.streamUrl;
      videoRef.current.play().catch(() => {
        setError("Failed to play stream");
        setIsBuffering(false);
      });
    }
  }, [channel]);

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
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <Button variant="player" size="icon" onClick={togglePlay}>
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </Button>

            {/* Previous/Next */}
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

            {/* Volume */}
            <div className="flex items-center gap-2">
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
