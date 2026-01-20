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

import { useEffect, useMemo, lazy, Suspense } from 'react';
import { Channel } from '@/types/iptv';
import { isNativePlatform, getPlatform } from '@/player/NativePlaybackPlugin';
import { NativePlayerView } from './NativePlayerView';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
 * 
 * NO BLOCKING SCREEN: This component ALWAYS attempts playback.
 * Error handling and fallbacks are handled inside NativePlayerView.
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
  const useNative = useMemo(() => shouldUseNativePlayer(), []);
  
  // Log platform detection on mount
  useEffect(() => {
    const platform = getPlatform();
    const isNative = isNativePlatform();
    console.log(`[SmartPlayer] Platform: ${platform}, isNative: ${isNative}, useNativePlayer: ${useNative}`);
  }, [useNative]);
  
  // On Android/iOS - use native player (ExoPlayer/AVPlayer)
  // NO BLOCKING SCREEN - NativePlayerView handles all error states internally
  if (useNative) {
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
