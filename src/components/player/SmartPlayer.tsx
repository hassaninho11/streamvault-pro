/**
 * SmartPlayer - Platform-aware video player component
 * 
 * CRITICAL: On Android, ALL playback MUST use native ExoPlayer/VLC
 * WebView video playback is NOT allowed for IPTV content
 * 
 * This component routes playback to the correct player based on platform:
 * - Android: NativePlayerView (ExoPlayer with VLC fallback)
 * - Web/Desktop: VideoPlayer (HLS.js)
 */

import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Channel } from '@/types/iptv';
import { isNativePlatform, getPlatform, NativePlayback } from '@/player/NativePlaybackPlugin';
import { NativePlayerView } from './NativePlayerView';
import { Loader2, AlertTriangle, ExternalLink, RefreshCw, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

// Lazy load VideoPlayer only on web to reduce bundle size for native apps
const VideoPlayer = lazy(() => import('./VideoPlayer').then(m => ({ default: m.VideoPlayer })));

interface SmartPlayerProps {
  /** Channel for live TV playback */
  channel?: Channel | null;
  /** Direct stream URL for VOD playback */
  directStreamUrl?: string;
  /** Title for VOD content */
  vodTitle?: string;
  /** Callback for previous channel/episode */
  onPrevious?: () => void;
  /** Callback for next channel/episode */
  onNext?: () => void;
  /** Callback for back navigation */
  onBack?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Determine if we should use native playback
 * Returns true for Android (native ExoPlayer required for IPTV)
 */
function shouldUseNativePlayer(): boolean {
  if (!isNativePlatform()) {
    return false;
  }
  
  const platform = getPlatform();
  // Android MUST use native player for all IPTV content
  // iOS also uses native AVPlayer for better performance
  return platform === 'android' || platform === 'ios';
}

/**
 * SmartPlayer Component
 * 
 * Automatically selects the appropriate player based on platform:
 * - Android: ExoPlayer via NativePlayerView (REQUIRED for IPTV)
 * - iOS: AVPlayer via NativePlayerView
 * - Web: Falls back to VideoPlayer (HLS.js)
 * 
 * IMPORTANT: On Android, WebView video playback is INVALID for IPTV.
 * All streams (Live, VOD, Series) must use native ExoPlayer.
 */
export function SmartPlayer({
  channel,
  directStreamUrl,
  vodTitle,
  onPrevious,
  onNext,
  onBack,
  className,
}: SmartPlayerProps) {
  const navigate = useNavigate();
  const useNative = useMemo(() => shouldUseNativePlayer(), []);
  const [nativeLoadError, setNativeLoadError] = useState(false);
  const [isCheckingPlugin, setIsCheckingPlugin] = useState(true);
  
  // Log platform detection and check plugin availability on mount
  useEffect(() => {
    const checkNativeAvailability = async () => {
      const platform = getPlatform();
      const isNative = isNativePlatform();
      console.log(`[SmartPlayer] Platform: ${platform}, isNative: ${isNative}, useNativePlayer: ${useNative}`);
      
      if (platform === 'android' && isNative) {
        // Check if native plugin is actually available
        try {
          const info = await NativePlayback.getEngineInfo();
          console.log('[SmartPlayer] Native plugin available:', info);
          setNativeLoadError(false);
        } catch (err: any) {
          console.warn('[SmartPlayer] Native plugin check failed:', err);
          // Only set error if it's actually "not implemented"
          if (err?.message?.includes('not implemented') || err?.code === 'UNIMPLEMENTED') {
            setNativeLoadError(true);
          }
        }
      } else if (platform === 'android' && !isNative) {
        console.warn('[SmartPlayer] WARNING: Android detected but not running in native mode!');
        setNativeLoadError(true);
      }
      
      setIsCheckingPlugin(false);
    };
    
    checkNativeAvailability();
  }, [useNative]);
  
  // Get stream URL for external player option
  const streamUrl = directStreamUrl || channel?.streamUrl || '';
  
  // Handle opening in external player (VLC, MX Player, etc.)
  const handleOpenExternal = () => {
    if (streamUrl) {
      // Try to open in VLC or default video handler
      window.open(`vlc://${streamUrl}`, '_blank');
    }
  };
  
  // Show loading while checking plugin
  if (isCheckingPlugin && getPlatform() === 'android') {
    return (
      <div className={cn(
        "relative bg-black aspect-video w-full flex items-center justify-center",
        className
      )}>
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // Show error for Android when native isn't available
  if (nativeLoadError && getPlatform() === 'android') {
    return (
      <div className={cn(
        "relative bg-black aspect-video w-full flex flex-col items-center justify-center p-6",
        className
      )}>
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">
          Native-spelare krävs
        </h3>
        <p className="text-muted-foreground text-center text-sm mb-4 max-w-sm">
          IPTV-strömmar kan inte spelas i webbläsaren på Android. 
          Appen behöver byggas lokalt med native-stöd.
        </p>
        
        {/* Build instructions */}
        <div className="mb-4 p-3 bg-white/10 rounded-lg text-xs text-white/70 max-w-sm">
          <p className="font-medium text-white mb-2">Så här fixar du det:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Kör <code className="bg-white/20 px-1 rounded">git pull</code></li>
            <li>Kör <code className="bg-white/20 px-1 rounded">npm run build</code></li>
            <li>Kör <code className="bg-white/20 px-1 rounded">npx cap sync android</code></li>
            <li>Öppna android/ i Android Studio och bygg</li>
          </ol>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center">
          {streamUrl && (
            <Button 
              variant="outline" 
              onClick={handleOpenExternal}
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Öppna i VLC
            </Button>
          )}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/settings')}
            className="gap-2 text-white/70"
          >
            <Settings className="w-4 h-4" />
            Diagnostik
          </Button>
        </div>
      </div>
    );
  }
  
  // On Android/iOS - use native player (ExoPlayer/AVPlayer)
  if (useNative && !nativeLoadError) {
    return (
      <NativePlayerView
        channel={channel}
        directStreamUrl={directStreamUrl}
        vodTitle={vodTitle}
        onPrevious={onPrevious}
        onNext={onNext}
        onBack={onBack}
        className={className}
      />
    );
  }
  
  // On Web only - use VideoPlayer with HLS.js
  return (
    <Suspense fallback={<PlayerLoadingFallback className={className} />}>
      <VideoPlayer
        channel={channel}
        directStreamUrl={directStreamUrl}
        vodTitle={vodTitle}
        onPrevious={onPrevious}
        onNext={onNext}
        className={className}
      />
    </Suspense>
  );
}

/**
 * Loading fallback while VideoPlayer loads
 */
function PlayerLoadingFallback({ className }: { className?: string }) {
  return (
    <div className={cn(
      "relative bg-black aspect-video w-full flex items-center justify-center",
      className
    )}>
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
  );
}

export default SmartPlayer;
