/**
 * useCastIntegration - React hook for easy cast integration in player components
 * Provides state management and callbacks for Chromecast/AirPlay casting
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CastController, 
  CastState, 
  CastDevice, 
  getCastController 
} from '@/player/CastController';
import { MediaSource } from '@/player/types';
import { toast } from 'sonner';

interface UseCastIntegrationOptions {
  onCastStart?: (device: CastDevice) => void;
  onCastEnd?: (resumePosition: number) => void;
}

interface CastIntegration {
  // State
  castState: CastState;
  devices: CastDevice[];
  isCasting: boolean;
  isChromecastAvailable: boolean;
  isAirPlayAvailable: boolean;
  
  // Device picker
  showDevicePicker: boolean;
  openDevicePicker: () => void;
  closeDevicePicker: () => void;
  
  // Actions
  startCast: (media: MediaSource) => Promise<void>;
  stopCast: () => void;
  selectDevice: (deviceId: string, media: MediaSource) => Promise<void>;
  
  // Playback controls (for cast mode)
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

export function useCastIntegration(options?: UseCastIntegrationOptions): CastIntegration {
  const controllerRef = useRef<CastController | null>(null);
  const [castState, setCastState] = useState<CastState>({
    status: 'idle',
    currentTime: 0,
    duration: 0,
    isPlaying: false,
  });
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const pendingMediaRef = useRef<MediaSource | null>(null);

  // Initialize controller
  useEffect(() => {
    controllerRef.current = getCastController({
      onStateChange: setCastState,
      onDevicesChange: setDevices,
      onCastStart: (device, _source) => {
        console.log('[useCastIntegration] Cast started on', device.name);
        options?.onCastStart?.(device);
      },
      onCastEnd: (currentTime) => {
        console.log('[useCastIntegration] Cast ended at position', currentTime);
        options?.onCastEnd?.(currentTime);
      },
    });

    // Get initial state
    setCastState(controllerRef.current.getState());
    setDevices(controllerRef.current.getDevices());

    return () => {
      // Don't destroy on unmount - keep singleton alive
    };
  }, [options]);

  // Open device picker
  const openDevicePicker = useCallback(() => {
    setShowDevicePicker(true);
  }, []);

  // Close device picker
  const closeDevicePicker = useCallback(() => {
    setShowDevicePicker(false);
    pendingMediaRef.current = null;
  }, []);

  // Start cast with automatic device selection
  const startCast = useCallback(async (media: MediaSource) => {
    const controller = controllerRef.current;
    if (!controller) return;

    // Store media for later use
    pendingMediaRef.current = media;

    // If only one device, start directly
    const availableDevices = controller.getDevices();
    if (availableDevices.length === 1) {
      await controller.startCast(availableDevices[0], media);
    } else if (availableDevices.length > 1) {
      // Show device picker
      setShowDevicePicker(true);
    } else {
      toast.error('Inga cast-enheter hittades', {
        description: 'Se till att din Chromecast är på samma nätverk.',
      });
    }
  }, []);

  // Select device from picker
  const selectDevice = useCallback(async (deviceId: string, media: MediaSource) => {
    const controller = controllerRef.current;
    if (!controller) return;

    const device = controller.getDevices().find(d => d.id === deviceId);
    if (device) {
      setShowDevicePicker(false);
      await controller.startCast(device, media);
    }
  }, []);

  // Stop casting
  const stopCast = useCallback(() => {
    controllerRef.current?.stopCast();
  }, []);

  // Playback controls
  const play = useCallback(() => {
    controllerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    controllerRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    controllerRef.current?.togglePlay();
  }, []);

  const seek = useCallback((seconds: number) => {
    controllerRef.current?.seek(seconds);
  }, []);

  const setVolume = useCallback((volume: number) => {
    controllerRef.current?.setVolume(volume / 100); // Convert from 0-100 to 0-1
  }, []);

  const toggleMute = useCallback(() => {
    controllerRef.current?.toggleMute();
  }, []);

  return {
    // State
    castState,
    devices,
    isCasting: castState.status === 'casting',
    isChromecastAvailable: controllerRef.current?.isChromecastAvailable() ?? false,
    isAirPlayAvailable: controllerRef.current?.isAirPlayAvailable() ?? false,
    
    // Device picker
    showDevicePicker,
    openDevicePicker,
    closeDevicePicker,
    
    // Actions
    startCast,
    stopCast,
    selectDevice,
    
    // Playback controls
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
  };
}

export default useCastIntegration;
