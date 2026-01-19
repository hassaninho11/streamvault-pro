/**
 * Player module exports
 * 
 * CRITICAL ARCHITECTURE NOTE:
 * On Android, ALL playback MUST use native ExoPlayer/VLC via NativeBridges.
 * WebView video playback is NOT allowed for IPTV content.
 * 
 * Playback Flow:
 * 1. SmartPlayer detects platform
 * 2. Android/iOS → NativePlayerView → AndroidPlaybackController → ExoPlayer/VLC
 * 3. Web → VideoPlayer → HLS.js
 */

// Types
export * from './types';

// Engines
export { Html5Engine, Html5EngineFactory } from './engines/Html5Engine';
export { ShakaEngine, ShakaEngineFactory } from './engines/ShakaEngine';
export { ExoPlayerBridgeEngine, ExoPlayerBridgeEngineFactory } from './engines/ExoPlayerBridgeEngine';
export { VlcBridgeEngine, VlcBridgeEngineFactory } from './engines/VlcBridgeEngine';
export { 
  ExoPlayerEngine, 
  ExoPlayerEngineFactory,
  AVPlayerEngine,
  AVPlayerEngineFactory,
  VlcEngine,
  VlcEngineFactory,
} from './engines/NativeBridges';

// Registry
export { PlayerEngineRegistry } from './PlayerEngineRegistry';

// Android Playback Controller (Primary for Android IPTV)
export {
  AndroidPlaybackController,
  getAndroidPlaybackController,
  resetAndroidPlaybackController,
  isAndroidPlaybackAvailable,
  type AndroidPlaybackEvents,
  type AndroidEngineType,
} from './AndroidPlaybackController';

// Unified Player Controller (Web/Fallback)
export { 
  UnifiedPlayerController, 
  getPlayerController, 
  resetPlayerController,
  type PlayerControllerEvents,
} from './UnifiedPlayerController';

// Cast Controller
export {
  CastController,
  getCastController,
  type CastState,
  type CastStatus,
  type CastDevice,
  type CastControllerEvents,
} from './CastController';

// Playback Strategy
export {
  performPreflight,
  detectPlatform,
  getStrategyLabel,
  getStrategyIcon,
  type Platform,
  type PlaybackStrategy,
  type PreflightResult,
  type PreflightOptions,
} from './PlaybackPreflight';

// Media Preflight (MKV detection)
export {
  performMediaPreflight,
  performMediaPreflightSync,
  detectContainerFromUrl,
  isUnsupportedContainer,
  isMkvUrl,
  isBrowserPlayable,
  type ContainerFormat,
  type MediaInfo,
  type MkvPreflightResult,
  type MkvPlayerPreference,
} from './MediaPreflight';

// Playback Strategy Resolver
export {
  executeStrategy,
  resolvePlayback,
  buildProxyUrl,
  copyStreamUrl,
  generateVlcLink,
  startCasting,
  type StrategyContext,
  type StrategyResult,
} from './PlaybackStrategyResolver';

// Native Playback Plugin (Capacitor bridge)
export {
  NativePlayback,
  isNativePlatform,
  getPlatform,
  hashUrlForLog,
  type PlaybackState,
  type PlaybackError,
  type StreamInfo,
  type LoadOptions,
} from './NativePlaybackPlugin';

// Native Cast Plugin (Android Chromecast)
export {
  NativeCast,
  isNativeCastAvailable,
  getCastPlatform,
  type CastState as NativeCastState,
  type CastStateInfo,
  type CastSessionEvent,
  type CastPlaybackState,
  type LoadMediaOptions,
} from './NativeCastPlugin';
