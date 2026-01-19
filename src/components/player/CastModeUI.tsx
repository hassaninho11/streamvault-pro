/**
 * CastModeUI - UI components for casting mode (Chromecast/AirPlay)
 */

import { useState } from "react";
import {
  Cast,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  Loader2,
  Subtitles,
  MonitorSpeaker,
  Tv2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { CastState } from "@/player/CastController";

interface CastModeBannerProps {
  castState: CastState;
  onStopCast: () => void;
  className?: string;
}

export function CastModeBanner({ castState, onStopCast, className }: CastModeBannerProps) {
  if (castState.status === 'idle') return null;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30",
      className
    )}>
      {castState.status === 'connecting' ? (
      <>
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm">Connecting to device...</span>
        </>
      ) : (
      <>
          <Cast className="w-4 h-4 text-primary fill-current" />
          <span className="text-sm font-medium">
            Playing on {castState.deviceName || 'Cast Device'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onStopCast}
            className="ml-auto"
          >
            <X className="w-4 h-4 mr-1" />
            Stop
          </Button>
        </>
      )}
    </div>
  );
}

interface CastControlsProps {
  castState: CastState;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onStopCast: () => void;
  title?: string;
  posterUrl?: string;
  isLive?: boolean;
  className?: string;
}

export function CastControls({
  castState,
  isPlaying,
  currentTime,
  duration,
  volume,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onStopCast,
  title,
  posterUrl,
  isLive = false,
  className,
}: CastControlsProps) {
  const [isMuted, setIsMuted] = useState(false);

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      onVolumeChange(100);
    } else {
      onVolumeChange(0);
    }
    setIsMuted(!isMuted);
  };

  if (castState.status !== 'casting') return null;

  return (
    <div className={cn(
      "bg-card/95 backdrop-blur-lg rounded-xl border border-border p-6",
      className
    )}>
      {/* Header with device info */}
      <div className="flex items-center gap-4 mb-6">
        <Cast className="w-6 h-6 text-primary fill-current" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Casting to</p>
          <p className="font-semibold">{castState.deviceName || 'Cast Device'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onStopCast}>
          Stop Casting
        </Button>
      </div>

      {/* Content info */}
      <div className="flex gap-4 mb-6">
        {posterUrl && (
          <img
            src={posterUrl}
            alt={title}
            className="w-24 h-36 rounded-lg object-cover bg-muted"
          />
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{title || 'Now Playing'}</h3>
          {isLive ? (
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <p className="text-sm text-muted-foreground">LIVE</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar - only for VOD */}
      {!isLive && (
        <div className="mb-6">
          <Slider
            value={[currentTime]}
            onValueChange={([val]) => onSeek(val)}
            max={duration || 100}
            step={1}
            className="w-full"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSeek(Math.max(0, currentTime - 10))}
        >
          <SkipBack className="w-5 h-5" />
        </Button>

        <Button
          variant="glow"
          size="lg"
          className="w-14 h-14 rounded-full"
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSeek(Math.min(duration, currentTime + 10))}
        >
          <SkipForward className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2 ml-4">
          <Button variant="ghost" size="icon" onClick={handleMuteToggle}>
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            onValueChange={([val]) => {
              onVolumeChange(val);
              setIsMuted(val === 0);
            }}
            max={100}
            step={1}
            className="w-24"
          />
        </div>
      </div>

      {/* Subtitle info */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Subtitles className="w-4 h-4" />
          <span>Subtitles may be limited on casting devices</span>
        </div>
      </div>
    </div>
  );
}

interface CastDevicePickerProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Array<{ id: string; name: string; type: 'chromecast' | 'airplay' }>;
  onSelectDevice: (deviceId: string) => void;
  isSearching: boolean;
  error?: string;
}

export function CastDevicePicker({
  isOpen,
  onClose,
  devices,
  onSelectDevice,
  isSearching,
  error,
}: CastDevicePickerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Cast to Device</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {isSearching ? (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Searching for devices...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Try Again
            </Button>
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-8">
            <MonitorSpeaker className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No devices found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure your device is on the same network
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <button
                key={device.id}
                onClick={() => onSelectDevice(device.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg",
                  "bg-muted/50 hover:bg-muted transition-colors",
                  "text-left"
                )}
              >
              {device.type === 'chromecast' ? (
                  <Cast className="w-5 h-5 text-primary" />
                ) : device.type === 'airplay' ? (
                  <Tv2 className="w-5 h-5 text-primary" />
                ) : (
                  <Cast className="w-5 h-5 text-primary" />
                )}
                <span className="font-medium">{device.name}</span>
                <span className="text-xs text-muted-foreground ml-auto capitalize">
                  {device.type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * CastButton - Button to open cast device picker
 */
interface CastButtonProps {
  castState: CastState;
  onClick: () => void;
  className?: string;
}

export function CastButton({ castState, onClick, className }: CastButtonProps) {
  const isCasting = castState.status === 'casting';
  const isConnecting = castState.status === 'connecting';

  return (
    <Button
      variant="player"
      size="icon"
      onClick={onClick}
      className={cn(
        isCasting && "text-primary",
        className
      )}
      title={isCasting ? 'Stop casting' : 'Cast to device'}
    >
      {isConnecting ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isCasting ? (
        <Cast className="w-5 h-5 fill-current" />
      ) : (
        <Cast className="w-5 h-5" />
      )}
    </Button>
  );
}

export default CastControls;
