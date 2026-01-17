/**
 * PiP Service - Picture-in-Picture management
 * Handles browser native PiP API and custom floating player
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface PipState {
  isActive: boolean;
  isSupported: boolean;
  videoElement: HTMLVideoElement | null;
}

class PipServiceClass {
  private currentPipElement: HTMLVideoElement | null = null;
  private listeners: Set<(state: PipState) => void> = new Set();
  
  constructor() {
    // Listen for PiP changes
    if (typeof document !== 'undefined') {
      document.addEventListener('enterpictureinpicture', this.handlePipEnter);
      document.addEventListener('leavepictureinpicture', this.handlePipLeave);
    }
  }
  
  /**
   * Check if PiP is supported
   */
  isSupported(): boolean {
    return typeof document !== 'undefined' && 
           'pictureInPictureEnabled' in document && 
           document.pictureInPictureEnabled;
  }
  
  /**
   * Check if currently in PiP mode
   */
  isActive(): boolean {
    return document.pictureInPictureElement !== null;
  }
  
  /**
   * Enter PiP mode for a video element
   */
  async enterPip(videoElement: HTMLVideoElement): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('[PipService] PiP not supported');
      return false;
    }
    
    try {
      // Exit current PiP if any
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      
      await videoElement.requestPictureInPicture();
      this.currentPipElement = videoElement;
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('[PipService] Failed to enter PiP:', error);
      return false;
    }
  }
  
  /**
   * Exit PiP mode
   */
  async exitPip(): Promise<boolean> {
    if (!document.pictureInPictureElement) {
      return true;
    }
    
    try {
      await document.exitPictureInPicture();
      this.currentPipElement = null;
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('[PipService] Failed to exit PiP:', error);
      return false;
    }
  }
  
  /**
   * Toggle PiP mode
   */
  async togglePip(videoElement: HTMLVideoElement): Promise<boolean> {
    if (this.isActive()) {
      return this.exitPip();
    }
    return this.enterPip(videoElement);
  }
  
  /**
   * Subscribe to PiP state changes
   */
  subscribe(callback: (state: PipState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  private handlePipEnter = (event: Event) => {
    this.currentPipElement = event.target as HTMLVideoElement;
    this.notifyListeners();
  };
  
  private handlePipLeave = () => {
    this.currentPipElement = null;
    this.notifyListeners();
  };
  
  private notifyListeners() {
    const state: PipState = {
      isActive: this.isActive(),
      isSupported: this.isSupported(),
      videoElement: this.currentPipElement,
    };
    this.listeners.forEach(cb => cb(state));
  }
  
  getState(): PipState {
    return {
      isActive: this.isActive(),
      isSupported: this.isSupported(),
      videoElement: this.currentPipElement,
    };
  }
}

export const PipService = new PipServiceClass();

// ============= React Hook =============

export function usePip(videoRef?: React.RefObject<HTMLVideoElement>) {
  const [pipState, setPipState] = useState<PipState>(PipService.getState());
  
  useEffect(() => {
    return PipService.subscribe(setPipState);
  }, []);
  
  const enterPip = useCallback(async () => {
    if (videoRef?.current) {
      return PipService.enterPip(videoRef.current);
    }
    return false;
  }, [videoRef]);
  
  const exitPip = useCallback(async () => {
    return PipService.exitPip();
  }, []);
  
  const togglePip = useCallback(async () => {
    if (videoRef?.current) {
      return PipService.togglePip(videoRef.current);
    }
    return false;
  }, [videoRef]);
  
  return {
    ...pipState,
    enterPip,
    exitPip,
    togglePip,
  };
}
