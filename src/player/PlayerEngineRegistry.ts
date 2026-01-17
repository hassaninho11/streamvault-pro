/**
 * PlayerEngineRegistry - Manages available player engines
 */

import { EngineFactory, MediaPlayerEngine, MediaSource, Platform, detectPlatform } from './types';
import { Html5EngineFactory } from './engines/Html5Engine';
import { ShakaEngineFactory } from './engines/ShakaEngine';
import { ExoPlayerEngineFactory, AVPlayerEngineFactory, VlcEngineFactory } from './engines/NativeBridges';

class PlayerEngineRegistryImpl {
  private factories: Map<string, EngineFactory> = new Map();
  private platform: Platform;
  
  constructor() {
    this.platform = detectPlatform();
    this.registerDefaultEngines();
  }
  
  private registerDefaultEngines(): void {
    // Register all engine factories
    this.register(Html5EngineFactory);
    this.register(ShakaEngineFactory);
    this.register(ExoPlayerEngineFactory);
    this.register(AVPlayerEngineFactory);
    this.register(VlcEngineFactory);
  }
  
  register(factory: EngineFactory): void {
    this.factories.set(factory.id, factory);
  }
  
  unregister(id: string): void {
    this.factories.delete(id);
  }
  
  getFactory(id: string): EngineFactory | undefined {
    return this.factories.get(id);
  }
  
  /**
   * Get all available engines for the current platform
   */
  getAvailableEngines(): EngineFactory[] {
    return Array.from(this.factories.values())
      .filter(f => f.isAvailable())
      .sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Get engines that support a specific source
   */
  getEnginesForSource(source: MediaSource): EngineFactory[] {
    return this.getAvailableEngines()
      .filter(f => f.supportsSource(source));
  }
  
  /**
   * Resolve the best engine for auto mode
   */
  resolveAutoEngine(source?: MediaSource): EngineFactory {
    const engines = source 
      ? this.getEnginesForSource(source) 
      : this.getAvailableEngines();
    
    if (engines.length === 0) {
      throw new Error('No available player engines');
    }
    
    // Platform-specific defaults
    const platformDefaults: Record<Platform, string[]> = {
      android: ['exo', 'vlc', 'shaka', 'html5'],
      ios: ['av', 'vlc', 'shaka', 'html5'],
      tvos: ['av', 'vlc', 'shaka', 'html5'],
      tizen: ['shaka', 'html5'],
      webos: ['shaka', 'html5'],
      electron: ['shaka', 'html5'],
      web: ['shaka', 'html5'],
    };
    
    const preferredOrder = platformDefaults[this.platform];
    
    for (const engineId of preferredOrder) {
      const engine = engines.find(e => e.id === engineId);
      if (engine) {
        return engine;
      }
    }
    
    // Fallback to first available
    return engines[0];
  }
  
  /**
   * Create an engine instance
   */
  createEngine(id: string): MediaPlayerEngine {
    const factory = this.factories.get(id);
    if (!factory) {
      throw new Error(`Engine not found: ${id}`);
    }
    if (!factory.isAvailable()) {
      throw new Error(`Engine not available: ${id}`);
    }
    return factory.create();
  }
  
  /**
   * Create the auto-selected engine
   */
  createAutoEngine(source?: MediaSource): MediaPlayerEngine {
    const factory = this.resolveAutoEngine(source);
    return factory.create();
  }
  
  /**
   * Get display information for settings UI
   */
  getEngineOptions(): { id: string; displayName: string; available: boolean }[] {
    const options: { id: string; displayName: string; available: boolean }[] = [
      { id: 'auto', displayName: 'Auto (Recommended)', available: true },
    ];
    
    // Add platform-relevant engines
    const platformEngines: Record<Platform, string[]> = {
      android: ['exo', 'vlc'],
      ios: ['av', 'vlc'],
      tvos: ['av', 'vlc'],
      tizen: ['shaka', 'html5'],
      webos: ['shaka', 'html5'],
      electron: ['shaka', 'html5'],
      web: ['shaka', 'html5'],
    };
    
    const relevantEngines = platformEngines[this.platform];
    
    for (const id of relevantEngines) {
      const factory = this.factories.get(id);
      if (factory) {
        options.push({
          id: factory.id,
          displayName: factory.displayName,
          available: factory.isAvailable(),
        });
      }
    }
    
    return options;
  }
  
  getPlatform(): Platform {
    return this.platform;
  }
}

// Singleton instance
export const PlayerEngineRegistry = new PlayerEngineRegistryImpl();
