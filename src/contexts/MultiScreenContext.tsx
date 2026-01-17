/**
 * MultiScreen Context - Manage multiple video streams
 * Supports up to 4 simultaneous streams in grid layout
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Channel } from '@/types/iptv';

// ============= Types =============

export interface ScreenSlot {
  id: string;
  channel: Channel | null;
  isActive: boolean;
  isMuted: boolean;
  volume: number;
}

export interface MultiScreenLayout {
  type: '1x1' | '2x1' | '1x2' | '2x2' | '3x1' | '1+3';
  slots: number;
}

export const LAYOUTS: MultiScreenLayout[] = [
  { type: '1x1', slots: 1 },
  { type: '2x1', slots: 2 },
  { type: '1x2', slots: 2 },
  { type: '2x2', slots: 4 },
  { type: '3x1', slots: 3 },
  { type: '1+3', slots: 4 }, // 1 large + 3 small
];

export interface MultiScreenContextType {
  // State
  isMultiScreenMode: boolean;
  layout: MultiScreenLayout;
  slots: ScreenSlot[];
  activeSlotId: string | null;
  
  // Actions
  enterMultiScreen: () => void;
  exitMultiScreen: () => void;
  setLayout: (layout: MultiScreenLayout) => void;
  setChannelToSlot: (slotId: string, channel: Channel) => void;
  removeChannelFromSlot: (slotId: string) => void;
  setActiveSlot: (slotId: string) => void;
  toggleSlotMute: (slotId: string) => void;
  setSlotVolume: (slotId: string, volume: number) => void;
  swapSlots: (slotId1: string, slotId2: string) => void;
  
  // Helpers
  getEmptySlot: () => ScreenSlot | null;
  addChannelToNextSlot: (channel: Channel) => boolean;
}

const MultiScreenContext = createContext<MultiScreenContextType | null>(null);

// ============= Helper Functions =============

function createSlot(index: number): ScreenSlot {
  return {
    id: `slot-${index}`,
    channel: null,
    isActive: index === 0,
    isMuted: index > 0, // Only first slot has audio by default
    volume: 80,
  };
}

function createSlots(count: number): ScreenSlot[] {
  return Array.from({ length: count }, (_, i) => createSlot(i));
}

// ============= Provider =============

export function MultiScreenProvider({ children }: { children: React.ReactNode }) {
  const [isMultiScreenMode, setIsMultiScreenMode] = useState(false);
  const [layout, setLayoutState] = useState<MultiScreenLayout>(LAYOUTS[0]);
  const [slots, setSlots] = useState<ScreenSlot[]>(() => createSlots(4));
  const [activeSlotId, setActiveSlotId] = useState<string | null>('slot-0');
  
  // Enter multi-screen mode
  const enterMultiScreen = useCallback(() => {
    setIsMultiScreenMode(true);
  }, []);
  
  // Exit multi-screen mode
  const exitMultiScreen = useCallback(() => {
    setIsMultiScreenMode(false);
    setLayoutState(LAYOUTS[0]);
    // Keep first channel, clear others
    setSlots(prev => {
      const firstChannel = prev.find(s => s.channel)?.channel;
      const newSlots = createSlots(4);
      if (firstChannel) {
        newSlots[0].channel = firstChannel;
      }
      return newSlots;
    });
    setActiveSlotId('slot-0');
  }, []);
  
  // Set layout
  const setLayout = useCallback((newLayout: MultiScreenLayout) => {
    setLayoutState(newLayout);
  }, []);
  
  // Set channel to a specific slot
  const setChannelToSlot = useCallback((slotId: string, channel: Channel) => {
    setSlots(prev => prev.map(slot => 
      slot.id === slotId 
        ? { ...slot, channel, isActive: true }
        : slot
    ));
  }, []);
  
  // Remove channel from slot
  const removeChannelFromSlot = useCallback((slotId: string) => {
    setSlots(prev => prev.map(slot =>
      slot.id === slotId
        ? { ...slot, channel: null, isActive: false }
        : slot
    ));
  }, []);
  
  // Set active slot (for audio focus)
  const setActiveSlot = useCallback((slotId: string) => {
    setActiveSlotId(slotId);
    // Unmute selected, mute others
    setSlots(prev => prev.map(slot => ({
      ...slot,
      isMuted: slot.id !== slotId,
    })));
  }, []);
  
  // Toggle mute for a slot
  const toggleSlotMute = useCallback((slotId: string) => {
    setSlots(prev => prev.map(slot =>
      slot.id === slotId
        ? { ...slot, isMuted: !slot.isMuted }
        : slot
    ));
  }, []);
  
  // Set volume for a slot
  const setSlotVolume = useCallback((slotId: string, volume: number) => {
    setSlots(prev => prev.map(slot =>
      slot.id === slotId
        ? { ...slot, volume }
        : slot
    ));
  }, []);
  
  // Swap two slots
  const swapSlots = useCallback((slotId1: string, slotId2: string) => {
    setSlots(prev => {
      const slot1 = prev.find(s => s.id === slotId1);
      const slot2 = prev.find(s => s.id === slotId2);
      if (!slot1 || !slot2) return prev;
      
      return prev.map(slot => {
        if (slot.id === slotId1) {
          return { ...slot, channel: slot2.channel };
        }
        if (slot.id === slotId2) {
          return { ...slot, channel: slot1.channel };
        }
        return slot;
      });
    });
  }, []);
  
  // Get first empty slot
  const getEmptySlot = useCallback((): ScreenSlot | null => {
    return slots.find(s => !s.channel) || null;
  }, [slots]);
  
  // Add channel to next available slot
  const addChannelToNextSlot = useCallback((channel: Channel): boolean => {
    const emptySlot = slots.find(s => !s.channel);
    if (!emptySlot) return false;
    
    setChannelToSlot(emptySlot.id, channel);
    return true;
  }, [slots, setChannelToSlot]);
  
  // Visible slots based on layout
  const visibleSlots = useMemo(() => {
    return slots.slice(0, layout.slots);
  }, [slots, layout]);
  
  const value: MultiScreenContextType = {
    isMultiScreenMode,
    layout,
    slots: visibleSlots,
    activeSlotId,
    enterMultiScreen,
    exitMultiScreen,
    setLayout,
    setChannelToSlot,
    removeChannelFromSlot,
    setActiveSlot,
    toggleSlotMute,
    setSlotVolume,
    swapSlots,
    getEmptySlot,
    addChannelToNextSlot,
  };
  
  return (
    <MultiScreenContext.Provider value={value}>
      {children}
    </MultiScreenContext.Provider>
  );
}

// ============= Hook =============

export function useMultiScreen(): MultiScreenContextType {
  const context = useContext(MultiScreenContext);
  if (!context) {
    throw new Error('useMultiScreen must be used within a MultiScreenProvider');
  }
  return context;
}
