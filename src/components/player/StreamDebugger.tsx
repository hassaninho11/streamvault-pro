/**
 * StreamDebugger - Dev-only tool for testing stream URLs
 * Shows diagnostic info without leaking full URLs
 */

import { useState, useCallback } from 'react';
import {
  Bug,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Lock,
  Globe,
  List,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  performPreflightAsync,
  PreflightResult,
  hashUrlForLogging,
  isHlsUrl,
  tryHttpsUpgrade,
  buildProxyUrl,
} from '@/player/PlaybackPreflight';
import { getCastController } from '@/player/CastController';

const isDev = import.meta.env.DEV;

interface StreamTestResult {
  url: string;
  maskedUrl: string;
  timestamp: Date;
  preflight: PreflightResult;
  httpTest: {
    status: number | null;
    contentType: string | null;
    error: string | null;
    latencyMs: number;
  };
  httpsUpgrade: {
    attempted: boolean;
    success: boolean;
    latencyMs: number;
  };
  hlsAnalysis: {
    isHls: boolean;
    segmentCount: number;
    variantCount: number;
    hasKey: boolean;
    hasMap: boolean;
  } | null;
}

export function StreamDebugger() {
  const [isOpen, setIsOpen] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<StreamTestResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyReport = useCallback(() => {
    if (!result) return;
    
    // Create anonymous debug report
    const report = {
      timestamp: result.timestamp.toISOString(),
      platform: result.preflight.platform,
      diagnosticCode: result.preflight.diagnosticCode,
      canPlayDirect: result.preflight.canPlayDirect,
      recommendedStrategy: result.preflight.recommendedStrategy,
      httpStatus: result.httpTest.status,
      contentType: result.httpTest.contentType,
      latencyMs: result.httpTest.latencyMs,
      httpsUpgrade: result.httpsUpgrade,
      isHls: result.hlsAnalysis?.isHls ?? false,
      variantCount: result.hlsAnalysis?.variantCount ?? 0,
      hasEncryption: result.hlsAnalysis?.hasKey ?? false,
    };
    
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const runTest = useCallback(async () => {
    if (!testUrl.trim()) return;
    
    setIsTesting(true);
    setResult(null);
    
    const startTime = performance.now();
    
    try {
      // Mask URL for display
      const maskedUrl = hashUrlForLogging(testUrl);
      
      // Run preflight check
      const castController = getCastController();
      const preflight = await performPreflightAsync({
        streamUrl: testUrl,
        sourceType: 'live',
        hasChromecast: castController.isChromecastAvailable(),
        hasAirPlay: castController.isAirPlayAvailable(),
      });
      
      // Test HTTP request
      let httpStatus: number | null = null;
      let contentType: string | null = null;
      let httpError: string | null = null;
      const httpStartTime = performance.now();
      
      try {
        // Use proxy for HTTP on HTTPS to avoid mixed content
        let fetchUrl = testUrl;
        if (preflight.isMixedContentBlocked) {
          const proxyUrl = buildProxyUrl(testUrl);
          if (proxyUrl) fetchUrl = proxyUrl;
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(fetchUrl, {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'cors',
        });
        
        clearTimeout(timeoutId);
        httpStatus = response.status;
        contentType = response.headers.get('content-type');
      } catch (e) {
        httpError = e instanceof Error ? e.message : 'Unknown error';
      }
      
      const httpLatency = Math.round(performance.now() - httpStartTime);
      
      // Test HTTPS upgrade
      let httpsUpgradeAttempted = false;
      let httpsUpgradeSuccess = false;
      let httpsLatency = 0;
      
      if (testUrl.startsWith('http://')) {
        httpsUpgradeAttempted = true;
        const upgradeStartTime = performance.now();
        const upgraded = await tryHttpsUpgrade(testUrl, 3000);
        httpsLatency = Math.round(performance.now() - upgradeStartTime);
        httpsUpgradeSuccess = upgraded !== null;
      }
      
      // Analyze HLS if applicable
      let hlsAnalysis = null;
      
      if (isHlsUrl(testUrl) && contentType?.includes('mpegurl')) {
        try {
          let fetchUrl = testUrl;
          if (preflight.isMixedContentBlocked) {
            const proxyUrl = buildProxyUrl(testUrl);
            if (proxyUrl) fetchUrl = proxyUrl;
          }
          
          const response = await fetch(fetchUrl, { mode: 'cors' });
          const text = await response.text();
          
          const lines = text.split('\n');
          const segmentLines = lines.filter(l => !l.startsWith('#') && l.trim().length > 0);
          const variantLines = lines.filter(l => l.includes('#EXT-X-STREAM-INF'));
          const hasKey = lines.some(l => l.includes('#EXT-X-KEY'));
          const hasMap = lines.some(l => l.includes('#EXT-X-MAP'));
          
          hlsAnalysis = {
            isHls: true,
            segmentCount: segmentLines.length,
            variantCount: variantLines.length,
            hasKey,
            hasMap,
          };
        } catch {
          hlsAnalysis = {
            isHls: isHlsUrl(testUrl),
            segmentCount: 0,
            variantCount: 0,
            hasKey: false,
            hasMap: false,
          };
        }
      }
      
      setResult({
        url: testUrl,
        maskedUrl,
        timestamp: new Date(),
        preflight,
        httpTest: {
          status: httpStatus,
          contentType,
          error: httpError,
          latencyMs: httpLatency,
        },
        httpsUpgrade: {
          attempted: httpsUpgradeAttempted,
          success: httpsUpgradeSuccess,
          latencyMs: httpsLatency,
        },
        hlsAnalysis,
      });
      
    } catch (error) {
      console.error('[StreamDebugger] Test failed:', error);
    } finally {
      setIsTesting(false);
    }
  }, [testUrl]);

  if (!isDev) return null;

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-4 left-4 z-50",
          "bg-background/80 backdrop-blur-sm border border-border",
          isOpen && "bg-primary/20"
        )}
        title="Stream Debugger"
      >
        <Bug className="w-5 h-5" />
      </Button>

      {/* Debugger Panel */}
      {isOpen && (
        <div className={cn(
          "fixed bottom-16 left-4 z-50 w-96",
          "bg-background/95 backdrop-blur-lg rounded-xl border border-border",
          "shadow-xl overflow-hidden"
        )}>
          <CardHeader className="py-3 px-4 bg-muted/50 border-b border-border">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bug className="w-4 h-4 text-primary" />
              Stream Debugger
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* URL Input */}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Ange stream URL..."
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={runTest}
                disabled={isTesting || !testUrl.trim()}
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            {/* Results */}
            {result && (
              <div className="space-y-3">
                {/* Summary */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  {result.preflight.canPlayDirect ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : result.preflight.recommendedStrategy === 'proxy_https' ? (
                    <Shield className="w-5 h-5 text-primary" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-warning" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {result.preflight.canPlayDirect ? 'Direkt spelbar' : 
                       result.preflight.recommendedStrategy === 'upgraded_https' ? 'HTTPS upgrade möjlig' :
                       result.preflight.recommendedStrategy === 'proxy_https' ? 'Proxy krävs' :
                       'Fallback krävs'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.maskedUrl}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {result.preflight.diagnosticCode}
                  </Badge>
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/30">
                    <div className="text-muted-foreground">HTTP Status</div>
                    <div className={cn(
                      "font-mono",
                      result.httpTest.status && result.httpTest.status < 400 ? "text-green-500" : "text-destructive"
                    )}>
                      {result.httpTest.status ?? result.httpTest.error ?? 'N/A'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <div className="text-muted-foreground">Latency</div>
                    <div className="font-mono">{result.httpTest.latencyMs}ms</div>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <div className="text-muted-foreground">HTTPS Upgrade</div>
                    <div className="flex items-center gap-1">
                      {result.httpsUpgrade.attempted ? (
                        result.httpsUpgrade.success ? (
                          <>
                            <Lock className="w-3 h-3 text-green-500" />
                            <span className="text-green-500">Ja</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-destructive" />
                            <span className="text-destructive">Nej</span>
                          </>
                        )
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <div className="text-muted-foreground">Content-Type</div>
                    <div className="font-mono text-xs truncate">
                      {result.httpTest.contentType?.split(';')[0] ?? 'N/A'}
                    </div>
                  </div>
                </div>
                
                {/* HLS Analysis */}
                {result.hlsAnalysis && (
                  <div className="p-3 rounded bg-muted/30 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <List className="w-4 h-4" />
                      HLS Analys
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Segment: <span className="font-mono">{result.hlsAnalysis.segmentCount}</span></div>
                      <div>Varianter: <span className="font-mono">{result.hlsAnalysis.variantCount}</span></div>
                      <div>Kryptering: <span className="font-mono">{result.hlsAnalysis.hasKey ? 'Ja' : 'Nej'}</span></div>
                      <div>Init Map: <span className="font-mono">{result.hlsAnalysis.hasMap ? 'Ja' : 'Nej'}</span></div>
                    </div>
                  </div>
                )}
                
                {/* Detailed Info Toggle */}
                <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between">
                      <span>Detaljer</span>
                      {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                      {JSON.stringify({
                        platform: result.preflight.platform,
                        strategy: result.preflight.recommendedStrategy,
                        available: result.preflight.availableStrategies,
                        details: result.preflight.details,
                      }, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
                
                {/* Copy Report Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={copyReport}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Kopierad!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Kopiera debug-rapport
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </div>
      )}
    </>
  );
}

export default StreamDebugger;
