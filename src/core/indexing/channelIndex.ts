/**
 * Channel Indexing - O(1) lookups for large channel lists
 * Pre-computes search tokens, group mappings, and sorted views
 */

import type { CoreChannel, ChannelIndex, ParsedM3UItem } from '../types';

/**
 * Build complete channel index from parsed M3U items
 */
export function buildChannelIndex(
  items: ParsedM3UItem[],
  providerId: string
): { channels: CoreChannel[]; index: ChannelIndex } {
  const startTime = performance.now();
  
  const channels: CoreChannel[] = [];
  const byId = new Map<string, CoreChannel>();
  const byGroup = new Map<string, string[]>();
  const byProvider = new Map<string, string[]>();
  const searchTokens = new Map<string, Set<string>>();
  const allIds: string[] = [];
  const groupsSet = new Set<string>();
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const id = `${providerId}-${i}`;
    const nameLower = item.name.toLowerCase();
    const groupLower = item.group.toLowerCase();
    
    const channel: CoreChannel = {
      id,
      providerId,
      channelId: item.tvgId || id,
      name: item.name,
      nameLower,
      group: item.group,
      groupLower,
      logoUrl: item.logo,
      streamUrl: item.url,
      epgId: item.tvgId,
      isHD: detectHD(item.name, item.extras),
    };
    
    channels.push(channel);
    byId.set(id, channel);
    allIds.push(id);
    groupsSet.add(item.group);
    
    // Group index
    const groupIds = byGroup.get(item.group);
    if (groupIds) {
      groupIds.push(id);
    } else {
      byGroup.set(item.group, [id]);
    }
    
    // Provider index
    const providerIds = byProvider.get(providerId);
    if (providerIds) {
      providerIds.push(id);
    } else {
      byProvider.set(providerId, [id]);
    }
    
    // Search tokens (prefix-based for fast autocomplete)
    const tokens = tokenize(nameLower);
    for (const token of tokens) {
      // Store prefixes for prefix search
      for (let len = 1; len <= Math.min(token.length, 4); len++) {
        const prefix = token.substring(0, len);
        const existing = searchTokens.get(prefix);
        if (existing) {
          existing.add(id);
        } else {
          searchTokens.set(prefix, new Set([id]));
        }
      }
      // Store full token
      const existing = searchTokens.get(token);
      if (existing) {
        existing.add(id);
      } else {
        searchTokens.set(token, new Set([id]));
      }
    }
  }
  
  const groups = Array.from(groupsSet).sort();
  
  console.log(`[ChannelIndex] Built index for ${channels.length} channels in ${(performance.now() - startTime).toFixed(1)}ms`);
  
  return {
    channels,
    index: {
      byId,
      byGroup,
      byProvider,
      searchTokens,
      allIds,
      groups,
    },
  };
}

/**
 * Tokenize string for search indexing
 */
function tokenize(str: string): string[] {
  return str
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);
}

/**
 * Detect if channel is HD based on name/metadata
 */
function detectHD(name: string, extras: Record<string, string>): boolean {
  const nameLower = name.toLowerCase();
  return (
    nameLower.includes(' hd') ||
    nameLower.includes('hd ') ||
    nameLower.endsWith('hd') ||
    extras['quality']?.toLowerCase() === 'hd' ||
    extras['resolution']?.includes('1080') ||
    extras['resolution']?.includes('720')
  );
}

/**
 * Fast search using pre-built token index
 * Returns channel IDs matching the query
 */
export function searchChannels(
  query: string,
  index: ChannelIndex,
  limit: number = 100
): string[] {
  if (!query || query.length < 1) {
    return index.allIds.slice(0, limit);
  }
  
  const queryLower = query.toLowerCase().trim();
  const tokens = tokenize(queryLower);
  
  if (tokens.length === 0) {
    // Single short query - prefix search
    const matches = index.searchTokens.get(queryLower);
    if (matches) {
      return Array.from(matches).slice(0, limit);
    }
    return [];
  }
  
  // Intersect results for multiple tokens
  let resultSet: Set<string> | null = null;
  
  for (const token of tokens) {
    const matches = index.searchTokens.get(token);
    if (!matches) {
      return []; // No match for this token
    }
    
    if (resultSet === null) {
      resultSet = new Set(matches);
    } else {
      // Intersect
      for (const id of resultSet) {
        if (!matches.has(id)) {
          resultSet.delete(id);
        }
      }
    }
    
    if (resultSet.size === 0) return [];
  }
  
  return resultSet ? Array.from(resultSet).slice(0, limit) : [];
}

/**
 * Get channels by group - O(1) lookup
 */
export function getChannelsByGroup(
  group: string,
  index: ChannelIndex
): string[] {
  return index.byGroup.get(group) || [];
}

/**
 * Get all groups with counts
 */
export function getGroupsWithCounts(
  index: ChannelIndex
): { name: string; count: number }[] {
  return index.groups.map(name => ({
    name,
    count: index.byGroup.get(name)?.length || 0,
  }));
}
