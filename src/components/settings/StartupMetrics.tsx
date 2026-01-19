/**
 * StartupMetrics - Shows performance metrics for app startup
 * Displays load times and hidden category savings
 */

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, 
  Clock, 
  Database, 
  EyeOff, 
  TrendingDown,
  Wifi,
  HardDrive,
  Layers
} from 'lucide-react';
import { useMetricsStore } from '@/data/stores/metricsStore';
import { useChannelStore } from '@/data/stores/channelStore';

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  highlight?: boolean;
}

function MetricRow({ icon, label, value, subValue, highlight }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-right">
        <span className={`font-mono text-sm ${highlight ? 'text-green-500 font-semibold' : ''}`}>
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-muted-foreground ml-1">{subValue}</span>
        )}
      </div>
    </div>
  );
}

export function StartupMetrics() {
  const startupMetrics = useMetricsStore((state) => state.startupMetrics);
  const coldStartMs = useMetricsStore((state) => state.coldStartMs);
  const channelCount = useChannelStore((state) => state.channels.length);
  const index = useChannelStore((state) => state.index);
  
  const stats = useMemo(() => {
    const loadTimeMs = startupMetrics.totalStartupMs || 0;
    const categoriesHidden = startupMetrics.hiddenCategories;
    const itemsSkipped = startupMetrics.estimatedSkippedItems;
    const timeSaved = startupMetrics.estimatedTimeSavedMs;
    
    // Calculate efficiency percentage
    const totalPossible = startupMetrics.totalChannelsLoaded + itemsSkipped;
    const efficiencyPercent = totalPossible > 0 
      ? Math.round((itemsSkipped / totalPossible) * 100) 
      : 0;
    
    // Format load source
    const sourceLabel = {
      cache: 'Cache',
      network: 'Nätverk',
      mixed: 'Blandat',
      none: '-',
    }[startupMetrics.loadSource];
    
    return {
      loadTimeMs,
      categoriesHidden,
      itemsSkipped,
      timeSaved,
      efficiencyPercent,
      sourceLabel,
      providerCount: startupMetrics.providerCount,
      fromCache: startupMetrics.channelsFromCache,
      fresh: startupMetrics.channelsFresh,
      totalCategories: startupMetrics.totalCategories,
      visibleCategories: startupMetrics.visibleCategories,
    };
  }, [startupMetrics]);
  
  const groupCount = index?.groups?.length || 0;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Prestandamätning
            </CardTitle>
            <CardDescription>
              Startup-tider och sparad tid från dolda kategorier
            </CardDescription>
          </div>
          {stats.timeSaved > 0 && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-500">
              <TrendingDown className="h-3 w-3 mr-1" />
              -{stats.timeSaved}ms
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Load Time Section */}
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground">Laddningstider</h4>
          <div className="bg-muted/30 rounded-lg p-3">
            <MetricRow
              icon={<Clock className="h-4 w-4" />}
              label="Total laddningstid"
              value={stats.loadTimeMs > 0 ? `${Math.round(stats.loadTimeMs)}ms` : '-'}
            />
            <MetricRow
              icon={<Zap className="h-4 w-4" />}
              label="Cold start"
              value={coldStartMs ? `${Math.round(coldStartMs)}ms` : '-'}
            />
            <MetricRow
              icon={stats.sourceLabel === 'Cache' ? <HardDrive className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
              label="Datakälla"
              value={stats.sourceLabel}
              subValue={stats.fromCache > 0 ? `(${stats.fromCache} från cache)` : undefined}
            />
          </div>
        </div>
        
        {/* Content Stats */}
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground">Innehållsstatistik</h4>
          <div className="bg-muted/30 rounded-lg p-3">
            <MetricRow
              icon={<Database className="h-4 w-4" />}
              label="Totalt kanaler"
              value={channelCount.toLocaleString()}
            />
            <MetricRow
              icon={<Layers className="h-4 w-4" />}
              label="Kategorier"
              value={groupCount}
              subValue={stats.visibleCategories > 0 ? `(${stats.visibleCategories} synliga)` : undefined}
            />
          </div>
        </div>
        
        {/* Hidden Category Savings */}
        {stats.categoriesHidden > 0 && (
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-muted-foreground">Sparad tid (dolda kategorier)</h4>
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
              <MetricRow
                icon={<EyeOff className="h-4 w-4" />}
                label="Dolda kategorier"
                value={stats.categoriesHidden}
              />
              <MetricRow
                icon={<TrendingDown className="h-4 w-4" />}
                label="Objekt som hoppades över"
                value={stats.itemsSkipped.toLocaleString()}
                highlight
              />
              <MetricRow
                icon={<Zap className="h-4 w-4" />}
                label="Uppskattad sparad tid"
                value={`~${stats.timeSaved}ms`}
                highlight
              />
              
              {/* Efficiency Bar */}
              <div className="mt-3 pt-2 border-t border-green-500/20">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Filtreringseffektivitet</span>
                  <span className="text-green-500 font-medium">{stats.efficiencyPercent}%</span>
                </div>
                <Progress 
                  value={stats.efficiencyPercent} 
                  className="h-1.5 bg-muted"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* No savings message */}
        {stats.categoriesHidden === 0 && stats.totalCategories > 0 && (
          <div className="text-center py-3 text-muted-foreground text-sm">
            <EyeOff className="h-4 w-4 inline-block mr-1 opacity-50" />
            Inga dolda kategorier. Göm kategorier för att förbättra starttiden.
          </div>
        )}
        
        {/* No data yet */}
        {channelCount === 0 && (
          <div className="text-center py-3 text-muted-foreground text-sm">
            Ingen data att visa ännu. Lägg till en provider för att se mätvärden.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
