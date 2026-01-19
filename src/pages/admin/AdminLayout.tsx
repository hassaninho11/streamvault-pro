/**
 * AdminLayout - Layout wrapper for admin pages
 */

import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Crown, 
  Bug, 
  ScrollText, 
  Settings,
  ArrowLeft,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Badge } from '@/components/ui/badge';

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/users', label: 'Användare', icon: Users },
  { path: '/admin/premium', label: 'Premium', icon: Crown },
  { path: '/admin/bugs', label: 'Bugrapporter', icon: Bug },
  { path: '/admin/audit', label: 'Audit Logs', icon: ScrollText },
  { path: '/admin/settings', label: 'Inställningar', icon: Settings },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const { role, isOwner } = useAdminAuth();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">Admin Panel</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={isOwner ? 'default' : 'secondary'}>
              {role?.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Back to app */}
        <div className="p-4 border-t border-border">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka till appen
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default AdminLayout;
