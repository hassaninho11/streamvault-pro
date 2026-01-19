/**
 * EngineSwitcher - Dropdown to quickly switch between player engines during playback
 */

import { useState } from 'react';
import { ChevronDown, Cpu, Film, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type EngineId = 'exo' | 'vlc' | 'exo-bridge' | 'vlc-bridge' | 'none';

interface EngineSwitcherProps {
  currentEngine: string;
  onSwitchToExo: () => void;
  onSwitchToVlc: () => void;
  disabled?: boolean;
  className?: string;
}

const ENGINE_INFO = {
  'exo': { name: 'ExoPlayer', icon: Cpu, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  'exo-bridge': { name: 'ExoPlayer', icon: Cpu, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  'vlc': { name: 'VLC', icon: Film, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  'vlc-bridge': { name: 'VLC', icon: Film, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  'none': { name: 'Ingen', icon: Cpu, color: 'text-muted-foreground', bgColor: 'bg-muted/20' },
} as const;

function getEngineInfo(engine: string) {
  return ENGINE_INFO[engine as keyof typeof ENGINE_INFO] || ENGINE_INFO['none'];
}

function normalizeEngine(engine: string): 'exo' | 'vlc' | 'none' {
  if (engine === 'exo' || engine === 'exo-bridge') return 'exo';
  if (engine === 'vlc' || engine === 'vlc-bridge') return 'vlc';
  return 'none';
}

export function EngineSwitcher({
  currentEngine,
  onSwitchToExo,
  onSwitchToVlc,
  disabled = false,
  className,
}: EngineSwitcherProps) {
  const [isSwitching, setIsSwitching] = useState(false);
  const normalizedEngine = normalizeEngine(currentEngine);
  const engineInfo = getEngineInfo(currentEngine);
  const Icon = engineInfo.icon;

  const handleSwitch = async (target: 'exo' | 'vlc') => {
    if (target === normalizedEngine || isSwitching) return;
    
    setIsSwitching(true);
    try {
      if (target === 'exo') {
        onSwitchToExo();
        toast.info('Byter till ExoPlayer...', { duration: 2000 });
      } else {
        onSwitchToVlc();
        toast.info('Byter till VLC...', { duration: 2000 });
      }
    } finally {
      // Reset after a short delay to allow the switch to complete
      setTimeout(() => setIsSwitching(false), 1500);
    }
  };

  if (currentEngine === 'none') {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || isSwitching}
          className={cn(
            "text-white hover:bg-white/20 gap-1.5 h-8 px-2",
            className
          )}
        >
          <Icon className={cn("w-4 h-4", engineInfo.color)} />
          <span className="text-xs font-medium">{engineInfo.name}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-48 bg-background/95 backdrop-blur-lg border-border"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Spelarmotor
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => handleSwitch('exo')}
          disabled={normalizedEngine === 'exo' || isSwitching}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5">
              <Cpu className="w-3 h-3 mr-1" />
              EXO
            </Badge>
            <span>ExoPlayer</span>
          </div>
          {normalizedEngine === 'exo' && (
            <Check className="w-4 h-4 text-primary" />
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => handleSwitch('vlc')}
          disabled={normalizedEngine === 'vlc' || isSwitching}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1.5">
              <Film className="w-3 h-3 mr-1" />
              VLC
            </Badge>
            <span>VLC (In-App)</span>
          </div>
          {normalizedEngine === 'vlc' && (
            <Check className="w-4 h-4 text-primary" />
          )}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
          {normalizedEngine === 'exo' 
            ? 'ExoPlayer är standard. Byt till VLC vid problem.'
            : 'VLC ger bättre kompatibilitet för MKV och äldre format.'
          }
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default EngineSwitcher;
