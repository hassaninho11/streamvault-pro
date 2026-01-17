/**
 * EPG Matching Service - Smart matching between channels and EPG data
 * Supports fuzzy matching, regex rules, and manual mappings
 */

export interface EpgMatchRule {
  id: string;
  type: 'exact' | 'contains' | 'regex' | 'manual';
  channelPattern: string;
  epgIdPattern: string;
  priority: number;
}

export interface EpgMatchResult {
  channelId: string;
  epgId: string;
  confidence: number;
  matchType: 'exact' | 'normalized' | 'fuzzy' | 'manual' | 'regex';
}

interface NormalizedName {
  original: string;
  normalized: string;
  tokens: string[];
}

class EpgMatchingService {
  private customRules: EpgMatchRule[] = [];
  private manualMappings: Map<string, string> = new Map();

  /**
   * Normalize channel name for matching
   */
  private normalize(name: string): NormalizedName {
    const original = name;
    
    // Lowercase and remove diacritics
    let normalized = name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    // Remove common suffixes
    normalized = normalized
      .replace(/\s*(hd|sd|fhd|uhd|4k|hevc|h\.?265|h\.?264)\s*/gi, ' ')
      .replace(/\s*(backup|bak|alt|alternative)\s*/gi, ' ');
    
    // Remove special characters
    normalized = normalized
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Tokenize
    const tokens = normalized.split(' ').filter(t => t.length > 1);
    
    return { original, normalized, tokens };
  }

  /**
   * Calculate similarity score between two strings
   */
  private similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;
    
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    
    const longerLength = longer.length;
    const editDistance = this.levenshtein(longer, shorter);
    
    return (longerLength - editDistance) / longerLength;
  }

  /**
   * Levenshtein distance
   */
  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * Match channels to EPG IDs
   */
  matchChannels(
    channels: Array<{ id: string; name: string; epgId?: string }>,
    epgChannels: Array<{ id: string; name: string }>
  ): EpgMatchResult[] {
    const results: EpgMatchResult[] = [];
    const normalizedEpg = epgChannels.map(c => ({
      ...c,
      ...this.normalize(c.name),
    }));

    for (const channel of channels) {
      // Check manual mapping first
      if (this.manualMappings.has(channel.id)) {
        results.push({
          channelId: channel.id,
          epgId: this.manualMappings.get(channel.id)!,
          confidence: 1,
          matchType: 'manual',
        });
        continue;
      }

      // Check custom regex rules
      const regexMatch = this.matchByRegex(channel);
      if (regexMatch) {
        results.push(regexMatch);
        continue;
      }

      // Use provided epgId if available
      if (channel.epgId) {
        const exactEpgMatch = epgChannels.find(e => e.id === channel.epgId);
        if (exactEpgMatch) {
          results.push({
            channelId: channel.id,
            epgId: exactEpgMatch.id,
            confidence: 1,
            matchType: 'exact',
          });
          continue;
        }
      }

      // Normalize and match
      const normalized = this.normalize(channel.name);
      let bestMatch: EpgMatchResult | null = null;
      let bestScore = 0;

      for (const epg of normalizedEpg) {
        // Exact normalized match
        if (normalized.normalized === epg.normalized) {
          results.push({
            channelId: channel.id,
            epgId: epg.id,
            confidence: 0.95,
            matchType: 'normalized',
          });
          bestMatch = null;
          break;
        }

        // Fuzzy match
        const score = this.similarity(normalized.normalized, epg.normalized);
        if (score > bestScore && score > 0.7) {
          bestScore = score;
          bestMatch = {
            channelId: channel.id,
            epgId: epg.id,
            confidence: score,
            matchType: 'fuzzy',
          };
        }

        // Token match
        const tokenScore = this.tokenMatch(normalized.tokens, epg.tokens);
        if (tokenScore > bestScore && tokenScore > 0.7) {
          bestScore = tokenScore;
          bestMatch = {
            channelId: channel.id,
            epgId: epg.id,
            confidence: tokenScore,
            matchType: 'fuzzy',
          };
        }
      }

      if (bestMatch) {
        results.push(bestMatch);
      }
    }

    return results;
  }

  /**
   * Token-based matching
   */
  private tokenMatch(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    
    let matches = 0;
    for (const t1 of tokens1) {
      if (tokens2.some(t2 => t1 === t2 || t1.includes(t2) || t2.includes(t1))) {
        matches++;
      }
    }
    
    return matches / Math.max(tokens1.length, tokens2.length);
  }

  /**
   * Match by custom regex rules
   */
  private matchByRegex(channel: { id: string; name: string }): EpgMatchResult | null {
    for (const rule of this.customRules.sort((a, b) => b.priority - a.priority)) {
      if (rule.type === 'regex') {
        try {
          const regex = new RegExp(rule.channelPattern, 'i');
          if (regex.test(channel.name)) {
            return {
              channelId: channel.id,
              epgId: channel.name.replace(regex, rule.epgIdPattern),
              confidence: 0.9,
              matchType: 'regex',
            };
          }
        } catch {
          // Invalid regex, skip
        }
      }
    }
    return null;
  }

  /**
   * Add manual mapping
   */
  setManualMapping(channelId: string, epgId: string): void {
    this.manualMappings.set(channelId, epgId);
  }

  /**
   * Remove manual mapping
   */
  removeManualMapping(channelId: string): void {
    this.manualMappings.delete(channelId);
  }

  /**
   * Add custom rule
   */
  addRule(rule: EpgMatchRule): void {
    this.customRules.push(rule);
  }

  /**
   * Get all manual mappings
   */
  getManualMappings(): Map<string, string> {
    return new Map(this.manualMappings);
  }

  /**
   * Export mappings for backup
   */
  exportMappings(): { manual: [string, string][]; rules: EpgMatchRule[] } {
    return {
      manual: Array.from(this.manualMappings.entries()),
      rules: this.customRules,
    };
  }

  /**
   * Import mappings from backup
   */
  importMappings(data: { manual?: [string, string][]; rules?: EpgMatchRule[] }): void {
    if (data.manual) {
      this.manualMappings = new Map(data.manual);
    }
    if (data.rules) {
      this.customRules = data.rules;
    }
  }
}

export const epgMatchingService = new EpgMatchingService();
export default epgMatchingService;
