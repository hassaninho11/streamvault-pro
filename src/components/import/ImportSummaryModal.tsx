/**
 * Import Summary Modal - Shows import results with stats
 */
import { 
  CheckCircle, 
  XCircle, 
  Tv, 
  Film, 
  PlaySquare, 
  AlertTriangle,
  Clock,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { ImportSummary } from '@/services/ImportService';

interface ImportSummaryModalProps {
  summary: ImportSummary | null;
  open: boolean;
  onClose: () => void;
  onViewUnknown?: () => void;
}

export function ImportSummaryModal({
  summary,
  open,
  onClose,
  onViewUnknown,
}: ImportSummaryModalProps) {
  if (!summary) return null;
  
  const { success, stats, providerName, error } = summary;
  const totalClassified = stats.liveCount + stats.movieCount + stats.seriesCount;
  const classificationRate = stats.total > 0 
    ? Math.round((totalClassified / stats.total) * 100) 
    : 0;
  
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {success ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            {success ? 'Import slutförd' : 'Import misslyckades'}
          </DialogTitle>
          <DialogDescription>
            {providerName}
          </DialogDescription>
        </DialogHeader>
        
        {error ? (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard 
                icon={Tv} 
                label="Live kanaler" 
                value={stats.liveCount} 
                color="text-blue-400"
              />
              <StatCard 
                icon={Film} 
                label="Filmer" 
                value={stats.movieCount} 
                color="text-purple-400"
              />
              <StatCard 
                icon={PlaySquare} 
                label="Serier" 
                value={stats.seriesCount} 
                color="text-green-400"
              />
              <StatCard 
                icon={Layers} 
                label="Avsnitt" 
                value={stats.episodeCount} 
                color="text-cyan-400"
              />
            </div>
            
            <Separator />
            
            {/* Classification Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Klassificeringsgrad</span>
                <span className="font-medium">{classificationRate}%</span>
              </div>
              <Progress value={classificationRate} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{totalClassified} av {stats.total} identifierade</span>
                {stats.unknownCount > 0 && (
                  <Badge variant="secondary" className="text-yellow-500">
                    {stats.unknownCount} okända
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Series Details */}
            {stats.seriesCount > 0 && (
              <div className="p-3 rounded-lg bg-muted/50">
                <h4 className="font-medium text-sm mb-2">Seriestruktur</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Serier:</span>
                    <span>{stats.seriesCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Säsonger:</span>
                    <span>{stats.seasonCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Avsnitt:</span>
                    <span>{stats.episodeCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Snitt avsnitt/serie:</span>
                    <span>{stats.seriesCount > 0 ? Math.round(stats.episodeCount / stats.seriesCount) : 0}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Unknown Content Warning */}
            {stats.unknownCount > 0 && (
              <div 
                className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 cursor-pointer hover:bg-yellow-500/15 transition-colors"
                onClick={onViewUnknown}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-yellow-500">
                      {stats.unknownCount} poster kunde inte klassificeras
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dessa hamnar i "Övrigt" och kan sorteras manuellt.
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-yellow-500" />
                </div>
              </div>
            )}
            
            {/* Performance Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Parsning: {stats.parseTimeMs.toFixed(0)}ms</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Totalt: {stats.processTimeMs.toFixed(0)}ms</span>
              </div>
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button onClick={onClose}>
            {success ? 'Klar' : 'Stäng'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 text-center">
      <Icon className={cn("w-5 h-5 mx-auto mb-1", color)} />
      <p className="text-lg font-bold">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
