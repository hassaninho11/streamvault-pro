/**
 * AdminPremium - Premium management page
 */

import { useState, useEffect } from 'react';
import { Crown, Clock, Infinity, X } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { adminService, AdminUser } from '@/services/AdminService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { sv } from 'date-fns/locale';

export function AdminPremium() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      setLoading(true);
      // Get all users and filter for manual grants
      const allUsers = await adminService.getUsers({});
      const premiumUsers = allUsers.filter(u => 
        u.premiumStatus === 'active' && u.premiumSource === 'manual'
      );
      setUsers(premiumUsers);
    } catch (err) {
      toast.error('Kunde inte ladda premium-användare');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRevoke = async (user: AdminUser) => {
    try {
      await adminService.revokePremium(user.id);
      toast.success('Premium återkallat');
      loadUsers();
    } catch (err) {
      toast.error('Kunde inte återkalla premium');
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Premium-hantering</h1>
          <p className="text-muted-foreground">Hantera manuella premium-tilldelningar</p>
        </div>

        {/* Quick Grant Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                30 dagar
              </CardTitle>
              <CardDescription>Kortare testperiod</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Ge en användare 30 dagars premium-access
              </p>
              <Button variant="outline" className="w-full" disabled>
                Välj användare först
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5" />
                1 år
              </CardTitle>
              <CardDescription>Standard premium</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Ge en användare 1 års premium-access
              </p>
              <Button variant="outline" className="w-full" disabled>
                Välj användare först
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Infinity className="w-5 h-5" />
                Livstid
              </CardTitle>
              <CardDescription>Permanent access</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Ge en användare permanent premium-access
              </p>
              <Button variant="outline" className="w-full" disabled>
                Välj användare först
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Manual Grants List */}
        <div className="border rounded-lg">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Manuella tilldelningar</h2>
            <p className="text-sm text-muted-foreground">
              Användare som fått premium manuellt (ej via köp)
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Användare</TableHead>
                <TableHead>Tilldelad</TableHead>
                <TableHead>Giltig till</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Åtgärd</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Laddar...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Inga manuella premium-tilldelningar
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.displayName || 'Inget namn'}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Manuell</Badge>
                    </TableCell>
                    <TableCell>
                      {user.premiumUntil ? (
                        <div>
                          <div>{format(new Date(user.premiumUntil), 'PPP', { locale: sv })}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(user.premiumUntil), { addSuffix: true, locale: sv })}
                          </div>
                        </div>
                      ) : (
                        <Badge className="bg-purple-500">Livstid</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-500">Aktiv</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleRevoke(user)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Återkalla
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminPremium;
