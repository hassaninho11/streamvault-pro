/**
 * EntitlementsService - Centralized entitlements management
 * Abstracts payment providers (Stripe, IAP) from UI
 * 
 * IMPORTANT: Premium/Trial works WITHOUT login
 * Login is ONLY for syncing playlists between devices
 * 
 * For logged-in users, also checks server-side entitlements
 * (e.g., manual grants from admin panel)
 */

import { localStore, LocalEntitlement } from '@/data/stores/localStore';
import { supabase } from '@/integrations/supabase/client';
import { APP_CONFIG } from '@/config/app';

// ============= Types =============

export interface EntitlementStatus {
  isPremium: boolean;
  isTrial: boolean;
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  trialDaysRemaining?: number;
  plan?: string;
  source: 'local' | 'stripe' | 'iap' | 'none' | 'server';
  expiresAt?: Date;
  isExpired: boolean;
  isTrialExpired: boolean;
}

export interface PurchaseResult {
  success: boolean;
  error?: string;
  transactionId?: string;
}

export interface BillingProvider {
  name: string;
  isSupported: () => boolean;
  purchase: (planId: string) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
  getStatus: () => Promise<EntitlementStatus | null>;
  openManagement: () => Promise<void>;
}

// ============= Stripe Provider =============

class StripeBillingProvider implements BillingProvider {
  name = 'stripe';

  isSupported(): boolean {
    // Stripe is supported on web and desktop
    return typeof window !== 'undefined' && !this.isMobileApp();
  }

  private isMobileApp(): boolean {
    // Detect if running in Capacitor/Cordova
    return !!(window as unknown as { Capacitor?: unknown }).Capacitor;
  }

  async purchase(_planId: string): Promise<PurchaseResult> {
    // This will be implemented when Stripe is enabled
    return {
      success: false,
      error: 'Stripe-integration kommer snart!',
    };
  }

  async restorePurchases(): Promise<PurchaseResult> {
    // Stripe subscriptions are linked to email/account
    return {
      success: false,
      error: 'Logga in för att återställa ditt abonnemang.',
    };
  }

  async getStatus(): Promise<EntitlementStatus | null> {
    // This will check Stripe subscription status via edge function
    return null;
  }

  async openManagement(): Promise<void> {
    console.log('Stripe management portal not yet implemented');
  }
}

// ============= IAP Provider (Stub) =============

class StubIAPBillingProvider implements BillingProvider {
  name = 'iap';

  isSupported(): boolean {
    // Check if running on iOS or Android via Capacitor
    const capacitor = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    if (!capacitor) return false;
    const platform = capacitor.getPlatform?.();
    return platform === 'ios' || platform === 'android';
  }

  async purchase(_planId: string): Promise<PurchaseResult> {
    return {
      success: false,
      error: 'In-app-köp kommer snart!',
    };
  }

  async restorePurchases(): Promise<PurchaseResult> {
    return {
      success: false,
      error: 'In-app-köp kommer snart!',
    };
  }

  async getStatus(): Promise<EntitlementStatus | null> {
    return null;
  }

  async openManagement(): Promise<void> {
    console.log('IAP management not yet implemented');
  }
}

// ============= Entitlements Service =============

class EntitlementsService {
  private providers: BillingProvider[] = [
    new StripeBillingProvider(),
    new StubIAPBillingProvider(),
  ];

  private cachedStatus: EntitlementStatus | null = null;
  private listeners: Set<(status: EntitlementStatus) => void> = new Set();

  // ============= Subscription =============

