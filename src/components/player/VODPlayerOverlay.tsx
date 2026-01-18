/**
 * VODPlayerOverlay - Rich player controls for VOD content
 * Includes: play/pause, seek, speed, volume, tracks panel, skip intro, up next
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Subtitles,
  ChevronLeft,
  ChevronRight,
  List,
  Lock,
  Unlock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { PlayerState, SubtitleTrack, AudioTrack } from '@/player/types';
import { VODPlayerController, VODSource } from '@/player/VODPlayerController';
import { Episode, IntroMarker } from '@/types/vod';
import { useTVMode } from '@/contexts/TVModeContext';
import { TracksPanel } from './TracksPanel';
import { PlaybackSpeedSelector } from './PlaybackSpeedSelector';
import { UpNextOverlay } from './UpNextOverlay';
import { SkipButton } from './SkipButton';

interface VODPlayerOverlayProps {
  controller: VODPlayerController;
  state: PlayerState;
  source: VODSource | null;
  isFullscreen: boolean;
  isLocked: boolean;
  onToggleFullscreen: () => void;
  onToggleLock: () => void;
  onBack: () => void;
  onShowEpisodeList?: () => void;
  onPlayNext?: (episode: Episode) => void;
  className?: string;
}

export function VODPlayerOverlay({
  controller,
  state,
  source,
  isFullscreen,
  isLocked,
  onToggleFullscreen,
  onToggleLock,
  onBack,
  onShowEpisodeList,
  onPlayNext,
  className,
}: VODPlayerOverlayProps) {
  const { isTVMode } = useTVMode();
  const [showControls, setShowControls] = useState(true);
  const [showTracksPanel, setShowTracksPanel] = useState(false);
  const [showSpeedSelector, setShowSpeedSelector] = useState(false);
  const [showUpNext, setShowUpNext] = useState(false);
  const [skipMarker, setSkipMarker] = useState<IntroMarker | null>(null);
  const [nextEpisode, setNextEpisode] = useState<Episode | null>(null);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Format time display
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setShowControls(true);
    
    if (state.status === 'playing' && !showTracksPanel && !showSpeedSelector) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 4000);
    }
  }, [state.status, showTracksPanel, showSpeedSelector]);
  
  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimeout]);
  
  // Locked mode interaction
  const handleLockedInteraction = useCallback(() => {
    if (isLocked) {
      // Long press to unlock - handled by parent
      return;
    }
    resetControlsTimeout();
  }, [isLocked, resetControlsTimeout]);
  
  // Handle seek
  const handleSeek = useCallback((value: number[]) => {
    controller.seek(value[0]);
  }, [controller]);
  
  // Handle volume
  const handleVolumeChange = useCallback((value: number[]) => {
    controller.setVolume(value[0] / 100);
  }, [controller]);
  
  // Calculate progress percentage
  const progressPercent = state.duration > 0 
    ? (state.currentTime / state.duration) * 100 
    : 0;
  
  // Calculate remaining time
  const remainingTime = state.duration - state.currentTime;
  
  // Render locked mode
  if (isLocked) {
    return (
      <div 
        className="absolute inset-0 flex items-center justify-center"
        onClick={handleLockedInteraction}
      >
        <div className={cn(
          "px-6 py-3 rounded-full bg-background/60 backdrop-blur-sm",
          "flex items-center gap-2 text-muted-foreground"
        )}>
          <Lock className="w-5 h-5" />
          <span className="text-sm">Låst – håll nere för att låsa upp</span>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className={cn(
        "absolute inset-0 flex flex-col justify-between transition-opacity",
        showControls ? "opacity-100" : "opacity-0 pointer-events-none",
        className
      )}
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-white hover:bg-white/20"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        
        <div className="flex-1 text-center px-4 truncate">
          <h2 className={cn(
            "font-medium text-white",
            isTVMode ? "text-2xl" : "text-lg"
          )}>
            {source?.title || 'Laddar...'}
          </h2>
          {source?.vodType === 'episode' && source.seasonNumber && source.episodeNumber && (
            <p className="text-white/70 text-sm">
              S{source.seasonNumber}:E{source.episodeNumber}
            </p>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleLock}
          className="text-white hover:bg-white/20"
        >
          <Lock className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Skip intro/recap button */}
      {skipMarker && (
        <SkipButton
          type={skipMarker.type as 'intro' | 'recap'}
          onSkip={() => {
            controller.skipIntroRecap(skipMarker);
            setSkipMarker(null);
          }}
        />
      )}
      
      {/* Center play/pause */}
      <div className="flex-1 flex items-center justify-center gap-8">
        {/* 10s back */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => controller.seekRelative(-10)}
          className={cn(
            "text-white hover:bg-white/20 rounded-full",
            isTVMode ? "w-16 h-16" : "w-12 h-12"
          )}
        >
          <SkipBack className={isTVMode ? "w-8 h-8" : "w-6 h-6"} />
        </Button>
        
        {/* Play/Pause */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => controller.togglePlay()}
          className={cn(
            "text-white hover:bg-white/20 rounded-full",
            isTVMode ? "w-24 h-24" : "w-16 h-16"
          )}
        >
          {state.status === 'playing' ? (
            <Pause className={isTVMode ? "w-12 h-12" : "w-8 h-8"} fill="white" />
          ) : (
            <Play className={isTVMode ? "w-12 h-12" : "w-8 h-8"} fill="white" />
          )}
        </Button>
        
        {/* 30s forward */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => controller.seekRelative(30)}
          className={cn(
            "text-white hover:bg-white/20 rounded-full",
            isTVMode ? "w-16 h-16" : "w-12 h-12"
          )}
        >
          <SkipForward className={isTVMode ? "w-8 h-8" : "w-6 h-6"} />
        </Button>
      </div>
      
      {/* Bottom controls */}
      <div className="p-4 bg-gradient-to-t from-black/60 to-transparent space-y-3">
        {/* Progress bar */}
        <div className="flex items-center gap-3 text-white text-sm">
          <span className="min-w-[50px] text-right">
            {formatTime(state.currentTime)}
          </span>
          
          <Slider
            value={[state.currentTime]}
            max={state.duration || 100}
            step={1}
            onValueChange={handleSeek}
            className="flex-1"
          />
          
          <span className="min-w-[50px]">
            -{formatTime(remainingTime)}
          </span>
        </div>
        
        {/* Control buttons */}
        <div className="flex items-center justify-between">
          {/* Left side */}
          <div className="flex items-center gap-2">
            {/* Volume */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => controller.setMuted(!state.isMuted)}
              className="text-white hover:bg-white/20"
            >
              {state.isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>
            
            <div className="w-24 hidden sm:block">
              <Slider
                value={[state.isMuted ? 0 : state.volume * 100]}
                max={100}
                step={1}
                onValueChange={handleVolumeChange}
              />
            </div>
          </div>
          
          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Episode list */}
            {source?.vodType === 'episode' && onShowEpisodeList && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onShowEpisodeList}
                className="text-white hover:bg-white/20"
              >
                <List className="w-5 h-5" />
              </Button>
            )}
            
            {/* Subtitles/Audio */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTracksPanel(true)}
              className="text-white hover:bg-white/20"
            >
              <Subtitles className="w-5 h-5" />
            </Button>
            
            {/* Playback speed */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSpeedSelector(true)}
              className="text-white hover:bg-white/20"
            >
              <span className="text-xs font-medium">{state.playbackRate}x</span>
            </Button>
            
            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFullscreen}
              className="text-white hover:bg-white/20"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Tracks Panel */}
      {showTracksPanel && (
        <TracksPanel
          subtitles={controller.listSubtitles()}
          audioTracks={controller.listAudioTracks()}
          currentSubtitleId={state.currentSubtitleId}
          currentAudioId={state.currentAudioId}
          onSelectSubtitle={(id) => {
            controller.setSubtitle(id);
            setShowTracksPanel(false);
          }}
          onSelectAudio={(id) => {
            controller.setAudioTrack(id);
            setShowTracksPanel(false);
          }}
          onClose={() => setShowTracksPanel(false)}
        />
      )}
      
      {/* Speed Selector */}
      {showSpeedSelector && (
        <PlaybackSpeedSelector
          currentSpeed={state.playbackRate}
          onSelectSpeed={(speed) => {
            controller.setPlaybackRate(speed);
            setShowSpeedSelector(false);
          }}
          onClose={() => setShowSpeedSelector(false)}
        />
      )}
      
      {/* Up Next Overlay */}
      {showUpNext && nextEpisode && onPlayNext && (
        <UpNextOverlay
          episode={nextEpisode}
          countdown={controller.getSettings().upNextCountdown}
          onPlayNext={() => onPlayNext(nextEpisode)}
          onCancel={() => setShowUpNext(false)}
          onShowEpisodeList={onShowEpisodeList}
        />
      )}
    </div>
  );
}
