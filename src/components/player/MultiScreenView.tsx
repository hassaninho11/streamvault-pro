/**
 * MultiScreenView - Grid layout for multiple video streams
 * Supports various layouts: 2x2, 1+3, 3x1, etc.
 */

import { useRef, useEffect, useState } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Grid2X2,
  LayoutGrid,
  PictureInPicture2,
  GripVertical,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { 
  useMultiScreen, 
  type ScreenSlot, 
  type MultiScreenLayout,
  LAYOUTS 
} from '@/contexts/MultiScreenContext';
import { usePip } from '@/services/PipService';
import type { Channel } from '@/types/iptv';

interface MultiScreenViewProps {
  onSelectChannel?: (slotId: string) => void;
  onClose?: () => void;
  className?: string;
}

export function MultiScreenView({ 
  onSelectChannel, 
  onClose,
  className 
}: MultiScreenViewProps) {
  const {
    layout,
    slots,
    activeSlotId,
    setLayout,
    removeChannelFromSlot,
    setActiveSlot,
    toggleSlotMute,
    exitMultiScreen,
  } = useMultiScreen();
  
  const handleClose = () => {
    exitMultiScreen();
    onClose?.();
  };
  
  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Grid2X2 className="w-5 h-5 text-primary" />
          <span className="font-semibold">Multi-Screen</span>
        </div>
        
        {/* Layout selector */}
        <div className="flex items-center gap-1">
          {LAYOUTS.slice(0, 4).map((l) => (
            <Button
              key={l.type}
              variant={layout.type === l.type ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setLayout(l)}
              className="px-2"
            >
              <LayoutIcon layout={l.type} />
            </Button>
          ))}
        </div>
        
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Grid */}
      <div className={cn('flex-1 p-2', getGridClasses(layout))}>
        {slots.map((slot, index) => (
          <ScreenSlotView
            key={slot.id}
            slot={slot}
            isActive={slot.id === activeSlotId}
            isMainSlot={layout.type === '1+3' && index === 0}
            onSelect={() => setActiveSlot(slot.id)}
            onRemove={() => removeChannelFromSlot(slot.id)}
            onToggleMute={() => toggleSlotMute(slot.id)}
            onAddChannel={() => onSelectChannel?.(slot.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ============= Screen Slot =============

interface ScreenSlotViewProps {
  slot: ScreenSlot;
  isActive: boolean;
  isMainSlot?: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onToggleMute: () => void;
  onAddChannel: () => void;
}

function ScreenSlotView({
  slot,
  isActive,
  isMainSlot,
  onSelect,
  onRemove,
  onToggleMute,
  onAddChannel,
}: ScreenSlotViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { togglePip, isSupported: pipSupported } = usePip(videoRef);
  
  // Load video when channel changes
  useEffect(() => {
    if (!slot.channel || !videoRef.current) return;
    
    const video = videoRef.current;
    setError(null);
    setIsBuffering(true);
    
    video.src = slot.channel.streamUrl;
    video.muted = slot.isMuted;
    video.volume = slot.volume / 100;
    
    video.play().catch((err) => {
      console.error('[ScreenSlot] Play failed:', err);
      setError('Kunde inte spela');
    });
  }, [slot.channel]);
  
  // Update mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = slot.isMuted;
    }
  }, [slot.isMuted]);
  
  // Update volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = slot.volume / 100;
    }
  }, [slot.volume]);
  
  if (!slot.channel) {
    return (
      <div 
        className={cn(
          'relative rounded-lg border-2 border-dashed border-muted-foreground/30',
          'flex items-center justify-center bg-muted/20',
          'cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors',
          isMainSlot && 'row-span-2 col-span-2'
        )}
        onClick={onAddChannel}
      >
        <div className="text-center">
          <Plus className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Lägg till kanal</p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className={cn(
        'relative rounded-lg overflow-hidden bg-black group',
        'ring-2 transition-all',
        isActive ? 'ring-primary' : 'ring-transparent hover:ring-muted-foreground/30',
        isMainSlot && 'row-span-2 col-span-2'
      )}
      onClick={onSelect}
    >
      {/* Video */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onError={() => {
          setError('Stream ej tillgänglig');
          setIsBuffering(false);
        }}
      />
      
      {/* Buffering indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      
      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      
      {/* Channel info overlay */}
      <div className={cn(
        'absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent',
        'opacity-0 group-hover:opacity-100 transition-opacity'
      )}>
        <div className="flex items-center gap-2">
          {slot.channel.logoUrl && (
            <img 
              src={slot.channel.logoUrl} 
              alt="" 
              className="w-6 h-6 rounded object-contain bg-white/10"
            />
          )}
          <span className="text-sm font-medium truncate">{slot.channel.name}</span>
        </div>
      </div>
      
      {/* Controls overlay */}
      <div className={cn(
        'absolute inset-x-0 top-0 p-2 flex justify-between',
        'opacity-0 group-hover:opacity-100 transition-opacity'
      )}>
        {/* Mute button */}
        <Button
          variant="player"
          size="icon"
          className="w-7 h-7"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
        >
          {slot.isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </Button>
        
        <div className="flex gap-1">
          {/* PiP button */}
          {pipSupported && (
            <Button
              variant="player"
              size="icon"
              className="w-7 h-7"
              onClick={(e) => {
                e.stopPropagation();
                togglePip();
              }}
            >
              <PictureInPicture2 className="w-4 h-4" />
            </Button>
          )}
          
          {/* Remove button */}
          <Button
            variant="player"
            size="icon"
            className="w-7 h-7"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      )}
      
      {/* Audio indicator */}
      {!slot.isMuted && (
        <div className="absolute bottom-2 right-2">
          <Volume2 className="w-4 h-4 text-green-400" />
        </div>
      )}
    </div>
  );
}

// ============= Layout Icon =============

function LayoutIcon({ layout }: { layout: string }) {
  switch (layout) {
    case '1x1':
      return <div className="w-4 h-4 border rounded" />;
    case '2x1':
      return (
        <div className="w-4 h-4 flex gap-0.5">
          <div className="flex-1 border rounded-sm" />
          <div className="flex-1 border rounded-sm" />
        </div>
      );
    case '1x2':
      return (
        <div className="w-4 h-4 flex flex-col gap-0.5">
          <div className="flex-1 border rounded-sm" />
          <div className="flex-1 border rounded-sm" />
        </div>
      );
    case '2x2':
      return (
        <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
          <div className="border rounded-sm" />
          <div className="border rounded-sm" />
          <div className="border rounded-sm" />
          <div className="border rounded-sm" />
        </div>
      );
    default:
      return <LayoutGrid className="w-4 h-4" />;
  }
}

// ============= Grid Classes =============

function getGridClasses(layout: MultiScreenLayout): string {
  switch (layout.type) {
    case '1x1':
      return 'grid grid-cols-1 gap-2';
    case '2x1':
      return 'grid grid-cols-2 gap-2';
    case '1x2':
      return 'grid grid-cols-1 grid-rows-2 gap-2';
    case '2x2':
      return 'grid grid-cols-2 grid-rows-2 gap-2';
    case '3x1':
      return 'grid grid-cols-3 gap-2';
    case '1+3':
      return 'grid grid-cols-3 grid-rows-2 gap-2'; // First slot spans 2x2
    default:
      return 'grid grid-cols-2 gap-2';
  }
}
