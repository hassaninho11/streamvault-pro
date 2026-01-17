/**
 * Playlist Tools Service - Auto-group, deduplicate, manage channels
 */

import type { CoreChannel } from '@/core/types';

export interface ChannelGroup {
  id: string;
  name: string;
  icon?: string;
  isCustom: boolean;
  channelIds: string[];
  order: number;
}

export interface ChannelOverride {
  channelId: string;
  customName?: string;
  customGroup?: string;
  isHidden: boolean;
  order?: number;
}

export interface DuplicateGroup {
  channels: CoreChannel[];
  reason: 'same_url' | 'same_name' | 'similar_name';
}

const STORAGE_KEY = 'streamvault-playlist-tools';
const AUTO_GROUPS: { pattern: RegExp; group: string; icon: string }[] = [
  { pattern: /\b(sport|espn|sky sport|fox sport|bein|dazn)\b/i, group: 'Sports', icon: '⚽' },
  { pattern: /\b(news|cnn|bbc news|sky news|al jazeera)\b/i, group: 'News', icon: '📰' },
  { pattern: /\b(kids|disney|cartoon|nick|baby)\b/i, group: 'Kids', icon: '🧸' },
  { pattern: /\b(movie|film|cinema|hbo|netflix|prime)\b/i, group: 'Movies', icon: '🎬' },
  { pattern: /\b(music|mtv|vh1|vevo)\b/i, group: 'Music', icon: '🎵' },
  { pattern: /\b(documentary|discovery|nat geo|history)\b/i, group: 'Documentary', icon: '🌍' },
  { pattern: /\b(local|regional|city)\b/i, group: 'Local', icon: '📍' },
];

interface PlaylistToolsState {
  customGroups: ChannelGroup[];
  overrides: Map<string, ChannelOverride>;
  hiddenChannels: Set<string>;
}

class PlaylistToolsService {
  private state: PlaylistToolsState = {
    customGroups: [],
    overrides: new Map(),
    hiddenChannels: new Set(),
  };

  constructor() {
    this.load();
  }

