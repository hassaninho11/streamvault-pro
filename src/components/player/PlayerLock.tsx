/**
 * PlayerLock - Component for locking the player to prevent accidental navigation
 * Requires long-press (2 sec) or PIN to unlock
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Lock, Unlock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlayerLockProps {
  isLocked: boolean;
  onLockToggle: (locked: boolean) => void;
  className?: string;
}

const UNLOCK_HOLD_DURATION = 2000; // 2 seconds

export function PlayerLock({ isLocked, onLockToggle, className }: PlayerLockProps) {
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const holdStartTime = useRef<number>(0);
  const holdInterval = useRef<NodeJS.Timeout | null>(null);

  const startUnlock = useCallback(() => {
    if (!isLocked) return;
    
    holdStartTime.current = Date.now();
    setShowHint(true);
    
    holdInterval.current = setInterval(() => {
      const elapsed = Date.now() - holdStartTime.current;
      const progress = Math.min((elapsed / UNLOCK_HOLD_DURATION) * 100, 100);
      setUnlockProgress(progress);
      
      if (progress >= 100) {
        // Unlock!
        onLockToggle(false);
        cancelUnlock();
      }
    }, 16); // ~60fps
  }, [isLocked, onLockToggle]);

  const cancelUnlock = useCallback(() => {
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
    setUnlockProgress(0);
    setShowHint(false);
    holdStartTime.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (holdInterval.current) {
        clearInterval(holdInterval.current);
      }
    };
  }, []);

  // Handle keyboard for TV mode
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'OK' || e.key === ' ') {
        startUnlock();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'OK' || e.key === ' ') {
        cancelUnlock();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isLocked, startUnlock, cancelUnlock]);

  if (!isLocked) {
    return (
      <Button
        variant="player"
        size="icon"
        onClick={() => onLockToggle(true)}
        className={className}
        title="Lock player"
      >
        <Unlock className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <div className="relative">
      {/* Lock button with progress ring */}
      <button
        onMouseDown={startUnlock}
        onMouseUp={cancelUnlock}
        onMouseLeave={cancelUnlock}
        onTouchStart={startUnlock}
        onTouchEnd={cancelUnlock}
        className={cn(
          "relative w-12 h-12 rounded-full flex items-center justify-center",
          "bg-background/80 border-2 border-primary/50",
          "transition-all duration-200",
          unlockProgress > 0 && "scale-110",
          className
        )}
        title="Hold to unlock"
      >
        {/* Progress ring */}
        <svg 
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 48 48"
        >
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="hsl(var(--primary) / 0.3)"
            strokeWidth="3"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - unlockProgress / 100)}`}
            className="transition-all duration-75"
          />
        </svg>
        
        <Lock className={cn(
          "w-5 h-5 text-primary",
          unlockProgress > 0 && "animate-pulse"
        )} />
      </button>

      {/* Hint overlay */}
      {showHint && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap">
          <div className="bg-background/90 text-foreground text-xs px-3 py-1.5 rounded-lg shadow-lg">
            {unlockProgress < 100 
              ? `Hold ${Math.ceil((UNLOCK_HOLD_DURATION - (unlockProgress / 100 * UNLOCK_HOLD_DURATION)) / 1000)}s...`
              : 'Unlocking...'}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * PlayerLockOverlay - Full screen overlay when player is locked
 */
interface PlayerLockOverlayProps {
  isLocked: boolean;
  onUnlock: () => void;
  className?: string;
}

export function PlayerLockOverlay({ isLocked, onUnlock, className }: PlayerLockOverlayProps) {
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const holdStartTime = useRef<number>(0);
  const holdInterval = useRef<NodeJS.Timeout | null>(null);

  const startUnlock = useCallback(() => {
    holdStartTime.current = Date.now();
    setShowHint(true);
    
    holdInterval.current = setInterval(() => {
      const elapsed = Date.now() - holdStartTime.current;
      const progress = Math.min((elapsed / UNLOCK_HOLD_DURATION) * 100, 100);
      setUnlockProgress(progress);
      
      if (progress >= 100) {
        onUnlock();
        cancelUnlock();
      }
    }, 16);
  }, [onUnlock]);

  const cancelUnlock = useCallback(() => {
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
    setUnlockProgress(0);
    setShowHint(false);
    holdStartTime.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      if (holdInterval.current) {
        clearInterval(holdInterval.current);
      }
    };
  }, []);

  if (!isLocked) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center z-50",
        "bg-transparent", // Invisible but captures events
        className
      )}
      onMouseDown={startUnlock}
      onMouseUp={cancelUnlock}
      onMouseLeave={cancelUnlock}
      onTouchStart={startUnlock}
      onTouchEnd={cancelUnlock}
      onClick={(e) => {
        e.stopPropagation();
        setShowHint(true);
        setTimeout(() => setShowHint(false), 2000);
      }}
    >
      {/* Lock indicator */}
      <div className={cn(
        "flex flex-col items-center gap-4 transition-opacity duration-300",
        showHint ? "opacity-100" : "opacity-0"
      )}>
        {/* Progress circle */}
        <div className="relative w-20 h-20">
          <svg 
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 80 80"
          >
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="hsl(var(--background) / 0.8)"
              stroke="hsl(var(--primary) / 0.3)"
              strokeWidth="4"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - unlockProgress / 100)}`}
              className="transition-all duration-75"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
        </div>

        <div className="bg-background/90 text-foreground text-sm px-4 py-2 rounded-lg">
          <p className="font-medium">Player Locked</p>
          <p className="text-xs text-muted-foreground mt-1">
            Hold screen for 2 seconds to unlock
          </p>
        </div>
      </div>
    </div>
  );
}

export default PlayerLock;
