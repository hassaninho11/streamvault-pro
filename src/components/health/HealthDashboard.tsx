/**
 * Health Dashboard Component - Shows channel stability and diagnostics
 */

import { useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { channelHealthService, ChannelHealth } from "@/services/ChannelHealthService";

interface HealthDashboardProps {
  className?: string;
}

export function HealthDashboard({ className }: HealthDashboardProps) {
  const [summary, setSummary] = useState(channelHealthService.getSummary());
  const [unhealthy, setUnhealthy] = useState<ChannelHealth[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const update = () => {
      setSummary(channelHealthService.getSummary());
      setUnhealthy(channelHealthService.getUnhealthy());
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate health check
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSummary(channelHealthService.getSummary());
    setUnhealthy(channelHealthService.getUnhealthy());
    setIsRefreshing(false);
  };

  const handleExport = () => {
    const report = channelHealthService.exportDebugReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `streamvault-health-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: ChannelHealth['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'offline':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'unstable':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: ChannelHealth['status']) => {
    switch (status) {
      case 'online':
        return 'text-success';
      case 'offline':
        return 'text-destructive';
      case 'unstable':
        return 'text-warning';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Health Dashboard
          </h2>
          <p className="text-muted-foreground">
            Monitor channel stability and performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button 
            variant="glow" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Check Now
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Wifi className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.online}</p>
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.unstable}</p>
                <p className="text-xs text-muted-foreground">Unstable</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <WifiOff className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.offline}</p>
                <p className="text-xs text-muted-foreground">Offline</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.avgStability}%</p>
                <p className="text-xs text-muted-foreground">Avg. Stability</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Stability */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-lg">Overall Stability</CardTitle>
          <CardDescription>
            Based on {summary.total} monitored channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Stability Score</span>
              <span className="font-semibold">{summary.avgStability}%</span>
            </div>
            <Progress value={summary.avgStability} className="h-3" />
            <div className="flex items-center gap-4 text-sm">
              {summary.avgStability >= 90 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-success">Excellent performance</span>
                </>
              ) : summary.avgStability >= 70 ? (
                <>
                  <Activity className="w-4 h-4 text-warning" />
                  <span className="text-warning">Some channels need attention</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-destructive" />
                  <span className="text-destructive">Multiple issues detected</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unhealthy Channels */}
      {unhealthy.length > 0 && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Channels Needing Attention
            </CardTitle>
            <CardDescription>
              {unhealthy.length} channels with issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {unhealthy.map((health) => (
                  <div
                    key={health.channelId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(health.status)}
                      <div>
                        <p className="font-medium text-sm">
                          Channel {health.channelId.slice(0, 8)}...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {health.lastError || 'Unknown error'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="outline" 
                        className={cn("capitalize", getStatusColor(health.status))}
                      >
                        {health.status}
                      </Badge>
                      <span className="text-sm font-mono">
                        {health.stabilityScore}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Info Note */}
      <Card variant="glass" className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-primary mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">
                About Health Monitoring
              </p>
              <p>
                StreamVault monitors your channels during playback and tracks stability.
                Channels are rated based on successful connections, load times, and 
                buffering events. This data stays on your device.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default HealthDashboard;
