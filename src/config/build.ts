/**
 * Build information - Update this file on each release
 * Version format: YYYY.MM.DD-REVISION
 */

export const BUILD_INFO = {
  version: '2025.01.20',
  revision: 'C',
  buildDate: new Date().toISOString().split('T')[0],
  
  get displayVersion() {
    return `v${this.version}-${this.revision}`;
  },
  
  get fullVersion() {
    return `${this.version}-${this.revision} (${this.buildDate})`;
  },
} as const;

export type BuildInfo = typeof BUILD_INFO;
