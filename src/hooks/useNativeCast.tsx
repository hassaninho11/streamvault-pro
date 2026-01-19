/**
 * useNativeCast - React hook for native Android Chromecast integration
 * Combines NativeCast Capacitor plugin with React UI state
 * 
 * This hook provides a clean React interface for the native Chromecast
 * implementation using Media3 Cast on Android devices.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PluginListenerHandle } from '@capacitor/core';
import { toast } from 'sonner';
import {
  NativeCast,
  CastState,
  CastStateInfo,
  CastSessionEvent,
  CastPlaybackState,
  CastTimeUpdate,
  LoadMediaOptions,
  isNativeCastAvailable,
  getCastPlatform,
} from '@/player/NativeCastPlugin';

// ============= Types =============

export interface NativeCastState {
  // Availability
  isAvailable: boolean;
  platform: 'android' | 'ios' | 'web';
  
  // Connection
  connectionState: CastState;
  isConnected: boolean;
  isConnecting: boolean;
  deviceName: string | null;
  
  // Playback
  playbackState: 'idle' | 'buffering' | 'playing' | 'paused' | 'ended';
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedPosition: number;
  volume: number;
  isMuted: boolean;
  
  // UI State
  isShowingDialog: boolean;
}

export interface NativeCastMedia {
  url: string;
  title?: string;
  subtitle?: string;
  posterUrl?: string;
  isLive?: boolean;
  startPosition?: number;
}

export interface UseNativeCastOptions {
  onCastStart?: (deviceName: string) => void;
  onCastEnd?: (position: number) => void;
  onError?: (error: string) => void;
  showToasts?: boolean;
}

export interface UseNativeCastReturn {
  // State
  state: NativeCastState;
  
  // Cast control
  showCastDialog: () => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Media loading
  loadMedia: (media: NativeCastMedia) => Promise<boolean>;
  
  // Playback controls
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  seekRelative: (delta: number) => Promise<void>;
  
  // Volume controls
  setVolume: (volume: number) => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  toggleMute: () => Promise<void>;
  
  // Refresh state
  refreshState: () => Promise<void>;
}

// ============= Initial State =============

const initialState: NativeCastState = {
  isAvailable: false,
  platform: 'web',
  connectionState: 'unknown',
  isConnected: false,
  isConnecting: false,
  deviceName: null,
  playbackState: 'idle',
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  bufferedPosition: 0,
  volume: 1,
  isMuted: false,
  isShowingDialog: false,
};

// ============= Hook =============

export function useNativeCast(options?: UseNativeCastOptions): UseNativeCastReturn {
  const [state, setState] = useState<NativeCastState>(initialState);
  const listenersRef = useRef<PluginListenerHandle[]>([]);
  const optionsRef = useRef(options);
  
  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  
  // Show toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (optionsRef.current?.showToasts !== false) {
      if (type === 'success') toast.success(message);
      else if (type === 'error') toast.error(message);
      else toast.info(message);
    }
  }, []);
  
  // Update partial state helper
  const updateState = useCallback((update: Partial<NativeCastState>) => {
    setState(prev => ({ ...prev, ...update }));
  }, []);
  
  // Initialize and check availability
  useEffect(() => {
    const init = async () => {
      const platform = getCastPlatform();
      const available = await isNativeCastAvailable();
      
      console.log('[useNativeCast] Platform:', platform, 'Available:', available);
      
      updateState({
        platform,
        isAvailable: available,
      });
      
      if (available) {
        // Get initial cast state
        try {
          const castState = await NativeCast.getCastState();
          updateState({
            connectionState: castState.state,
            isConnected: castState.isConnected,
            deviceName: castState.deviceName || null,
          });
          
          // If already connected, get playback state
          if (castState.isConnected) {
            const playbackState = await NativeCast.getPlaybackState();
            updateState({
              playbackState: playbackState.state,
              isPlaying: playbackState.state === 'playing',
              currentTime: playbackState.currentTime,
              duration: playbackState.duration,
              volume: playbackState.volume,
              isMuted: playbackState.isMuted,
            });
          }
        } catch (err) {
          console.error('[useNativeCast] Error getting initial state:', err);
        }
        
        // Set up event listeners
        setupListeners();
      }
    };
    
    init();
    
    return () => {
      // Clean up listeners
      listenersRef.current.forEach(listener => listener.remove());
      listenersRef.current = [];
    };
  }, [updateState]);
  
  // Set up native event listeners
  const setupListeners = async () => {
    try {
      // Cast state changes (device availability, connection status)
      const castStateListener = await NativeCast.addListener(
        'castStateChange',
        (event: CastStateInfo) => {
          console.log('[useNativeCast] Cast state change:', event);
          
          updateState({
            connectionState: event.state,
            isConnected: event.isConnected,
            isConnecting: event.state === 'connecting',
            deviceName: event.deviceName || null,
          });
        }
      );
      listenersRef.current.push(castStateListener);
      
      // Session events (started, ended, etc.)
      const sessionListener = await NativeCast.addListener(
        'sessionEvent',
        (event: CastSessionEvent) => {
          console.log('[useNativeCast] Session event:', event);
          
          switch (event.event) {
            case 'starting':
              updateState({ isConnecting: true });
              break;
              
            case 'started':
            case 'resumed':
              updateState({ 
                isConnected: true, 
                isConnecting: false,
                deviceName: event.deviceName || null,
              });
              showToast(`Ansluten till ${event.deviceName || 'Chromecast'}`, 'success');
              optionsRef.current?.onCastStart?.(event.deviceName || 'Chromecast');
              break;
              
            case 'startFailed':
            case 'resumeFailed':
              updateState({ isConnecting: false, isConnected: false });
              showToast('Kunde inte ansluta till Cast-enhet', 'error');
              optionsRef.current?.onError?.('Connection failed');
              break;
              
            case 'ending':
              // Keep connected state until 'ended'
              break;
              
            case 'ended':
              // Get final position before clearing state
              NativeCast.getPlaybackState()
                .then(ps => {
                  optionsRef.current?.onCastEnd?.(ps.currentTime);
                })
                .catch(() => {
                  optionsRef.current?.onCastEnd?.(0);
                });
              
              updateState({
                isConnected: false,
                isConnecting: false,
                deviceName: null,
                playbackState: 'idle',
                isPlaying: false,
                currentTime: 0,
                duration: 0,
              });
              showToast('Frånkopplad från Cast', 'info');
              break;
              
            case 'suspended':
              updateState({ isPlaying: false });
              break;
          }
        }
      );
      listenersRef.current.push(sessionListener);
      
      // Playback state changes
      const playbackListener = await NativeCast.addListener(
        'playbackStateChange',
        (event: { state: string }) => {
          console.log('[useNativeCast] Playback state change:', event);
          
          const ps = event.state as CastPlaybackState['state'];
          updateState({
            playbackState: ps,
            isPlaying: ps === 'playing',
          });
        }
      );
      listenersRef.current.push(playbackListener);
      
      // Time updates
      const timeListener = await NativeCast.addListener(
        'timeUpdate',
        (event: CastTimeUpdate) => {
          updateState({
            currentTime: event.currentTime,
            duration: event.duration,
            bufferedPosition: event.bufferedPosition,
          });
        }
      );
      listenersRef.current.push(timeListener);
      
    } catch (err) {
      console.error('[useNativeCast] Error setting up listeners:', err);
    }
  };
  
  // ============= Cast Control =============
  
  const showCastDialog = useCallback(async () => {
    if (!state.isAvailable) {
      showToast('Chromecast är inte tillgängligt', 'error');
      return;
    }
    
    try {
      updateState({ isShowingDialog: true });
      await NativeCast.showCastDialog();
    } catch (err) {
      console.error('[useNativeCast] Error showing cast dialog:', err);
      showToast('Kunde inte öppna cast-dialogen', 'error');
    } finally {
      updateState({ isShowingDialog: false });
    }
  }, [state.isAvailable, showToast, updateState]);
  
  const disconnect = useCallback(async () => {
    try {
      await NativeCast.disconnect();
    } catch (err) {
      console.error('[useNativeCast] Error disconnecting:', err);
    }
  }, []);
  
  // ============= Media Loading =============
  
  const loadMedia = useCallback(async (media: NativeCastMedia): Promise<boolean> => {
    if (!state.isConnected) {
      showToast('Ingen Cast-enhet ansluten', 'error');
      return false;
    }
    
    try {
      const opts: LoadMediaOptions = {
        url: media.url,
        title: media.title,
        subtitle: media.subtitle,
        posterUrl: media.posterUrl,
        isLive: media.isLive,
        startPosition: media.startPosition,
      };
      
      const result = await NativeCast.loadMedia(opts);
      
      if (result.success) {
        showToast(`Spelar: ${media.title || 'Media'}`, 'success');
      } else {
        showToast('Kunde inte ladda media på Cast', 'error');
      }
      
      return result.success;
    } catch (err) {
      console.error('[useNativeCast] Error loading media:', err);
      showToast('Fel vid laddning av media', 'error');
      return false;
    }
  }, [state.isConnected, showToast]);
  
  // ============= Playback Controls =============
  
  const play = useCallback(async () => {
    try {
      await NativeCast.play();
    } catch (err) {
      console.error('[useNativeCast] Error playing:', err);
    }
  }, []);
  
  const pause = useCallback(async () => {
    try {
      await NativeCast.pause();
    } catch (err) {
      console.error('[useNativeCast] Error pausing:', err);
    }
  }, []);
  
  const togglePlayPause = useCallback(async () => {
    if (state.isPlaying) {
      await pause();
    } else {
      await play();
    }
  }, [state.isPlaying, play, pause]);
  
  const stop = useCallback(async () => {
    try {
      await NativeCast.stop();
    } catch (err) {
      console.error('[useNativeCast] Error stopping:', err);
    }
  }, []);
  
  const seek = useCallback(async (position: number) => {
    try {
      await NativeCast.seek({ position });
    } catch (err) {
      console.error('[useNativeCast] Error seeking:', err);
    }
  }, []);
  
  const seekRelative = useCallback(async (delta: number) => {
    const newPosition = Math.max(0, Math.min(state.duration, state.currentTime + delta));
    await seek(newPosition);
  }, [state.currentTime, state.duration, seek]);
  
  // ============= Volume Controls =============
  
  const setVolume = useCallback(async (volume: number) => {
    try {
      await NativeCast.setVolume({ volume: Math.max(0, Math.min(1, volume)) });
      updateState({ volume });
    } catch (err) {
      console.error('[useNativeCast] Error setting volume:', err);
    }
  }, [updateState]);
  
  const setMuted = useCallback(async (muted: boolean) => {
    try {
      await NativeCast.setMuted({ muted });
      updateState({ isMuted: muted });
    } catch (err) {
      console.error('[useNativeCast] Error setting muted:', err);
    }
  }, [updateState]);
  
  const toggleMute = useCallback(async () => {
    await setMuted(!state.isMuted);
  }, [state.isMuted, setMuted]);
  
  // ============= Utility =============
  
  const refreshState = useCallback(async () => {
    if (!state.isAvailable) return;
    
    try {
      const [castState, playbackState] = await Promise.all([
        NativeCast.getCastState(),
        state.isConnected ? NativeCast.getPlaybackState() : null,
      ]);
      
      updateState({
        connectionState: castState.state,
        isConnected: castState.isConnected,
        deviceName: castState.deviceName || null,
        ...(playbackState && {
          playbackState: playbackState.state,
          isPlaying: playbackState.state === 'playing',
          currentTime: playbackState.currentTime,
          duration: playbackState.duration,
          volume: playbackState.volume,
          isMuted: playbackState.isMuted,
        }),
      });
    } catch (err) {
      console.error('[useNativeCast] Error refreshing state:', err);
    }
  }, [state.isAvailable, state.isConnected, updateState]);
  
  return {
    state,
    showCastDialog,
    disconnect,
    loadMedia,
    play,
    pause,
    togglePlayPause,
    stop,
    seek,
    seekRelative,
    setVolume,
    setMuted,
    toggleMute,
    refreshState,
  };
}

export default useNativeCast;
