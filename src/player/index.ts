/**
 * Player module exports
 */

// Types
export * from './types';

// Engines
export { Html5Engine, Html5EngineFactory } from './engines/Html5Engine';
export { ShakaEngine, ShakaEngineFactory } from './engines/ShakaEngine';
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

// Controllers
export { 
  UnifiedPlayerController, 
  getPlayerController, 
  resetPlayerController,
  type PlayerControllerEvents,
} from './UnifiedPlayerController';

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
