/**
 * EngineBadge - Shows the current active player engine in a badge
 * 
 * Displays ExoPlayer, VLC, or other engine status with appropriate styling
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Cpu, Film } from 'lucide-react';

export type EngineType = 'exo' | 'vlc' | 'exo-bridge' | 'vlc-bridge' | 'html5' | 'shaka' | 'none' | string;

interface EngineBadgeProps {
  engine: EngineType;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Get display name and color for an engine
 */
function getEngineInfo(engine: EngineType): { name: string; variant: 'default' | 'secondary' | 'outline'; color: string } {
  switch (engine) {
    case 'exo':
    case 'exo-bridge':
      return { 
        name: 'ExoPlayer', 
        variant: 'default',
        color: 'bg-green-500/20 text-green-400 border-green-500/30'
      };
    case 'vlc':
    case 'vlc-bridge':
      return { 
        name: 'VLC', 
        variant: 'secondary',
        color: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      };
    case 'html5':
      return { 
        name: 'HTML5', 
        variant: 'outline',
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      };
    case 'shaka':
      return { 
        name: 'Shaka', 
        variant: 'outline',
        color: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      };
    case 'none':
      return { 
        name: 'Ingen', 
        variant: 'outline',
        color: 'bg-muted/20 text-muted-foreground border-muted/30'
      };
    default:
      return { 
        name: engine, 
        variant: 'outline',
        color: 'bg-muted/20 text-muted-foreground border-muted/30'
      };
  }
}

export function EngineBadge({ engine, className, size = 'sm' }: EngineBadgeProps) {
  const { name, color } = getEngineInfo(engine);
  
  if (engine === 'none') return null;
  
  const isVlc = engine === 'vlc' || engine === 'vlc-bridge';
  const Icon = isVlc ? Film : Cpu;
  
  return (
    <Badge 
      variant="outline"
      className={cn(
        "font-medium border backdrop-blur-sm",
        color,
        size === 'sm' ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
        className
      )}
    >
      <Icon className={cn(
        "mr-1",
        size === 'sm' ? "w-2.5 h-2.5" : "w-3 h-3"
      )} />
      {name}
    </Badge>
  );
}

export default EngineBadge;
