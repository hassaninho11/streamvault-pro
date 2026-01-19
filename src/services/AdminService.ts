/**
 * AdminService - Backend operations for admin panel
 * All operations are protected by RLS policies
 */

import { supabase } from '@/integrations/supabase/client';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  status: 'active' | 'disabled';
  role: 'owner' | 'admin' | 'user';
  deviceCount: number;
  providerCount: number;
  premiumStatus: string;
  premiumUntil: string | null;
  premiumSource: string;
  adminNotes: string | null;
}

export interface BugReport {
  id: string;
  userId: string | null;
  userEmail?: string;
  platform: string | null;
  appVersion: string | null;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'triaged' | 'in_progress' | 'done' | 'wont_fix';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  adminUserId: string;
  adminEmail?: string;
  actionType: string;
  targetUserId: string | null;
  targetEmail?: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  newUsersLast7Days: number;
  activeUsersLast24h: number;
  activeUsersLast30Days: number;
  trialActiveCount: number;
  premiumActiveCount: number;
  purchasesCount: number;
  openBugsCount: number;
  criticalBugsCount: number;
}

class AdminService {
  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get user counts
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: newUsersLast7Days } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last7Days.toISOString());

    // Get active users from metadata
    const { count: activeUsersLast24h } = await supabase
      .from('admin_user_metadata')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen_at', last24h.toISOString());

    const { count: activeUsersLast30Days } = await supabase
      .from('admin_user_metadata')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen_at', last30Days.toISOString());

    // Get entitlement counts
    const { count: trialActiveCount } = await supabase
      .from('entitlements')
      .select('*', { count: 'exact', head: true })
      .eq('premium_status', 'trialing');

    const { count: premiumActiveCount } = await supabase
      .from('entitlements')
      .select('*', { count: 'exact', head: true })
      .eq('premium_status', 'active');

    // Get purchase count
    const { count: purchasesCount } = await supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'success');

    // Get bug counts
    const { count: openBugsCount } = await supabase
      .from('bug_reports')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'triaged', 'in_progress']);

    const { count: criticalBugsCount } = await supabase
      .from('bug_reports')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'critical')
      .in('status', ['open', 'triaged', 'in_progress']);

    return {
      totalUsers: totalUsers || 0,
      newUsersLast7Days: newUsersLast7Days || 0,
      activeUsersLast24h: activeUsersLast24h || 0,
      activeUsersLast30Days: activeUsersLast30Days || 0,
      trialActiveCount: trialActiveCount || 0,
      premiumActiveCount: premiumActiveCount || 0,
      purchasesCount: purchasesCount || 0,
      openBugsCount: openBugsCount || 0,
      criticalBugsCount: criticalBugsCount || 0,
    };
  }

  /**
   * Get all users with their roles and entitlements
   */
  async getUsers(filters?: {
    search?: string;
    role?: string;
    premiumStatus?: string;
    status?: string;
  }): Promise<AdminUser[]> {
    // Get profiles
    let profilesQuery = supabase
      .from('profiles')
      .select('id, user_id, email, display_name, created_at');

    if (filters?.search) {
      profilesQuery = profilesQuery.or(`email.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%`);
    }

    const { data: profiles, error: profilesError } = await profilesQuery;
    if (profilesError) throw profilesError;
    if (!profiles?.length) return [];

    const userIds = profiles.map(p => p.user_id);

    // Get roles, metadata, and entitlements in parallel
    const [rolesResult, metadataResult, entitlementsResult] = await Promise.all([
      supabase.from('user_roles').select('*').in('user_id', userIds),
      supabase.from('admin_user_metadata').select('*').in('user_id', userIds),
      supabase.from('entitlements').select('*').in('user_id', userIds),
    ]);

    // Build user objects
    const users: AdminUser[] = profiles.map(profile => {
      const role = rolesResult.data?.find(r => r.user_id === profile.user_id);
      const metadata = metadataResult.data?.find(m => m.user_id === profile.user_id);
      const entitlement = entitlementsResult.data?.find(e => e.user_id === profile.user_id);

      return {
        id: profile.user_id,
        email: profile.email || '',
        displayName: profile.display_name,
        createdAt: profile.created_at,
        lastSeenAt: metadata?.last_seen_at || null,
        status: (metadata?.status as 'active' | 'disabled') || 'active',
        role: (role?.role as 'owner' | 'admin' | 'user') || 'user',
        deviceCount: metadata?.device_count || 0,
        providerCount: metadata?.provider_count || 0,
        premiumStatus: entitlement?.premium_status || 'none',
        premiumUntil: entitlement?.premium_until || null,
        premiumSource: entitlement?.premium_source || 'none',
        adminNotes: metadata?.admin_notes || null,
      };
    });

    // Apply filters
    let filtered = users;
    if (filters?.role) {
      filtered = filtered.filter(u => u.role === filters.role);
    }
    if (filters?.premiumStatus) {
      filtered = filtered.filter(u => u.premiumStatus === filters.premiumStatus);
    }
    if (filters?.status) {
      filtered = filtered.filter(u => u.status === filters.status);
    }

    return filtered;
  }

  /**
   * Grant premium to a user
   */
  async grantPremium(
    userId: string,
    duration: 'month' | 'year' | 'lifetime',
    reason?: string
  ): Promise<void> {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) throw new Error('Not authenticated');

    // Calculate end date
    let premiumUntil: string | null = null;
    if (duration !== 'lifetime') {
      const endDate = new Date();
      if (duration === 'month') {
        endDate.setDate(endDate.getDate() + 30);
      } else if (duration === 'year') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }
      premiumUntil = endDate.toISOString();
    }

    // Get current entitlement for audit log
    const { data: currentEntitlement } = await supabase
      .from('entitlements')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Update entitlement
    const { error: updateError } = await supabase
      .from('entitlements')
      .upsert({
        user_id: userId,
        premium_source: 'manual',
        premium_status: 'active',
        premium_until: premiumUntil,
        granted_by: adminUser.id,
        grant_reason: reason || `Manual grant: ${duration}`,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (updateError) throw updateError;

    // Create audit log
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action_type: 'grant_premium',
      target_user_id: userId,
      before_json: currentEntitlement || null,
      after_json: {
        premium_source: 'manual',
        premium_status: 'active',
        premium_until: premiumUntil,
        grant_reason: reason || `Manual grant: ${duration}`,
      },
    });
  }

  /**
   * Revoke premium from a user
   */
  async revokePremium(userId: string, reason?: string): Promise<void> {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) throw new Error('Not authenticated');

    // Get current entitlement for audit log
    const { data: currentEntitlement } = await supabase
      .from('entitlements')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Update entitlement
    const { error: updateError } = await supabase
      .from('entitlements')
      .update({
        premium_status: 'revoked',
        premium_until: new Date().toISOString(),
        grant_reason: reason || 'Premium revoked by admin',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Create audit log
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action_type: 'revoke_premium',
      target_user_id: userId,
      before_json: currentEntitlement || null,
      after_json: {
        premium_status: 'revoked',
        premium_until: new Date().toISOString(),
      },
    });
  }

  /**
   * Toggle user status (active/disabled)
   */
  async toggleUserStatus(userId: string, newStatus: 'active' | 'disabled'): Promise<void> {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) throw new Error('Not authenticated');

    // Get current metadata for audit log
    const { data: currentMetadata } = await supabase
      .from('admin_user_metadata')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Update status
    const { error: updateError } = await supabase
      .from('admin_user_metadata')
      .upsert({
        user_id: userId,
        status: newStatus,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (updateError) throw updateError;

    // Create audit log
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action_type: newStatus === 'disabled' ? 'disable_user' : 'enable_user',
      target_user_id: userId,
      before_json: currentMetadata || null,
      after_json: { status: newStatus },
    });
  }

  /**
   * Change user role (owner only)
   */
  async changeUserRole(userId: string, newRole: 'admin' | 'user'): Promise<void> {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) throw new Error('Not authenticated');

    // Get current role for audit log
    const { data: currentRole } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Update or insert role
    const { error: updateError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: newRole,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id, role' });

    if (updateError) throw updateError;

    // Create audit log
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action_type: 'change_role',
      target_user_id: userId,
      before_json: currentRole || null,
      after_json: { role: newRole },
    });
  }

  /**
   * Update admin notes for a user
   */
  async updateAdminNotes(userId: string, notes: string): Promise<void> {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) throw new Error('Not authenticated');

    const { error: updateError } = await supabase
      .from('admin_user_metadata')
      .upsert({
        user_id: userId,
        admin_notes: notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (updateError) throw updateError;

    // Create audit log
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action_type: 'note_update',
      target_user_id: userId,
      after_json: { admin_notes: notes },
    });
  }

  /**
   * Get bug reports
   */
  async getBugReports(filters?: {
    severity?: string;
    status?: string;
    platform?: string;
  }): Promise<BugReport[]> {
    let query = supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.severity) {
      query = query.eq('severity', filters.severity);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.platform) {
      query = query.eq('platform', filters.platform);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(bug => ({
      id: bug.id,
      userId: bug.user_id,
      platform: bug.platform,
      appVersion: bug.app_version,
      title: bug.title,
      description: bug.description,
      severity: bug.severity as 'low' | 'medium' | 'high' | 'critical',
      status: bug.status as 'open' | 'triaged' | 'in_progress' | 'done' | 'wont_fix',
      tags: bug.tags || [],
      createdAt: bug.created_at,
      updatedAt: bug.updated_at,
    }));
  }

  /**
   * Update bug report status
   */
  async updateBugStatus(bugId: string, status: string): Promise<void> {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('bug_reports')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bugId);

    if (error) throw error;

    // Create audit log
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action_type: 'bug_status_change',
      after_json: { bug_id: bugId, status },
    });
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(log => ({
      id: log.id,
      adminUserId: log.admin_user_id,
      actionType: log.action_type,
      targetUserId: log.target_user_id,
      beforeJson: log.before_json as Record<string, unknown> | null,
      afterJson: log.after_json as Record<string, unknown> | null,
      createdAt: log.created_at,
    }));
  }

  /**
   * Get feature flags
   */
  async getFeatureFlags(): Promise<Array<{ key: string; enabled: boolean; description: string | null }>> {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('flag_key, enabled, description')
      .order('flag_key');

    if (error) throw error;

    return (data || []).map(flag => ({
      key: flag.flag_key,
      enabled: flag.enabled,
      description: flag.description,
    }));
  }

  /**
   * Toggle feature flag (owner only)
   */
  async toggleFeatureFlag(flagKey: string, enabled: boolean): Promise<void> {
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('feature_flags')
      .update({ 
        enabled, 
        updated_by: adminUser.id,
        updated_at: new Date().toISOString() 
      })
      .eq('flag_key', flagKey);

    if (error) throw error;

    // Create audit log
    await supabase.from('audit_logs').insert({
      admin_user_id: adminUser.id,
      action_type: 'settings_change',
      after_json: { feature_flag: flagKey, enabled },
    });
  }
}

export const adminService = new AdminService();
export default adminService;
