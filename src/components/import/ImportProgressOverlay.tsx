/**
 * Import Progress Overlay - Shows import progress during processing
 */
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { ImportProgress } from '@/services/ImportService';

interface ImportProgressOverlayProps {
  progress: ImportProgress | null;
  visible: boolean;
}

export function ImportProgressOverlay({ progress, visible }: ImportProgressOverlayProps) {
  if (!visible) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 rounded-2xl bg-card border shadow-2xl">
        <div className="flex items-center gap-4 mb-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <div>
            <h3 className="font-semibold">Importerar spellista</h3>
            <p className="text-sm text-muted-foreground">
              {progress?.stage || 'Förbereder...'}
            </p>
          </div>
        </div>
        
        <Progress value={progress?.percent || 0} className="h-2" />
        
        <p className="text-xs text-muted-foreground text-center mt-3">
          Stäng inte fönstret under import
        </p>
      </div>
    </div>
  );
}
