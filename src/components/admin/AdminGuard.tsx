/**
 * AdminGuard - Protects admin routes from unauthorized access
 * Requires server-verified admin/owner role
 */

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Loader2 } from 'lucide-react';

interface AdminGuardProps {
  children: ReactNode;
  requireOwner?: boolean;
}

export function AdminGuard({ children, requireOwner = false }: AdminGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isOwner, loading: roleLoading } = useAdminAuth();

  // Show loading while checking auth
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifierar behörighet...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check access
  const hasAccess = requireOwner ? isOwner : isAdmin;

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Åtkomst nekad</h1>
          <p className="text-muted-foreground">
            Du har inte behörighet att se denna sida. Endast administratörer har tillgång till Admin Panel.
          </p>
          <a 
            href="/" 
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Tillbaka till startsidan
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default AdminGuard;
