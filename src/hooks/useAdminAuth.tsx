/**
 * useAdminAuth - Hook for admin authentication and authorization
 * Uses server-side role verification via Supabase RLS
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AppRole = 'owner' | 'admin' | 'user';

export interface AdminAuthState {
  isAdmin: boolean;
  isOwner: boolean;
  role: AppRole | null;
  loading: boolean;
  error: string | null;
}

export function useAdminAuth(): AdminAuthState {
  const { user } = useAuth();
  const [state, setState] = useState<AdminAuthState>({
    isAdmin: false,
    isOwner: false,
    role: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user) {
      setState({
        isAdmin: false,
        isOwner: false,
        role: null,
        loading: false,
        error: null,
      });
      return;
    }

    const checkRole = async () => {
      try {
        // Query user_roles table - RLS will only return rows if user is admin/owner
        const { data: roles, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          // If no access, user is not admin
          setState({
            isAdmin: false,
            isOwner: false,
            role: 'user',
            loading: false,
            error: null,
          });
          return;
        }

        // Check roles
        const userRoles = roles?.map(r => r.role) || [];
        const isOwner = userRoles.includes('owner');
        const isAdmin = isOwner || userRoles.includes('admin');
        const role = isOwner ? 'owner' : (isAdmin ? 'admin' : 'user');

        setState({
          isAdmin,
          isOwner,
          role,
          loading: false,
          error: null,
        });
      } catch (err) {
        setState({
          isAdmin: false,
          isOwner: false,
          role: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    checkRole();
  }, [user]);

  return state;
}

export default useAdminAuth;
