/**
 * AdminDashboard - Main admin dashboard with statistics
 */

import { useState, useEffect } from 'react';
import { 
  Users, 
  Crown, 
  Clock, 
  TrendingUp, 
  Bug, 
  AlertTriangle,
  ShoppingCart,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminLayout } from './AdminLayout';
import { adminService, DashboardStats } from '@/services/AdminService';
import { Skeleton } from '@/components/ui/skeleton';

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  loading 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ElementType; 
  description?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await adminService.getDashboardStats();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Översikt över StreamVault</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {/* User Stats */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Användare</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Totalt antal användare"
              value={stats?.totalUsers || 0}
              icon={Users}
              loading={loading}
            />
            <StatCard
              title="Nya senaste 7 dagarna"
              value={stats?.newUsersLast7Days || 0}
              icon={TrendingUp}
              loading={loading}
            />
            <StatCard
              title="DAU (24h)"
              value={stats?.activeUsersLast24h || 0}
              icon={Activity}
              description="Aktiva senaste 24h"
              loading={loading}
            />
            <StatCard
              title="MAU (30d)"
              value={stats?.activeUsersLast30Days || 0}
              icon={Clock}
              description="Aktiva senaste 30 dagar"
              loading={loading}
            />
          </div>
        </div>

        {/* Subscription Stats */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Prenumerationer</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Aktiva trials"
              value={stats?.trialActiveCount || 0}
              icon={Clock}
              loading={loading}
            />
            <StatCard
              title="Premium-användare"
              value={stats?.premiumActiveCount || 0}
              icon={Crown}
              loading={loading}
            />
            <StatCard
              title="Köp totalt"
              value={stats?.purchasesCount || 0}
              icon={ShoppingCart}
              description="Lyckade köp"
              loading={loading}
            />
          </div>
        </div>

        {/* Bug Stats */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Buggar & Problem</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            <StatCard
              title="Öppna buggar"
              value={stats?.openBugsCount || 0}
              icon={Bug}
              loading={loading}
            />
            <StatCard
              title="Kritiska buggar"
              value={stats?.criticalBugsCount || 0}
              icon={AlertTriangle}
              description="Kräver omedelbar åtgärd"
              loading={loading}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminDashboard;
