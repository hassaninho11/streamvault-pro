/**
 * useNativePlayback - Hook for native Android/iOS playback
 * 
 * CRITICAL: This hook provides the ONLY way to play IPTV content on Android.
 * WebView/HTML5 video is NOT supported for IPTV streams.
 * 
 * Features:
 * - ExoPlayer primary engine for Android
 * - VLC fallback for unsupported formats (MKV, AVI, etc.)
 * - Hardware decoding enabled
 * - Long-running live stream support
 * - Chromecast casting support
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { MediaSource, PlayerState, PlayerSettings } from '@/player/types';
import { 
  AndroidPlaybackController, 
  getAndroidPlaybackController,
  isAndroidPlaybackAvailable,
  resetAndroidPlaybackController,
} from '@/player/AndroidPlaybackController';
import { isNativePlatform, getPlatform } from '@/player/NativePlaybackPlugin';

export interface NativePlaybackOptions {
  /** Called when player state changes */
  onStateChange?: (state: PlayerState) => void;
  /** Called when playback engine changes (exo -> vlc) */
  onEngineChange?: (engineId: string, reason: 'initial' | 'fallback' | 'user') => void;
  /** Called on playback error */
  onError?: (error: { code: string; message: string; recoverable: boolean }) => void;
}

export interface NativePlaybackReturn {
  /** Whether native playback is available on this platform */
  isAvailable: boolean;
  /** Current platform */
  platform: 'android' | 'ios' | 'web';
  /** Current playback state */
  state: PlayerState;
  /** Current engine (exo-bridge, vlc-bridge, none) */
  currentEngine: string;
  /** Load and play a media source */
  load: (source: MediaSource) => Promise<void>;
  /** Resume playback */
  play: () => Promise<void>;
  /** Pause playback */
  pause: () => Promise<void>;
  /** Stop playback and release resources */
  stop: () => Promise<void>;
  /** Seek to position in seconds */
  seek: (seconds: number) => Promise<void>;
  /** Set volume (0-1) */
  setVolume: (volume: number) => void;
  /** Toggle mute */
  toggleMute: () => void;
  /** Switch to VLC engine manually */
  switchToVlc: () => Promise<void>;
  /** Switch back to ExoPlayer */
  switchToExoPlayer: () => Promise<void>;
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

/**
 * Hook for native Android/iOS playback using ExoPlayer/AVPlayer
 * 
 * CRITICAL: On Android, this MUST be used for all IPTV playback.
 * HTML5 video in WebView does NOT work for IPTV streams.
 */
export function useNativePlayback(options: NativePlaybackOptions = {}): NativePlaybackReturn {
  const { onStateChange, onEngineChange, onError } = options;
  
  const controllerRef = useRef<AndroidPlaybackController | null>(null);
  const [state, setState] = useState<PlayerState>(initialState);
  const [currentEngine, setCurrentEngine] = useState<string>('none');
  const [isAvailable, setIsAvailable] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'web'>('web');
  
  // Initialize controller on mount
  useEffect(() => {
    const plat = getPlatform();
    setPlatform(plat);
    
    const available = isAndroidPlaybackAvailable();
    setIsAvailable(available);
    
    console.log(`[useNativePlayback] Platform: ${plat}, available: ${available}`);
    
    if (!available) {
      return;
    }
    
    try {
      const controller = getAndroidPlaybackController({
        onStateChange: (newState) => {
          setState(newState);
          onStateChange?.(newState);
        },
        onEngineChange: (engineId, reason) => {
          setCurrentEngine(engineId);
          onEngineChange?.(engineId, reason);
          console.log(`[useNativePlayback] Engine changed to ${engineId} (${reason})`);
        },
        onError: (error) => {
          onError?.(error);
          console.error(`[useNativePlayback] Error: ${error.code} - ${error.message}`);
        },
      });
      
      controllerRef.current = controller;
    } catch (e) {
      console.warn('[useNativePlayback] Failed to get controller:', e);
      setIsAvailable(false);
    }
    
    return () => {
      // Don't destroy singleton on unmount, just remove listeners
      // resetAndroidPlaybackController();
    };
  }, []);
  
  const load = useCallback(async (source: MediaSource) => {
    if (!controllerRef.current) {
      console.error('[useNativePlayback] Controller not available');
      return;
    }
    
    console.log(`[useNativePlayback] Loading: ${source.url.substring(0, 80)}...`);
    await controllerRef.current.load(source);
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
  
  return {
    isAvailable,
    platform,
    state,
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
  };
}

export default useNativePlayback;