  subscribe(listener: (status: EntitlementStatus) => void): () => void {
    this.listeners.add(listener);
    // Send current status immediately
    this.getStatus().then(status => listener(status));
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(status: EntitlementStatus): void {
    this.cachedStatus = status;
    this.listeners.forEach(l => l(status));
  }

  // ============= Status =============

  async getStatus(): Promise<EntitlementStatus> {
    // First, check server-side entitlements for logged-in users
    const serverStatus = await this.checkServerEntitlements();
    if (serverStatus && serverStatus.isPremium) {
      // Sync to local storage for offline access
      await this.syncToLocal(serverStatus);
      return serverStatus;
    }

    // Check local entitlement
    let localEntitlement = await localStore.getEntitlement();
    
    // Auto-start trial on first launch
    if (!localEntitlement) {
      console.log('[EntitlementsService] First launch - auto-starting trial');
      return this.startGuestTrial();
    }
    
    const status = this.entitlementToStatus(localEntitlement);
    
    // If premium or valid trial, return immediately
    if (status.isPremium || (status.isTrial && !status.isTrialExpired)) {
      return status;
    }

    // Check billing providers for premium status
    for (const provider of this.providers) {
      if (provider.isSupported()) {
        const providerStatus = await provider.getStatus();
        if (providerStatus && providerStatus.isPremium) {
          return providerStatus;
        }
      }
    }

    // Return current status (may be expired trial)
    return status;
  }

  /**
   * Check server-side entitlements (for admin grants, etc.)
   */
  private async checkServerEntitlements(): Promise<EntitlementStatus | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: entitlement, error } = await supabase
        .from('entitlements')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error || !entitlement) return null;

      // Check if premium is active
      if (entitlement.premium_status === 'active') {
        const expiresAt = entitlement.premium_until ? new Date(entitlement.premium_until) : null;
        const isExpired = expiresAt ? expiresAt < new Date() : false;

        if (!isExpired) {
          return {
            isPremium: true,
            isTrial: false,
            source: entitlement.premium_source === 'manual' ? 'none' : 'stripe',
            plan: entitlement.premium_source === 'manual' ? 'admin_grant' : 'premium',
            expiresAt: expiresAt || undefined,
            isExpired: false,
            isTrialExpired: false,
          };
        }
      }

      // Check if trial is active
      if (entitlement.premium_status === 'trialing') {
        const trialEndsAt = entitlement.trial_end_at ? new Date(entitlement.trial_end_at) : null;
        const isTrialExpired = trialEndsAt ? trialEndsAt < new Date() : false;
        const trialStartedAt = entitlement.trial_start_at ? new Date(entitlement.trial_start_at) : undefined;

        return {
          isPremium: false,
          isTrial: true,
          trialStartedAt,
          trialEndsAt: trialEndsAt || undefined,
          trialDaysRemaining: trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : 0,
          source: 'none',
          isExpired: false,
          isTrialExpired,
        };
      }

      return null;
    } catch (err) {
      console.warn('[EntitlementsService] Failed to check server entitlements:', err);
      return null;
    }
  }

  /**
   * Sync server entitlement to local storage for offline access
   */
  private async syncToLocal(status: EntitlementStatus): Promise<void> {
    const deviceId = await localStore.getDeviceId();
    await localStore.saveEntitlement({
      deviceId,
      isPremium: status.isPremium,
      isTrial: status.isTrial,
      trialStartedAt: status.trialStartedAt?.getTime(),
      trialEndsAt: status.trialEndsAt?.getTime(),
      expiresAt: status.expiresAt?.getTime(),
      plan: status.plan,
      source: 'server',
    });
  }

  async refresh(): Promise<EntitlementStatus> {
    const status = await this.getStatus();
    this.notifyListeners(status);
    return status;
  }

  // ============= Trial =============
  // Trial works WITHOUT login - it's device-based

  async startGuestTrial(): Promise<EntitlementStatus> {
    const deviceId = await localStore.getDeviceId();
    const now = Date.now();
    const trialEndsAt = now + (APP_CONFIG.guestMode.trialDays * 24 * 60 * 60 * 1000);

    await localStore.saveEntitlement({
      deviceId,
      isPremium: false,
      isTrial: true,
      trialStartedAt: now,
      trialEndsAt,
      source: 'local',
    });

    console.log(`[EntitlementsService] Trial started, ends at ${new Date(trialEndsAt).toISOString()}`);
    return this.refresh();
  }
  
  async isTrialExpired(): Promise<boolean> {
    const status = await this.getStatus();
    return status.isTrialExpired && !status.isPremium;
  }

  async transferTrialToAccount(userId: string): Promise<void> {
    const entitlement = await localStore.getEntitlement();
    if (entitlement?.isTrial && entitlement.trialStartedAt) {
      // Store trial info to be synced with account
      console.log(`[EntitlementsService] Transferring trial to account ${userId}`);
    }
  }
  
  // ============= Dev Tools =============
  
  async devResetTrial(): Promise<EntitlementStatus> {
    if (import.meta.env.DEV) {
      console.log('[EntitlementsService] DEV: Resetting trial');
      const deviceId = await localStore.getDeviceId();
      const now = Date.now();
      const trialEndsAt = now + (APP_CONFIG.guestMode.trialDays * 24 * 60 * 60 * 1000);
      
      await localStore.saveEntitlement({
        deviceId,
        isPremium: false,
        isTrial: true,
        trialStartedAt: now,
        trialEndsAt,
        source: 'local',
      });
      
      return this.refresh();
    }
    return this.getStatus();
  }
  
  async devExpireTrial(): Promise<EntitlementStatus> {
    if (import.meta.env.DEV) {
      console.log('[EntitlementsService] DEV: Expiring trial');
      const deviceId = await localStore.getDeviceId();
      const past = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
      
      await localStore.saveEntitlement({
        deviceId,
        isPremium: false,
        isTrial: true,
        trialStartedAt: past,
        trialEndsAt: past + (7 * 24 * 60 * 60 * 1000), // Expired
        source: 'local',
      });
      
      return this.refresh();
    }
    return this.getStatus();
  }
  
  async devTogglePremium(): Promise<EntitlementStatus> {
    if (import.meta.env.DEV) {
      const current = await localStore.getEntitlement();
      const deviceId = await localStore.getDeviceId();
      
      await localStore.saveEntitlement({
        deviceId,
        isPremium: !current?.isPremium,
        isTrial: false,
        source: 'local',
      });
      
      console.log(`[EntitlementsService] DEV: Premium toggled to ${!current?.isPremium}`);
      return this.refresh();
    }
    return this.getStatus();
  }

  // ============= Purchase =============

  async purchase(planId: string): Promise<PurchaseResult> {
    // Find supported provider
    const provider = this.providers.find(p => p.isSupported());
    
    if (!provider) {
      return {
        success: false,
        error: 'No payment method available on this platform.',
      };
    }

    const result = await provider.purchase(planId);
    
    if (result.success) {
      await this.refresh();
    }

    return result;
  }

  async restorePurchases(): Promise<PurchaseResult> {
    for (const provider of this.providers) {
      if (provider.isSupported()) {
        const result = await provider.restorePurchases();
        if (result.success) {
          await this.refresh();
          return result;
        }
      }
    }

    return {
      success: false,
      error: 'No purchases to restore.',
    };
  }

  // ============= Feature Checks =============

  async hasFeature(feature: string): Promise<boolean> {
    // Free features are always available
    if ((APP_CONFIG.features.freeFeatures as readonly string[]).includes(feature)) {
      return true;
    }

    // Premium features require subscription or trial
    if ((APP_CONFIG.features.premiumFeatures as readonly string[]).includes(feature)) {
      const status = await this.getStatus();
      return status.isPremium || status.isTrial;
    }

    return false;
  }

  async getPremiumFeatures(): Promise<string[]> {
    return [...APP_CONFIG.features.premiumFeatures];
  }

  async getFreeFeatures(): Promise<string[]> {
    return [...APP_CONFIG.features.freeFeatures];
  }

  // ============= Helpers =============

  private entitlementToStatus(entitlement: LocalEntitlement): EntitlementStatus {
    const now = Date.now();
    const isPremiumExpired = entitlement.expiresAt ? entitlement.expiresAt < now : false;
    const isTrialExpired = entitlement.trialEndsAt ? entitlement.trialEndsAt < now : false;

    let trialDaysRemaining: number | undefined;
    if (entitlement.isTrial && entitlement.trialEndsAt && !isTrialExpired) {
      trialDaysRemaining = Math.max(0, Math.ceil((entitlement.trialEndsAt - now) / (24 * 60 * 60 * 1000)));
    }

    return {
      isPremium: entitlement.isPremium && !isPremiumExpired,
      isTrial: entitlement.isTrial,
      trialStartedAt: entitlement.trialStartedAt ? new Date(entitlement.trialStartedAt) : undefined,
      trialEndsAt: entitlement.trialEndsAt ? new Date(entitlement.trialEndsAt) : undefined,
      trialDaysRemaining,
      plan: entitlement.plan,
      source: entitlement.source,
      expiresAt: entitlement.expiresAt ? new Date(entitlement.expiresAt) : undefined,
      isExpired: isPremiumExpired,
      isTrialExpired,
    };
  }

  getAvailableProvider(): BillingProvider | null {
    return this.providers.find(p => p.isSupported()) || null;
  }

  async openManagement(): Promise<void> {
    const provider = this.getAvailableProvider();
    if (provider) {
      await provider.openManagement();
    }
  }
}

export const entitlementsService = new EntitlementsService();
export default entitlementsService;
