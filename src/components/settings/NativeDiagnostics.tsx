/**
 * NativeDiagnostics - Debug screen for Android native playback
 * Shows plugin availability, platform info, and test playback
 */

import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  Play,
  RefreshCw,
  Smartphone,
  Server,
  Cpu,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  isNativePlatform, 
  getPlatform, 
  NativePlayback,
} from '@/player/NativePlaybackPlugin';
import { toast } from 'sonner';

interface DiagnosticCheck {
  id: string;
  label: string;
  status: 'pending' | 'checking' | 'success' | 'error' | 'warning';
  message?: string;
  details?: string;
}

// Test stream URL (Big Buck Bunny - public domain)
const TEST_STREAM_URL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

export function NativeDiagnostics() {
  const [checks, setChecks] = useState<DiagnosticCheck[]>([
    { id: 'platform', label: 'Platform Detection', status: 'pending' },
    { id: 'capacitor', label: 'Capacitor Runtime', status: 'pending' },
    { id: 'native-playback', label: 'NativePlayback Plugin', status: 'pending' },
    { id: 'vlc-playback', label: 'VlcPlayback Plugin', status: 'pending' },
    { id: 'exoplayer', label: 'ExoPlayer Info', status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [testPlaybackStatus, setTestPlaybackStatus] = useState<string | null>(null);

  const updateCheck = (id: string, update: Partial<DiagnosticCheck>) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, ...update } : c));
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    
    // Reset all checks
    setChecks(prev => prev.map(c => ({ ...c, status: 'pending', message: undefined, details: undefined })));

    // 1. Platform Detection
    updateCheck('platform', { status: 'checking' });
    await new Promise(r => setTimeout(r, 200));
    const platform = getPlatform();
    const isNative = isNativePlatform();
    updateCheck('platform', {
      status: platform === 'android' ? 'success' : isNative ? 'warning' : 'error',
      message: `Platform: ${platform}, Native: ${isNative}`,
      details: platform === 'web' ? 'Appen körs i webbläsaren, inte som native app' : undefined,
    });

    // 2. Capacitor Runtime - with detailed bridge inspection
    updateCheck('capacitor', { status: 'checking' });
    await new Promise(r => setTimeout(r, 200));
    try {
      const cap = (window as any).Capacitor;
      const capBridge = (window as any).CapacitorBridge;
      
      // Log raw state for debugging
      console.log('[NativeDiagnostics] window.Capacitor:', cap);
      console.log('[NativeDiagnostics] window.CapacitorBridge:', capBridge);
      console.log('[NativeDiagnostics] Capacitor.Plugins:', cap?.Plugins);
      console.log('[NativeDiagnostics] Capacitor.getPlatform:', cap?.getPlatform?.());
      console.log('[NativeDiagnostics] Capacitor.isNativePlatform:', cap?.isNativePlatform?.());
      
      if (cap) {
        const plugins = cap.Plugins || {};
        const registeredPlugins = cap.registeredPlugins?.list?.() || [];
        const pluginCount = Object.keys(plugins).length;
        const hasNativePlayback = 'NativePlayback' in plugins || registeredPlugins.includes('NativePlayback');
        
        console.log('[NativeDiagnostics] Registered plugins:', registeredPlugins);
        console.log('[NativeDiagnostics] Plugin keys:', Object.keys(plugins));
        console.log('[NativeDiagnostics] Has NativePlayback:', hasNativePlayback);
        
        updateCheck('capacitor', {
          status: hasNativePlayback ? 'success' : 'warning',
          message: `Capacitor finns, ${pluginCount} plugins`,
          details: hasNativePlayback 
            ? `NativePlayback registrerad ✓ | Alla: ${Object.keys(plugins).join(', ') || 'Inga'}`
            : `NativePlayback SAKNAS! | Finns: ${Object.keys(plugins).join(', ') || 'Inga'}`,
        });
      } else {
        updateCheck('capacitor', {
          status: 'error',
          message: 'Capacitor runtime hittades inte',
          details: 'window.Capacitor är undefined. Appen körs troligen i webbläsaren eller dev-server.',
        });
      }
    } catch (e) {
      updateCheck('capacitor', {
        status: 'error',
        message: 'Fel vid kontroll av Capacitor',
        details: String(e),
      });
    }

    // 3. NativePlayback Plugin
    updateCheck('native-playback', { status: 'checking' });
    await new Promise(r => setTimeout(r, 200));
    try {
      const info = await NativePlayback.getEngineInfo();
      if (info && info.platform === 'android') {
        updateCheck('native-playback', {
          status: 'success',
          message: `${info.name} v${info.version}`,
          details: `Nativt uppspelningsstöd aktivt på ${info.platform}`,
        });
      } else if (info) {
        updateCheck('native-playback', {
          status: 'warning',
          message: `Webbfallback aktiv`,
          details: 'Native plugin inte tillgängligt, använder web-implementering',
        });
      } else {
        updateCheck('native-playback', {
          status: 'error',
          message: 'Ingen respons från plugin',
        });
      }
    } catch (e: any) {
      const isNotImplemented = e?.message?.includes('not implemented') || 
                               e?.code === 'UNIMPLEMENTED';
      updateCheck('native-playback', {
        status: 'error',
        message: isNotImplemented 
          ? 'Plugin ej implementerat på Android' 
          : 'Kunde inte ansluta till plugin',
        details: isNotImplemented
          ? 'Pluginet är inte registrerat. Kör: git pull, npm run build, npx cap sync android, öppna i Android Studio och bygg.'
          : String(e?.message || e),
      });
    }

    // 4. VLC Plugin
    updateCheck('vlc-playback', { status: 'checking' });
    await new Promise(r => setTimeout(r, 200));
    try {
      const { registerPlugin } = await import('@capacitor/core');
      const VlcPlayback = registerPlugin<any>('VlcPlayback');
      const vlcInfo = await VlcPlayback.getEngineInfo();
      if (vlcInfo && vlcInfo.engine === 'libvlc') {
        updateCheck('vlc-playback', {
          status: 'success',
          message: `libVLC v${vlcInfo.version}`,
          details: `MKV, AC3, DTS, HEVC stöd aktivt`,
        });
      } else {
        updateCheck('vlc-playback', {
          status: 'warning',
          message: 'VLC fallback ej aktiv',
          details: 'Kommer använda webbimplementering',
        });
      }
    } catch (e: any) {
      updateCheck('vlc-playback', {
        status: 'warning',
        message: 'VLC-plugin ej tillgängligt',
        details: 'Detta är okej - VLC är reservmotor för tunga format',
      });
    }

    // 5. ExoPlayer detailed
    updateCheck('exoplayer', { status: 'checking' });
    await new Promise(r => setTimeout(r, 200));
    if (platform === 'android' && isNative) {
      try {
        const info = await NativePlayback.getEngineInfo();
        updateCheck('exoplayer', {
          status: 'success',
          message: `ExoPlayer redo`,
          details: `Media3 v${info?.version || 'okänd'}, HLS/DASH/MP4/MKV/TS stöd`,
        });
      } catch {
        updateCheck('exoplayer', {
          status: 'error',
          message: 'ExoPlayer inte tillgänglig',
          details: 'Native plugin måste vara korrekt registrerat',
        });
      }
    } else {
      updateCheck('exoplayer', {
        status: 'warning',
        message: 'ExoPlayer endast på Android',
        details: 'Kör appen på en Android-enhet för att använda ExoPlayer',
      });
    }

    setIsRunning(false);
  };

  const testPlayback = async () => {
    setTestPlaybackStatus('loading');
    try {
      await NativePlayback.load({
        stream: {
          url: TEST_STREAM_URL,
          mimeType: 'application/x-mpegURL',
          isLive: false,
          title: 'Test Stream',
        },
        autoPlay: true,
      });
      setTestPlaybackStatus('success');
      toast.success('Testuppspelning startad!');
      
      // Stop after 5 seconds
      setTimeout(async () => {
        try {
          await NativePlayback.stop();
          setTestPlaybackStatus(null);
        } catch (e) {
          console.warn('Could not stop test playback:', e);
        }
      }, 5000);
    } catch (e: any) {
      setTestPlaybackStatus('error');
      toast.error(`Testuppspelning misslyckades: ${e?.message || 'Okänt fel'}`);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: DiagnosticCheck['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'checking':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      default:
        return <div className="w-5 h-5 rounded-full bg-muted" />;
    }
  };

  const allSuccess = checks.every(c => c.status === 'success');
  const hasErrors = checks.some(c => c.status === 'error');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              Native Playback Diagnostik
            </CardTitle>
            <CardDescription>
              Kontrollera att Android-uppspelning är korrekt konfigurerad
            </CardDescription>
          </div>
          <Badge variant={allSuccess ? 'default' : hasErrors ? 'destructive' : 'secondary'}>
            {allSuccess ? 'Allt OK' : hasErrors ? 'Problem upptäckta' : 'Varningar'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Check results */}
        <div className="space-y-3">
          {checks.map(check => (
            <div key={check.id} className="flex items-start gap-3">
              {getStatusIcon(check.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{check.label}</span>
                  {check.message && (
                    <span className="text-xs text-muted-foreground">
                      — {check.message}
                    </span>
                  )}
                </div>
                {check.details && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {check.details}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={runDiagnostics}
            disabled={isRunning}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRunning && "animate-spin")} />
            Kör igen
          </Button>

          {!hasErrors && getPlatform() === 'android' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={testPlayback}
              disabled={testPlaybackStatus === 'loading'}
            >
              {testPlaybackStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Testa uppspelning
            </Button>
          )}
        </div>

        {/* Help section */}
        {hasErrors && (
          <div className="p-3 bg-muted rounded-lg">
            <h4 className="font-medium text-sm mb-2">Felsökning</h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Kör <code className="bg-background px-1 rounded">git pull</code> för att hämta senaste koden</li>
              <li>Kör <code className="bg-background px-1 rounded">npm run build</code> för att bygga</li>
              <li>Kör <code className="bg-background px-1 rounded">npx cap sync android</code></li>
              <li>Öppna <code className="bg-background px-1 rounded">android/</code> i Android Studio</li>
              <li>Build → Clean Project → Rebuild Project</li>
              <li>Kör appen på enhet/emulator</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default NativeDiagnostics;
