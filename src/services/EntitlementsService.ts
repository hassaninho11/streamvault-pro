/**
 * EntitlementsService - Centralized entitlements management
 * Abstracts payment providers (Stripe, IAP) from UI
 */

import { localStore, LocalEntitlement } from '@/data/stores/localStore';
import { APP_CONFIG } from '@/config/app';

// ============= Types =============

export interface EntitlementStatus {
  isPremium: boolean;
  isTrial: boolean;
  trialEndsAt?: Date;
  trialDaysRemaining?: number;
  plan?: string;
  source: 'local' | 'stripe' | 'iap' | 'none';
  expiresAt?: Date;
  isExpired: boolean;
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
    // For now, return not implemented
    return {
      success: false,
      error: 'Stripe integration not configured. Enable Stripe in settings.',
    };
  }

  async restorePurchases(): Promise<PurchaseResult> {
    // Stripe subscriptions are linked to email/account
    // Will be synced when user logs in
    return {
      success: false,
      error: 'Please log in to restore your subscription.',
    };
  }

  async getStatus(): Promise<EntitlementStatus | null> {
    // This will check Stripe subscription status via edge function
    return null;
  }

  async openManagement(): Promise<void> {
    // Open Stripe customer portal
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
      error: 'In-app purchases coming soon!',
    };
  }

  async restorePurchases(): Promise<PurchaseResult> {
    return {
      success: false,
      error: 'In-app purchases coming soon!',
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
    // Check local entitlement first
    const localEntitlement = await localStore.getEntitlement();
    
    if (localEntitlement) {
      const status = this.entitlementToStatus(localEntitlement);
      
      // If we have a valid local status, use it
      if (status.isPremium || status.isTrial) {
        return status;
      }
    }

    // Check billing providers
    for (const provider of this.providers) {
      if (provider.isSupported()) {
        const providerStatus = await provider.getStatus();
        if (providerStatus && (providerStatus.isPremium || providerStatus.isTrial)) {
          return providerStatus;
        }
      }
    }

    // No entitlements found
    return {
      isPremium: false,
      isTrial: false,
      source: 'none',
      isExpired: false,
    };
  }

  async refresh(): Promise<EntitlementStatus> {
    const status = await this.getStatus();
    this.notifyListeners(status);
    return status;
  }

  // ============= Trial =============

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

    return this.refresh();
  }

  async transferTrialToAccount(userId: string): Promise<void> {
    const entitlement = await localStore.getEntitlement();
    if (entitlement?.isTrial && entitlement.trialStartedAt) {
      // Store trial info to be synced with account
      // This would be sent to the backend to preserve trial period
      console.log(`Transferring trial started at ${entitlement.trialStartedAt} to account ${userId}`);
    }
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
    const isExpired = entitlement.expiresAt ? entitlement.expiresAt < now : false;
    const trialExpired = entitlement.trialEndsAt ? entitlement.trialEndsAt < now : false;

    let trialDaysRemaining: number | undefined;
    if (entitlement.isTrial && entitlement.trialEndsAt && !trialExpired) {
      trialDaysRemaining = Math.ceil((entitlement.trialEndsAt - now) / (24 * 60 * 60 * 1000));
    }

    return {
      isPremium: entitlement.isPremium && !isExpired,
      isTrial: entitlement.isTrial && !trialExpired,
      trialEndsAt: entitlement.trialEndsAt ? new Date(entitlement.trialEndsAt) : undefined,
      trialDaysRemaining,
      plan: entitlement.plan,
      source: entitlement.source,
      expiresAt: entitlement.expiresAt ? new Date(entitlement.expiresAt) : undefined,
      isExpired: isExpired || trialExpired,
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
