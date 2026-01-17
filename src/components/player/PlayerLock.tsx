/**
 * PlayerLock - Component for locking the player to prevent accidental navigation
 * Supports long-press (2 sec) or PIN to unlock
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Lock, Unlock, X, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PlayerLockProps {
  isLocked: boolean;
  onLockToggle: (locked: boolean) => void;
  pinEnabled?: boolean;
  pin?: string;
  onPinChange?: (pin: string) => void;
  className?: string;
}

const UNLOCK_HOLD_DURATION = 2000; // 2 seconds
const PIN_LENGTH = 4;

export function PlayerLock({ 
  isLocked, 
  onLockToggle, 
  pinEnabled = false,
  pin,
  onPinChange,
  className 
}: PlayerLockProps) {
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [confirmPin, setConfirmPin] = useState('');
  const holdStartTime = useRef<number>(0);
  const holdInterval = useRef<NodeJS.Timeout | null>(null);

  const startUnlock = useCallback(() => {
    if (!isLocked) return;
    
    // If PIN is enabled, show PIN dialog instead
    if (pinEnabled && pin) {
      setShowPinDialog(true);
      return;
    }
    
    holdStartTime.current = Date.now();
    setShowHint(true);
    
    holdInterval.current = setInterval(() => {
      const elapsed = Date.now() - holdStartTime.current;
      const progress = Math.min((elapsed / UNLOCK_HOLD_DURATION) * 100, 100);
      setUnlockProgress(progress);
      
      if (progress >= 100) {
        onLockToggle(false);
        cancelUnlock();
      }
    }, 16);
  }, [isLocked, onLockToggle, pinEnabled, pin]);

  const cancelUnlock = useCallback(() => {
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
    setUnlockProgress(0);
    setShowHint(false);
    holdStartTime.current = 0;
  }, []);

  const handlePinSubmit = useCallback(() => {
    if (isSettingPin) {
      if (pinInput.length === PIN_LENGTH) {
        if (!confirmPin) {
          setConfirmPin(pinInput);
          setPinInput('');
        } else if (pinInput === confirmPin) {
          onPinChange?.(pinInput);
          setShowPinDialog(false);
          setPinInput('');
          setConfirmPin('');
          setIsSettingPin(false);
        } else {
          setPinError(true);
          setPinInput('');
          setConfirmPin('');
          setTimeout(() => setPinError(false), 1500);
        }
      }
    } else {
      if (pinInput === pin) {
        onLockToggle(false);
        setShowPinDialog(false);
        setPinInput('');
      } else {
        setPinError(true);
        setPinInput('');
        setTimeout(() => setPinError(false), 1500);
      }
    }
  }, [pinInput, pin, isSettingPin, confirmPin, onLockToggle, onPinChange]);

  const handleSetPin = useCallback(() => {
    setIsSettingPin(true);
    setShowPinDialog(true);
    setPinInput('');
    setConfirmPin('');
  }, []);

  useEffect(() => {
    return () => {
      if (holdInterval.current) {
        clearInterval(holdInterval.current);
      }
    };
  }, []);

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

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pinInput.length === PIN_LENGTH) {
      handlePinSubmit();
    }
  }, [pinInput, handlePinSubmit]);

  if (!isLocked) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="player"
          size="icon"
          onClick={() => onLockToggle(true)}
          className={className}
          title="Lock player"
        >
          <Unlock className="w-5 h-5" />
        </Button>
        {pinEnabled && (
          <Button
            variant="player"
            size="icon"
            onClick={handleSetPin}
            title={pin ? "Change PIN" : "Set PIN"}
          >
            <KeyRound className="w-5 h-5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="relative">
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
          title={pinEnabled && pin ? "Tap to enter PIN" : "Hold to unlock"}
        >
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

        {showHint && !pinEnabled && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap">
            <div className="bg-background/90 text-foreground text-xs px-3 py-1.5 rounded-lg shadow-lg">
              {unlockProgress < 100 
                ? `Håll ${Math.ceil((UNLOCK_HOLD_DURATION - (unlockProgress / 100 * UNLOCK_HOLD_DURATION)) / 1000)}s...`
                : 'Låser upp...'}
            </div>
          </div>
        )}
      </div>

      {/* PIN Dialog */}
      <Dialog open={showPinDialog} onOpenChange={(open) => {
        setShowPinDialog(open);
        if (!open) {
          setPinInput('');
          setConfirmPin('');
          setIsSettingPin(false);
          setPinError(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              {isSettingPin 
                ? (confirmPin ? 'Bekräfta PIN-kod' : 'Ställ in PIN-kod')
                : 'Ange PIN-kod'
              }
            </DialogTitle>
            <DialogDescription>
              {isSettingPin 
                ? (confirmPin 
                    ? 'Ange samma PIN-kod igen för att bekräfta' 
                    : 'Välj en 4-siffrig PIN-kod för att låsa upp spelaren')
                : 'Ange din 4-siffriga PIN-kod för att låsa upp'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-6 py-6">
            {/* PIN dots display */}
            <div className="flex gap-3">
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-4 h-4 rounded-full border-2 transition-all",
                    pinInput.length > i 
                      ? "bg-primary border-primary" 
                      : "border-muted-foreground",
                    pinError && "border-destructive bg-destructive animate-shake"
                  )}
                />
              ))}
            </div>

            {/* Hidden input for keyboard */}
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={PIN_LENGTH}
              value={pinInput}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setPinInput(value);
              }}
              className="text-center text-2xl tracking-widest w-40"
              autoFocus
            />

            {pinError && (
              <p className="text-destructive text-sm">
                {isSettingPin ? 'PIN-koderna matchar inte' : 'Fel PIN-kod'}
              </p>
            )}

            {/* Numeric keypad for TV mode */}
            <div className="grid grid-cols-3 gap-2 w-48">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key, i) => {
                if (key === null) return <div key={i} />;
                return (
                  <Button
                    key={i}
                    variant="outline"
                    className="h-12 text-lg font-medium"
                    onClick={() => {
                      if (key === 'del') {
                        setPinInput(prev => prev.slice(0, -1));
                      } else if (pinInput.length < PIN_LENGTH) {
                        setPinInput(prev => prev + key);
                      }
                    }}
                  >
                    {key === 'del' ? <X className="w-5 h-5" /> : key}
                  </Button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * PlayerLockOverlay - Full screen overlay when player is locked
 */
interface PlayerLockOverlayProps {
  isLocked: boolean;
  onUnlock: () => void;
  pinEnabled?: boolean;
  onShowPinDialog?: () => void;
  className?: string;
}

export function PlayerLockOverlay({ 
  isLocked, 
  onUnlock, 
  pinEnabled,
  onShowPinDialog,
  className 
}: PlayerLockOverlayProps) {
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const holdStartTime = useRef<number>(0);
  const holdInterval = useRef<NodeJS.Timeout | null>(null);

  const startUnlock = useCallback(() => {
    if (pinEnabled && onShowPinDialog) {
      onShowPinDialog();
      return;
    }
    
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
  }, [onUnlock, pinEnabled, onShowPinDialog]);

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
        "bg-transparent",
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
      <div className={cn(
        "flex flex-col items-center gap-4 transition-opacity duration-300",
        showHint ? "opacity-100" : "opacity-0"
      )}>
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
          <p className="font-medium">Spelaren är låst</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pinEnabled 
              ? 'Tryck för att ange PIN-kod'
              : 'Håll skärmen i 2 sekunder för att låsa upp'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default PlayerLock;