  /**
   * Load state from storage
   */
  private load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.state = {
          customGroups: data.customGroups || [],
          overrides: new Map(data.overrides || []),
          hiddenChannels: new Set(data.hiddenChannels || []),
        };
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Save state to storage
   */
  private save(): void {
    const data = {
      customGroups: this.state.customGroups,
      overrides: Array.from(this.state.overrides.entries()),
      hiddenChannels: Array.from(this.state.hiddenChannels),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ============= Auto-Grouping =============

  /**
   * Auto-categorize channels based on name patterns
   */
  autoGroup(channels: CoreChannel[]): Map<string, CoreChannel[]> {
    const groups = new Map<string, CoreChannel[]>();
    
    for (const channel of channels) {
      let assigned = false;
      
      for (const rule of AUTO_GROUPS) {
        if (rule.pattern.test(channel.name)) {
          const existing = groups.get(rule.group) || [];
          existing.push(channel);
          groups.set(rule.group, existing);
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        // Use original group
        const existing = groups.get(channel.group) || [];
        existing.push(channel);
        groups.set(channel.group, existing);
      }
    }
    
    return groups;
  }

  /**
   * Get suggested auto-group for a channel
   */
  suggestGroup(channel: CoreChannel): string | null {
    for (const rule of AUTO_GROUPS) {
      if (rule.pattern.test(channel.name)) {
        return rule.group;
      }
    }
    return null;
  }

  // ============= Deduplication =============

  /**
   * Find duplicate channels
   */
  findDuplicates(channels: CoreChannel[]): DuplicateGroup[] {
    const duplicates: DuplicateGroup[] = [];
    const urlMap = new Map<string, CoreChannel[]>();
    const nameMap = new Map<string, CoreChannel[]>();

    // Group by URL
    for (const channel of channels) {
      const urlKey = channel.streamUrl.toLowerCase().split('?')[0]; // Ignore query params
      const existing = urlMap.get(urlKey) || [];
      existing.push(channel);
      urlMap.set(urlKey, existing);
    }

    // Find URL duplicates
    for (const [, group] of urlMap) {
      if (group.length > 1) {
        duplicates.push({ channels: group, reason: 'same_url' });
      }
    }

    // Group by normalized name
    for (const channel of channels) {
      const nameKey = this.normalizeName(channel.name);
      const existing = nameMap.get(nameKey) || [];
      existing.push(channel);
      nameMap.set(nameKey, existing);
    }

    // Find name duplicates (not already in URL duplicates)
    const urlDupeIds = new Set(duplicates.flatMap(d => d.channels.map(c => c.id)));
    for (const [, group] of nameMap) {
      if (group.length > 1) {
        const notInUrlDupes = group.filter(c => !urlDupeIds.has(c.id));
        if (notInUrlDupes.length > 1) {
          duplicates.push({ channels: notInUrlDupes, reason: 'same_name' });
        }
      }
    }

    return duplicates;
  }

  /**
   * Normalize channel name for comparison
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*(hd|sd|fhd|uhd|4k|backup|alt)\s*/gi, ' ')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ============= Channel Overrides =============

  /**
   * Hide a channel
   */
  hideChannel(channelId: string): void {
    this.state.hiddenChannels.add(channelId);
    this.save();
  }

  /**
   * Unhide a channel
   */
  unhideChannel(channelId: string): void {
    this.state.hiddenChannels.delete(channelId);
    this.save();
  }

  /**
   * Check if channel is hidden
   */
  isHidden(channelId: string): boolean {
    return this.state.hiddenChannels.has(channelId);
  }

  /**
   * Get hidden channel IDs
   */
  getHiddenChannels(): string[] {
    return Array.from(this.state.hiddenChannels);
  }

  /**
   * Rename a channel
   */
  renameChannel(channelId: string, newName: string): void {
    const override = this.state.overrides.get(channelId) || {
      channelId,
      isHidden: false,
    };
    override.customName = newName;
    this.state.overrides.set(channelId, override);
    this.save();
  }

  /**
   * Move channel to different group
   */
  moveChannel(channelId: string, newGroup: string): void {
    const override = this.state.overrides.get(channelId) || {
      channelId,
      isHidden: false,
    };
    override.customGroup = newGroup;
    this.state.overrides.set(channelId, override);
    this.save();
  }

  /**
   * Get override for channel
   */
  getOverride(channelId: string): ChannelOverride | undefined {
    return this.state.overrides.get(channelId);
  }

  /**
   * Apply overrides to channel
   */
  applyOverrides(channel: CoreChannel): CoreChannel {
    const override = this.state.overrides.get(channel.id);
    if (!override) return channel;

    return {
      ...channel,
      name: override.customName || channel.name,
      group: override.customGroup || channel.group,
    };
  }

  /**
   * Filter visible channels
   */
  filterVisible(channels: CoreChannel[]): CoreChannel[] {
    return channels.filter(c => !this.state.hiddenChannels.has(c.id));
  }

  // ============= Custom Groups =============

  /**
   * Create custom group
   */
  createGroup(name: string, icon?: string): ChannelGroup {
    const group: ChannelGroup = {
      id: crypto.randomUUID(),
      name,
      icon,
      isCustom: true,
      channelIds: [],
      order: this.state.customGroups.length,
    };
    this.state.customGroups.push(group);
    this.save();
    return group;
  }

  /**
   * Delete custom group
   */
  deleteGroup(groupId: string): void {
    this.state.customGroups = this.state.customGroups.filter(g => g.id !== groupId);
    this.save();
  }

  /**
   * Add channel to custom group
   */
  addToGroup(groupId: string, channelId: string): void {
    const group = this.state.customGroups.find(g => g.id === groupId);
    if (group && !group.channelIds.includes(channelId)) {
      group.channelIds.push(channelId);
      this.save();
    }
  }

  /**
   * Remove channel from custom group
   */
  removeFromGroup(groupId: string, channelId: string): void {
    const group = this.state.customGroups.find(g => g.id === groupId);
    if (group) {
      group.channelIds = group.channelIds.filter(id => id !== channelId);
      this.save();
    }
  }

  /**
   * Get all custom groups
   */
  getCustomGroups(): ChannelGroup[] {
    return [...this.state.customGroups].sort((a, b) => a.order - b.order);
  }

  // ============= Export =============

  /**
   * Export channel layout (no credentials)
   */
  exportLayout(): object {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      customGroups: this.state.customGroups,
      overrides: Array.from(this.state.overrides.values()).map(o => ({
        customName: o.customName,
        customGroup: o.customGroup,
        isHidden: o.isHidden,
        order: o.order,
      })),
      hiddenCount: this.state.hiddenChannels.size,
    };
  }

  /**
   * Clear all customizations
   */
  reset(): void {
    this.state = {
      customGroups: [],
      overrides: new Map(),
      hiddenChannels: new Set(),
    };
    this.save();
  }
}

export const playlistToolsService = new PlaylistToolsService();
export default playlistToolsService;
