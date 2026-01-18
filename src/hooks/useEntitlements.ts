/**
 * useEntitlements - React hook for EntitlementsService
 */

import { useState, useEffect, useCallback } from 'react';
import { entitlementsService, EntitlementStatus, PurchaseResult } from '@/services/EntitlementsService';
import { APP_CONFIG } from '@/config/app';

export interface UseEntitlementsReturn {
  status: EntitlementStatus | null;
  loading: boolean;
  isPremium: boolean;
  isTrial: boolean;
  isTrialExpired: boolean;
  trialDaysRemaining?: number;
  canAccessFeature: (feature: string) => boolean;
  startTrial: () => Promise<void>;
  purchase: (planId: string) => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
  refresh: () => Promise<void>;
  // Dev tools
  devResetTrial: () => Promise<void>;
  devExpireTrial: () => Promise<void>;
  devTogglePremium: () => Promise<void>;
}

export function useEntitlements(): UseEntitlementsReturn {
  const [status, setStatus] = useState<EntitlementStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = entitlementsService.subscribe((newStatus) => {
      setStatus(newStatus);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const canAccessFeature = useCallback((feature: string): boolean => {
    // Free features are always available
    if ((APP_CONFIG.features.freeFeatures as readonly string[]).includes(feature)) {
      return true;
    }

    // Premium features require subscription or trial
    if ((APP_CONFIG.features.premiumFeatures as readonly string[]).includes(feature)) {
      return status?.isPremium || status?.isTrial || false;
    }

    return false;
  }, [status]);

  const startTrial = useCallback(async () => {
    setLoading(true);
    await entitlementsService.startGuestTrial();
    setLoading(false);
  }, []);

  const purchase = useCallback(async (planId: string): Promise<PurchaseResult> => {
    setLoading(true);
    const result = await entitlementsService.purchase(planId);
    setLoading(false);
    return result;
  }, []);

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    setLoading(true);
    const result = await entitlementsService.restorePurchases();
    setLoading(false);
    return result;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await entitlementsService.refresh();
    setLoading(false);
  }, []);

  const devResetTrial = useCallback(async () => {
    await entitlementsService.devResetTrial();
  }, []);

  const devExpireTrial = useCallback(async () => {
    await entitlementsService.devExpireTrial();
  }, []);

  const devTogglePremium = useCallback(async () => {
    await entitlementsService.devTogglePremium();
  }, []);

  return {
    status,
    loading,
    isPremium: status?.isPremium || false,
    isTrial: status?.isTrial || false,
    isTrialExpired: status?.isTrialExpired || false,
    trialDaysRemaining: status?.trialDaysRemaining,
    canAccessFeature,
    startTrial,
    purchase,
    restorePurchases,
    refresh,
    devResetTrial,
    devExpireTrial,
    devTogglePremium,
  };
}

export default useEntitlements;
