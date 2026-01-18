/**
 * useAndroidPlayer - React hook for Android native playback
 * Provides easy integration with AndroidPlaybackController
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PlayerState, MediaSource } from '@/player/types';
import { 
  AndroidPlaybackController,
  getAndroidPlaybackController,
  isAndroidPlaybackAvailable,
  resetAndroidPlaybackController,
} from '@/player/AndroidPlaybackController';

interface UseAndroidPlayerOptions {
  onError?: (error: { code: string; message: string }) => void;
  onEngineChange?: (engineId: string) => void;
}

interface UseAndroidPlayerReturn {
  // State
  state: PlayerState;
  isAvailable: boolean;
  currentEngine: string;
  
  // Controls
  load: (source: MediaSource) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  
  // Engine control
  switchToVlc: () => Promise<void>;
  switchToExoPlayer: () => Promise<void>;
  
  // Track management
  listSubtitles: () => Array<{ id: string; label: string; lang?: string }>;
  setSubtitle: (id?: string) => Promise<void>;
  listAudioTracks: () => Array<{ id: string; label: string; lang?: string }>;
  setAudioTrack: (id?: string) => Promise<void>;
}

const initialState: PlayerState = {
  status: 'idle',
  currentTime: 0,
  duration: 0,
  buffered: 0,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  error: null,
};

export function useAndroidPlayer(options: UseAndroidPlayerOptions = {}): UseAndroidPlayerReturn {
  const controllerRef = useRef<AndroidPlaybackController | null>(null);
  const [state, setState] = useState<PlayerState>(initialState);
  const [currentEngine, setCurrentEngine] = useState<string>('none');
  const [isAvailable] = useState(() => isAndroidPlaybackAvailable());
  
  // Initialize controller
  useEffect(() => {
    if (!isAvailable) return;
    
    try {
      const controller = getAndroidPlaybackController({
        onStateChange: setState,
        onEngineChange: (engineId, reason) => {
          setCurrentEngine(engineId);
          options.onEngineChange?.(engineId);
        },
        onError: (error) => {
          options.onError?.(error);
        },
      });
      
      controllerRef.current = controller;
    } catch (e) {
      console.error('[useAndroidPlayer] Failed to initialize:', e);
    }
    
    return () => {
      resetAndroidPlaybackController();
      controllerRef.current = null;
    };
  }, [isAvailable]);
  
  const load = useCallback(async (source: MediaSource) => {
    await controllerRef.current?.load(source);
  }, []);
  
  const play = useCallback(async () => {
    await controllerRef.current?.play();
  }, []);
  
  const pause = useCallback(async () => {
    await controllerRef.current?.pause();
  }, []);
  
  const stop = useCallback(async () => {
    await controllerRef.current?.stop();
  }, []);
  
  const seek = useCallback(async (seconds: number) => {
    await controllerRef.current?.seek(seconds);
  }, []);
  
  const setVolume = useCallback((volume: number) => {
    controllerRef.current?.setVolume(volume);
  }, []);
  
  const toggleMute = useCallback(() => {
    controllerRef.current?.toggleMute();
  }, []);
  
  const switchToVlc = useCallback(async () => {
    await controllerRef.current?.switchToVlc();
  }, []);
  
  const switchToExoPlayer = useCallback(async () => {
    await controllerRef.current?.switchToExoPlayer();
  }, []);
  
  const listSubtitles = useCallback(() => {
    return controllerRef.current?.listSubtitles() || [];
  }, []);
  
  const setSubtitle = useCallback(async (id?: string) => {
    await controllerRef.current?.setSubtitle(id);
  }, []);
  
  const listAudioTracks = useCallback(() => {
    return controllerRef.current?.listAudioTracks() || [];
  }, []);
  
  const setAudioTrack = useCallback(async (id?: string) => {
    await controllerRef.current?.setAudioTrack(id);
  }, []);
  
  return {
    state,
    isAvailable,
    currentEngine,
    load,
    play,
    pause,
    stop,
    seek,
    setVolume,
    toggleMute,
    switchToVlc,
    switchToExoPlayer,
    listSubtitles,
    setSubtitle,
    listAudioTracks,
    setAudioTrack,
  };
}

export default useAndroidPlayer;
