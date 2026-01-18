/**
 * Playback Test Lab
 * A development/testing page for verifying playback engines on different platforms
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  Download, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Info,
  Smartphone,
  Monitor,
  Tv,
  Zap,
  Clock,
  AlertTriangle,
  Copy,
  Settings,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  NativePlayback, 
  isNativePlatform, 
  getPlatform, 
  hashUrlForLog,
  type PlaybackState,
} from '@/player/NativePlaybackPlugin';
import { 
  performPreflightAsync, 
  type PreflightResult,
  getStrategyLabel,
} from '@/player/PlaybackPreflight';
import Hls from 'hls.js';

// ============= Types =============

interface TestResult {
  id: string;
  timestamp: Date;
  engine: 'web-hls' | 'web-shaka' | 'native-exo' | 'native-av';
  url: string;
  urlHash: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  timeToFirstFrame?: number;
  bufferingEvents: number;
  preflightResult?: PreflightResult;
  platform: 'web' | 'android' | 'ios';
}

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

// ============= Component =============

export default function PlaybackTestLab() {
  const [streamUrl, setStreamUrl] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [nativeState, setNativeState] = useState<PlaybackState | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const testStartTime = useRef<number>(0);
  const bufferingCount = useRef<number>(0);
  
  const platform = getPlatform();
  const isNative = isNativePlatform();
  
  // ============= Logging =============
  
  const log = useCallback((level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), level, message }]);
  }, []);
  
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);
  
  // ============= Test Functions =============
  
  const runPreflightCheck = useCallback(async (url: string): Promise<PreflightResult> => {
    log('info', 'Running preflight check...');
    
    const result = await performPreflightAsync({
      streamUrl: url,
    });
    
    log('info', `Preflight result: ${result.diagnosticCode}`);
    result.availableStrategies.forEach(s => {
      log('info', `  Strategy available: ${getStrategyLabel(s)}`);
    });
    
    return result;
  }, [log]);
  
  const testWebHls = useCallback(async (url: string, preflight: PreflightResult) => {
    const testId = `web-hls-${Date.now()}`;
    setCurrentTest(testId);
    bufferingCount.current = 0;
    
    log('info', '=== Testing Web HLS Engine ===');
    
    // Determine which URL to use based on preflight
    let testUrl = url;
    if (preflight.resolvedUrl && preflight.details.httpsUpgradeSucceeded) {
      testUrl = preflight.resolvedUrl;
      log('info', 'Using HTTPS-upgraded URL');
    } else if (preflight.resolvedUrl && preflight.isMixedContentBlocked) {
      testUrl = preflight.resolvedUrl;
      log('info', 'Using proxy URL for mixed content');
    }
    
    return new Promise<TestResult>((resolve) => {
      const video = videoRef.current;
      if (!video) {
        resolve({
          id: testId,
          timestamp: new Date(),
          engine: 'web-hls',
          url,
          urlHash: hashUrlForLog(url),
          success: false,
          errorCode: 'NO_VIDEO_ELEMENT',
          errorMessage: 'Video element not found',
          bufferingEvents: 0,
          preflightResult: preflight,
          platform,
        });
        return;
      }
      
      // Cleanup any existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
      testStartTime.current = performance.now();
      
      const onFirstFrame = () => {
        const ttff = Math.round(performance.now() - testStartTime.current);
        log('success', `First frame rendered in ${ttff}ms`);
        
        // Let it play for a bit to count buffering events
        setTimeout(() => {
          video.pause();
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          
          resolve({
            id: testId,
            timestamp: new Date(),
            engine: 'web-hls',
            url,
            urlHash: hashUrlForLog(url),
            success: true,
            timeToFirstFrame: ttff,
            bufferingEvents: bufferingCount.current,
            preflightResult: preflight,
            platform,
          });
        }, 5000); // Test for 5 seconds
        
        video.removeEventListener('playing', onFirstFrame);
      };
      
      const onError = (e: Event) => {
        const error = (e as ErrorEvent).error || video.error;
        log('error', `Video error: ${error?.message || 'Unknown error'}`);
        
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        
        resolve({
          id: testId,
          timestamp: new Date(),
          engine: 'web-hls',
          url,
          urlHash: hashUrlForLog(url),
          success: false,
          errorCode: error?.code?.toString() || 'UNKNOWN',
          errorMessage: error?.message || 'Unknown playback error',
          bufferingEvents: bufferingCount.current,
          preflightResult: preflight,
          platform,
        });
        
        video.removeEventListener('playing', onFirstFrame);
        video.removeEventListener('error', onError);
      };
      
      const onWaiting = () => {
        bufferingCount.current++;
        log('warn', `Buffering event #${bufferingCount.current}`);
      };
      
      video.addEventListener('playing', onFirstFrame);
      video.addEventListener('error', onError);
      video.addEventListener('waiting', onWaiting);
      
      // Try native HLS first (Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        log('info', 'Using native HLS support');
        video.src = testUrl;
        video.play().catch(err => {
          log('error', `Play failed: ${err.message}`);
        });
      } else if (Hls.isSupported()) {
        log('info', 'Using Hls.js');
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: isLive,
          debug: false,
        });
        hlsRef.current = hls;
        
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            log('error', `HLS fatal error: ${data.type} - ${data.details}`);
            resolve({
              id: testId,
              timestamp: new Date(),
              engine: 'web-hls',
              url,
              urlHash: hashUrlForLog(url),
              success: false,
              errorCode: data.type,
              errorMessage: data.details,
              bufferingEvents: bufferingCount.current,
              preflightResult: preflight,
              platform,
            });
          } else {
            log('warn', `HLS recoverable error: ${data.details}`);
          }
        });
        
        hls.loadSource(testUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          log('info', 'Manifest parsed, starting playback');
          video.play().catch(err => {
            log('error', `Play failed: ${err.message}`);
          });
        });
      } else {
        log('error', 'No HLS support available');
        resolve({
          id: testId,
          timestamp: new Date(),
          engine: 'web-hls',
          url,
          urlHash: hashUrlForLog(url),
          success: false,
          errorCode: 'NO_HLS_SUPPORT',
          errorMessage: 'Browser does not support HLS playback',
          bufferingEvents: 0,
          preflightResult: preflight,
          platform,
        });
      }
    });
  }, [platform, isLive, log]);
  
  const testNativeEngine = useCallback(async (url: string, preflight: PreflightResult) => {
    const engine = platform === 'android' ? 'native-exo' : 'native-av';
    const testId = `${engine}-${Date.now()}`;
    setCurrentTest(testId);
    bufferingCount.current = 0;
    
    log('info', `=== Testing Native ${platform === 'android' ? 'ExoPlayer' : 'AVPlayer'} ===`);
    
    try {
      testStartTime.current = performance.now();
      
      // Register event listeners
      const stateListener = await NativePlayback.addListener('stateChange', (event) => {
        setNativeState(event.state);
        log('info', `State: ${event.state.status}`);
      });
      
      const bufferListener = await NativePlayback.addListener('buffering', (event) => {
        if (event.isBuffering) {
          bufferingCount.current++;
          log('warn', `Buffering event #${bufferingCount.current}`);
        }
      });
      
      const errorListener = await NativePlayback.addListener('error', (event) => {
        log('error', `Native error: ${event.error.code} - ${event.error.message}`);
      });
      
      // Load and play
      await NativePlayback.load({
        stream: {
          url,
          isLive,
          title: 'Test Stream',
        },
        autoPlay: true,
      });
      
      // Wait for first frame
      const ttff = await new Promise<number>((resolve) => {
        const checkState = async () => {
          const state = await NativePlayback.getState();
          if (state.status === 'playing') {
            resolve(Math.round(performance.now() - testStartTime.current));
          } else if (state.status === 'error') {
            resolve(-1);
          } else {
            setTimeout(checkState, 100);
          }
        };
        checkState();
      });
      
      if (ttff === -1) {
        throw new Error('Playback failed to start');
      }
      
      log('success', `First frame in ${ttff}ms`);
      
      // Let it play for 5 seconds
      await new Promise(r => setTimeout(r, 5000));
      
      // Cleanup
      await NativePlayback.stop();
      stateListener.remove();
      bufferListener.remove();
      errorListener.remove();
      
      return {
        id: testId,
        timestamp: new Date(),
        engine,
        url,
        urlHash: hashUrlForLog(url),
        success: true,
        timeToFirstFrame: ttff,
        bufferingEvents: bufferingCount.current,
        preflightResult: preflight,
        platform,
      } as TestResult;
      
    } catch (err) {
      const error = err as Error;
      log('error', `Native test failed: ${error.message}`);
      
      return {
        id: testId,
        timestamp: new Date(),
        engine,
        url,
        urlHash: hashUrlForLog(url),
        success: false,
        errorCode: 'NATIVE_ERROR',
        errorMessage: error.message,
        bufferingEvents: bufferingCount.current,
        preflightResult: preflight,
        platform,
      } as TestResult;
    }
  }, [platform, isLive, log]);
  
  // ============= Actions =============
  
  const runWebTest = async () => {
    if (!streamUrl.trim()) {
      toast.error('Please enter a stream URL');
      return;
    }
    
    setIsTesting(true);
    clearLogs();
    
    try {
      const preflight = await runPreflightCheck(streamUrl);
      const result = await testWebHls(streamUrl, preflight);
      setTestResults(prev => [result, ...prev]);
      
      if (result.success) {
        toast.success(`Web test passed! TTFF: ${result.timeToFirstFrame}ms`);
      } else {
        toast.error(`Web test failed: ${result.errorMessage}`);
      }
    } catch (err) {
      log('error', `Test error: ${(err as Error).message}`);
    } finally {
      setIsTesting(false);
      setCurrentTest(null);
    }
  };
  
  const runNativeTest = async () => {
    if (!streamUrl.trim()) {
      toast.error('Please enter a stream URL');
      return;
    }
    
    if (!isNative) {
      toast.error('Native testing requires running in Capacitor');
      return;
    }
    
    setIsTesting(true);
    clearLogs();
    
    try {
      const preflight = await runPreflightCheck(streamUrl);
      const result = await testNativeEngine(streamUrl, preflight);
      setTestResults(prev => [result, ...prev]);
      
      if (result.success) {
        toast.success(`Native test passed! TTFF: ${result.timeToFirstFrame}ms`);
      } else {
        toast.error(`Native test failed: ${result.errorMessage}`);
      }
    } catch (err) {
      log('error', `Test error: ${(err as Error).message}`);
    } finally {
      setIsTesting(false);
      setCurrentTest(null);
    }
  };
  
  const exportDebugReport = useCallback(() => {
    const report = {
      generatedAt: new Date().toISOString(),
      platform,
      isNativePlatform: isNative,
      userAgent: navigator.userAgent,
      results: testResults.map(r => ({
        ...r,
        url: undefined, // Remove actual URL
        urlHash: r.urlHash,
      })),
      logs: logs.map(l => ({
        timestamp: l.timestamp.toISOString(),
        level: l.level,
        message: l.message,
      })),
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playback-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Debug report exported');
  }, [platform, isNative, testResults, logs]);
  
  const copyUrlHash = useCallback((url: string) => {
    navigator.clipboard.writeText(hashUrlForLog(url));
    toast.success('URL hash copied');
  }, []);
  
  // ============= Cleanup =============
  
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);
  
  // ============= Render =============
  
  return (
    <AppLayout>
      <div className="container max-w-6xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="w-6 h-6" />
              Playback Test Lab
            </h1>
            <p className="text-muted-foreground">
              Test and debug playback engines on different platforms
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={isNative ? 'default' : 'secondary'}>
              {platform === 'android' && <Smartphone className="w-3 h-3 mr-1" />}
              {platform === 'ios' && <Smartphone className="w-3 h-3 mr-1" />}
              {platform === 'web' && <Monitor className="w-3 h-3 mr-1" />}
              {platform.toUpperCase()}
            </Badge>
            {isNative && (
              <Badge variant="outline" className="text-green-500 border-green-500">
                Native Mode
              </Badge>
            )}
          </div>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Stream Configuration</CardTitle>
              <CardDescription>Enter a stream URL to test playback</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="streamUrl">Stream URL</Label>
                <Input
                  id="streamUrl"
                  type="url"
                  placeholder="https://example.com/stream.m3u8"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  disabled={isTesting}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="isLive">Live Stream</Label>
                <Switch
                  id="isLive"
                  checked={isLive}
                  onCheckedChange={setIsLive}
                  disabled={isTesting}
                />
              </div>
              
              <Separator />
              
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={runWebTest}
                  disabled={isTesting || !streamUrl.trim()}
                  className="flex-1"
                >
                  {isTesting && currentTest?.startsWith('web') ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Test Web Engine
                </Button>
                
                <Button
                  onClick={runNativeTest}
                  disabled={isTesting || !streamUrl.trim() || !isNative}
                  variant={isNative ? 'default' : 'secondary'}
                  className="flex-1"
                >
                  {isTesting && currentTest?.startsWith('native') ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Tv className="w-4 h-4 mr-2" />
                  )}
                  Test Native Engine
                </Button>
              </div>
              
              {!isNative && (
                <p className="text-xs text-muted-foreground text-center">
                  Native testing requires running in Capacitor (Android/iOS)
                </p>
              )}
            </CardContent>
          </Card>
          
          {/* Video Preview */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>Video playback area for web engine testing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full"
                  playsInline
                  muted
                />
              </div>
              
              {nativeState && isNative && (
                <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm">
                  <p className="font-medium mb-2">Native Player State:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Status: {nativeState.status}</div>
                    <div>Time: {nativeState.currentTime.toFixed(1)}s</div>
                    <div>Duration: {nativeState.duration.toFixed(1)}s</div>
                    <div>Buffered: {nativeState.bufferedPosition.toFixed(1)}s</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Results & Logs */}
        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">Test Results</TabsTrigger>
            <TabsTrigger value="logs">Console Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="results">
            <Card variant="glass">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Results ({testResults.length})</CardTitle>
                  <CardDescription>History of playback tests</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportDebugReport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {testResults.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No tests run yet. Enter a URL and click test.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {testResults.map((result) => (
                        <div
                          key={result.id}
                          className={`p-4 rounded-lg border ${
                            result.success 
                              ? 'border-green-500/30 bg-green-500/5' 
                              : 'border-red-500/30 bg-red-500/5'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {result.success ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                              )}
                              <div>
                                <p className="font-medium">
                                  {result.engine.toUpperCase()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {result.timestamp.toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => copyUrlHash(result.url)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Badge variant="outline">{result.platform}</Badge>
                            </div>
                          </div>
                          
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span>
                                TTFF: {result.timeToFirstFrame ?? 'N/A'}ms
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                              <span>
                                Buffering: {result.bufferingEvents}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Zap className="w-4 h-4 text-muted-foreground" />
                              <span>
                                {result.preflightResult?.diagnosticCode ?? 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Info className="w-4 h-4" />
                              <span className="truncate" title={result.urlHash}>
                                {result.urlHash}
                              </span>
                            </div>
                          </div>
                          
                          {!result.success && result.errorMessage && (
                            <div className="mt-2 p-2 rounded bg-red-500/10 text-red-400 text-sm">
                              {result.errorCode}: {result.errorMessage}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="logs">
            <Card variant="glass">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Console Logs</CardTitle>
                  <CardDescription>Real-time playback diagnostics</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={clearLogs}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="font-mono text-xs space-y-1">
                    {logs.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        Logs will appear here during tests
                      </div>
                    ) : (
                      logs.map((entry, i) => (
                        <div
                          key={i}
                          className={`py-1 px-2 rounded ${
                            entry.level === 'error' ? 'bg-red-500/10 text-red-400' :
                            entry.level === 'warn' ? 'bg-yellow-500/10 text-yellow-400' :
                            entry.level === 'success' ? 'bg-green-500/10 text-green-400' :
                            'text-muted-foreground'
                          }`}
                        >
                          <span className="opacity-50">
                            [{entry.timestamp.toLocaleTimeString()}]
                          </span>{' '}
                          {entry.message}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Platform Info */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Platform Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium">Platform</p>
                <p className="text-muted-foreground">{platform}</p>
              </div>
              <div>
                <p className="font-medium">Native Mode</p>
                <p className="text-muted-foreground">{isNative ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="font-medium">HLS.js Support</p>
                <p className="text-muted-foreground">{Hls.isSupported() ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="font-medium">Native HLS</p>
                <p className="text-muted-foreground">
                  {videoRef.current?.canPlayType('application/vnd.apple.mpegurl') ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="font-medium">Page Protocol</p>
                <p className="text-muted-foreground">{window.location.protocol}</p>
              </div>
              <div>
                <p className="font-medium">User Agent</p>
                <p className="text-muted-foreground truncate" title={navigator.userAgent}>
                  {navigator.userAgent.slice(0, 50)}...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
