/**
 * CryptoService - Handles encryption/decryption of sensitive provider data
 * Uses WebCrypto API for client-side encryption
 */

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  salt: string;
  alg: 'AES-GCM';
  version: number;
}

interface CryptoServiceConfig {
  algorithm: 'AES-GCM';
  keyLength: 256;
  iterations: 100000;
}

const CONFIG: CryptoServiceConfig = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  iterations: 100000,
};

const STORAGE_KEY = 'streamvault-encryption-key';
const KEY_VERSION = 1;

class CryptoService {
  private cachedKey: CryptoKey | null = null;

  /**
   * Initialize or retrieve the device-bound encryption key
   */
  async getOrCreateKey(): Promise<CryptoKey> {
    if (this.cachedKey) return this.cachedKey;

    // Try to load existing key from storage
    const storedKey = await this.loadStoredKey();
    if (storedKey) {
      this.cachedKey = storedKey;
      return storedKey;
    }

    // Generate new key
    const newKey = await this.generateKey();
    await this.storeKey(newKey);
    this.cachedKey = newKey;
    return newKey;
  }

  /**
   * Generate a new encryption key
   */
  async generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      {
        name: CONFIG.algorithm,
        length: CONFIG.keyLength,
      },
      true, // extractable for storage
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt plaintext data
   */
  async encrypt(plaintext: string): Promise<EncryptedPayload> {
    const key = await this.getOrCreateKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Generate IV for this encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: CONFIG.algorithm,
        iv: iv,
      },
      key,
      data
    );

    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      iv: this.arrayBufferToBase64(iv.buffer as ArrayBuffer),
      salt: this.arrayBufferToBase64(salt.buffer as ArrayBuffer),
      alg: CONFIG.algorithm,
      version: KEY_VERSION,
    };
  }

  /**
   * Decrypt encrypted payload
   */
  async decrypt(payload: EncryptedPayload): Promise<string> {
    const key = await this.getOrCreateKey();
    
    const ivBuffer = this.base64ToArrayBuffer(payload.iv);
    const ciphertext = this.base64ToArrayBuffer(payload.ciphertext);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: CONFIG.algorithm,
        iv: ivBuffer,
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Check if a value is encrypted
   */
  isEncrypted(value: unknown): value is EncryptedPayload {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    return (
      typeof obj.ciphertext === 'string' &&
      typeof obj.iv === 'string' &&
      typeof obj.alg === 'string' &&
      typeof obj.version === 'number'
    );
  }

  /**
   * Mask sensitive data for display
   */
  maskUrl(url: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      // Mask everything except protocol and domain hint
      const domain = parsed.hostname;
      const maskedDomain = domain.length > 8 
        ? `${domain.slice(0, 3)}***${domain.slice(-3)}`
        : '***';
      return `${parsed.protocol}//${maskedDomain}/***`;
    } catch {
      // If not a valid URL, just mask most of it
      if (url.length < 8) return '********';
      return `${url.slice(0, 4)}***${url.slice(-4)}`;
    }
  }

  /**
   * Mask username
   */
  maskUsername(username: string): string {
    if (!username) return '';
    if (username.length <= 2) return '**';
    return `${username[0]}***${username[username.length - 1]}`;
  }

  /**
   * Store encryption key securely in IndexedDB
   */
  private async storeKey(key: CryptoKey): Promise<void> {
    const exported = await crypto.subtle.exportKey('jwk', key);
    const keyData = JSON.stringify(exported);
    
    // Store in localStorage (for now - in production, use more secure storage)
    localStorage.setItem(STORAGE_KEY, keyData);
  }

  /**
   * Load stored encryption key
   */
  private async loadStoredKey(): Promise<CryptoKey | null> {
    try {
      const keyData = localStorage.getItem(STORAGE_KEY);
      if (!keyData) return null;

      const jwk = JSON.parse(keyData);
      return crypto.subtle.importKey(
        'jwk',
        jwk,
        {
          name: CONFIG.algorithm,
          length: CONFIG.keyLength,
        },
        true,
        ['encrypt', 'decrypt']
      );
    } catch {
      return null;
    }
  }

  /**
   * Helper: ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Helper: Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Export backup data with encryption
   */
  async encryptBackup(data: object): Promise<string> {
    const json = JSON.stringify(data);
    const encrypted = await this.encrypt(json);
    return JSON.stringify(encrypted);
  }

  /**
   * Import encrypted backup
   */
  async decryptBackup(encryptedData: string): Promise<object> {
    const payload = JSON.parse(encryptedData) as EncryptedPayload;
    const decrypted = await this.decrypt(payload);
    return JSON.parse(decrypted);
  }

  /**
   * Clear stored key (use with caution - will make encrypted data unrecoverable)
   */
  clearKey(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.cachedKey = null;
  }
}

export const cryptoService = new CryptoService();
export default cryptoService;
