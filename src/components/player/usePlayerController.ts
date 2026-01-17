/**
 * usePlayerController - React hook for PlayerController integration
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerController, PlayerState, PlayerErrorCode, PlayerControllerConfig } from './PlayerController';
import { useMetricsStore } from '@/data/stores/metricsStore';

interface UsePlayerControllerOptions extends Partial<PlayerControllerConfig> {
  autoPlay?: boolean;
}

interface UsePlayerControllerReturn {
  state: PlayerState;
  videoRef: React.RefObject<HTMLVideoElement>;
  load: (url: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  seek: (time: number) => void;
  retry: () => void;
  isRetrying: boolean;
  canRetry: boolean;
}

const initialState: PlayerState = {
  isPlaying: false,
  isBuffering: false,
  isMuted: false,
  volume: 1,
  error: null,
  errorCode: null,
  retryCount: 0,
  currentTime: 0,
  duration: 0,
};

export const usePlayerController = (
  options: UsePlayerControllerOptions = {}
): UsePlayerControllerReturn => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controllerRef = useRef<PlayerController | null>(null);
  const [state, setState] = useState<PlayerState>(initialState);
  
  const recordPlayerError = useMetricsStore((s) => s.recordPlayerError);
  const recordPlayerReconnect = useMetricsStore((s) => s.recordPlayerReconnect);

  // Initialize controller
  useEffect(() => {
    const controller = new PlayerController({
      ...options,
      onStateChange: (newState) => {
        setState(newState);
      },
      onError: (errorCode, _message) => {
        recordPlayerError();
        console.error(`[Player] Error: ${errorCode}`);
      },
    });

    controllerRef.current = controller;

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  // Attach to video element
  useEffect(() => {
    if (videoRef.current && controllerRef.current) {
      controllerRef.current.attach(videoRef.current);
    }

    return () => {
      controllerRef.current?.detach();
    };
  }, [videoRef.current]);

  // Track reconnects
  useEffect(() => {
    if (state.retryCount > 0 && !state.error) {
      recordPlayerReconnect();
    }
  }, [state.retryCount, state.error, recordPlayerReconnect]);

  const load = useCallback(async (url: string) => {
    await controllerRef.current?.load(url);
  }, []);

  const play = useCallback(() => {
    controllerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    controllerRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    controllerRef.current?.togglePlay();
  }, []);

  const setVolume = useCallback((volume: number) => {
    controllerRef.current?.setVolume(volume);
  }, []);

  const toggleMute = useCallback(() => {
    controllerRef.current?.toggleMute();
  }, []);

  const seek = useCallback((time: number) => {
    controllerRef.current?.seek(time);
  }, []);

  const retry = useCallback(() => {
    controllerRef.current?.retry();
  }, []);

  const isRetrying = state.retryCount > 0 && state.error === null;
  const canRetry = state.error !== null && state.retryCount < (options.maxRetries ?? 3);

  return {
    state,
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    load,
    play,
    pause,
    togglePlay,
    setVolume,
    toggleMute,
    seek,
    retry,
    isRetrying,
    canRetry,
  };
};

export default usePlayerController;
