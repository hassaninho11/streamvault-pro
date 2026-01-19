/**
 * UserDetailDrawer - Detailed user view with audit history
 */

import { useState, useEffect } from 'react';
import { 
  Crown, 
  Ban, 
  UserCog, 
  FileText, 
  Mail,
  Calendar,
  Activity,
  Server,
  ScrollText
} from 'lucide-react';
import { AdminUser, AuditLog, adminService } from '@/services/AdminService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface UserDetailDrawerProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
}

export function UserDetailDrawer({ user, open, onOpenChange, onUserUpdated }: UserDetailDrawerProps) {
  const { isOwner } = useAdminAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notes, setNotes] = useState('');
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (user && open) {
      setNotes(user.adminNotes || '');
      loadAuditLogs();
    }
  }, [user, open]);

  const loadAuditLogs = async () => {
    if (!user) return;
    setLoadingAudit(true);
    try {
      const logs = await adminService.getAuditLogs(100);
      // Filter to only show logs related to this user
      const userLogs = logs.filter(
        log => log.targetUserId === user.id || log.adminUserId === user.id
      );
      setAuditLogs(userLogs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleGrantPremium = async (duration: 'month' | 'year' | 'lifetime') => {
    if (!user) return;
    try {
      await adminService.grantPremium(user.id, duration);
      toast.success('Premium aktiverat');
      onUserUpdated();
    } catch (err) {
      toast.error('Kunde inte aktivera premium');
    }
  };

  const handleRevokePremium = async () => {
    if (!user) return;
    try {
      await adminService.revokePremium(user.id);
      toast.success('Premium återkallat');
      onUserUpdated();
    } catch (err) {
      toast.error('Kunde inte återkalla premium');
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;
    try {
      const newStatus = user.status === 'active' ? 'disabled' : 'active';
      await adminService.toggleUserStatus(user.id, newStatus);
      toast.success(newStatus === 'active' ? 'Användare aktiverad' : 'Användare inaktiverad');
      onUserUpdated();
    } catch (err) {
      toast.error('Kunde inte ändra status');
    }
  };

  const handleChangeRole = async () => {
    if (!user) return;
    try {
      const newRole = user.role === 'admin' ? 'user' : 'admin';
      await adminService.changeUserRole(user.id, newRole);
      toast.success('Roll uppdaterad');
      onUserUpdated();
    } catch (err) {
      toast.error('Kunde inte ändra roll');
    }
  };

  const handleSaveNotes = async () => {
    if (!user) return;
    setSavingNotes(true);
    try {
      await adminService.updateAdminNotes(user.id, notes);
      toast.success('Anteckningar sparade');
    } catch (err) {
      toast.error('Kunde inte spara anteckningar');
    } finally {
      setSavingNotes(false);
    }
  };

  if (!user) return null;

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner': return <Badge variant="default">OWNER</Badge>;
      case 'admin': return <Badge variant="secondary">ADMIN</Badge>;
      default: return <Badge variant="outline">USER</Badge>;
    }
  };

  const getPremiumBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-500">Premium</Badge>;
      case 'trialing': return <Badge className="bg-blue-500">Trial</Badge>;
      case 'revoked': return <Badge variant="destructive">Återkallat</Badge>;
      case 'expired': return <Badge variant="outline">Utgånget</Badge>;
      default: return <Badge variant="outline">Gratis</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold">
              {user.email[0]?.toUpperCase()}
            </div>
            <div>
              <div>{user.displayName || 'Inget namn'}</div>
              <div className="text-sm font-normal text-muted-foreground">{user.email}</div>
            </div>
          </SheetTitle>
          <SheetDescription className="flex flex-wrap gap-2 mt-2">
            {getRoleBadge(user.role)}
            {getPremiumBadge(user.premiumStatus)}
            <Badge variant={user.status === 'active' ? 'outline' : 'destructive'}>
              {user.status === 'active' ? 'Aktiv' : 'Inaktiverad'}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="info" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="actions">Åtgärder</TabsTrigger>
            <TabsTrigger value="history">Historik</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Registrerad:</span>
                <span>{format(new Date(user.createdAt), 'PP', { locale: sv })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Senast aktiv:</span>
                <span>
                  {user.lastSeenAt 
                    ? formatDistanceToNow(new Date(user.lastSeenAt), { addSuffix: true, locale: sv })
                    : 'Aldrig'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Server className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Providers:</span>
                <span>{user.providerCount}</span>
              </div>
            </div>

            {user.premiumStatus === 'active' && user.premiumUntil && (
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-sm">
                  <Crown className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium">Premium aktiv</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Källa: {user.premiumSource} • 
                  Giltig till: {format(new Date(user.premiumUntil), 'PPP', { locale: sv })}
                </p>
              </div>
            )}

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" />
                <span className="font-medium">Interna anteckningar</span>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Skriv interna anteckningar här..."
                rows={4}
              />
              <Button 
                size="sm" 
                className="mt-2" 
                onClick={handleSaveNotes}
                disabled={savingNotes}
              >
                {savingNotes ? 'Sparar...' : 'Spara anteckningar'}
              </Button>
            </div>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="space-y-4 mt-4">
            {/* Premium Actions */}
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Premium
              </h4>
              {user.premiumStatus !== 'active' ? (
                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleGrantPremium('month')}>
                    30 dagar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleGrantPremium('year')}>
                    1 år
                  </Button>
                  <Button size="sm" onClick={() => handleGrantPremium('lifetime')}>
                    Livstid
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="destructive" onClick={handleRevokePremium}>
                  Återkalla Premium
                </Button>
              )}
            </div>

            <Separator />

            {/* Status Actions */}
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Ban className="w-4 h-4" />
                Kontostatus
              </h4>
              <Button 
                size="sm" 
                variant={user.status === 'active' ? 'destructive' : 'default'}
                onClick={handleToggleStatus}
              >
                {user.status === 'active' ? 'Inaktivera konto' : 'Aktivera konto'}
              </Button>
            </div>

            {/* Role Actions (Owner only) */}
            {isOwner && user.role !== 'owner' && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <UserCog className="w-4 h-4" />
                    Roll
                  </h4>
                  <Button size="sm" variant="outline" onClick={handleChangeRole}>
                    {user.role === 'admin' ? 'Ta bort admin-roll' : 'Gör till admin'}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            <div className="flex items-center gap-2 mb-4">
              <ScrollText className="w-4 h-4" />
              <span className="font-medium">Aktivitetslogg</span>
            </div>
            
            {loadingAudit ? (
              <div className="text-center py-8 text-muted-foreground">Laddar...</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Ingen aktivitet registrerad
              </div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1">
                      <div className="font-medium">{log.actionType.replace('_', ' ')}</div>
                      <div className="text-muted-foreground">
                        {format(new Date(log.createdAt), 'PPp', { locale: sv })}
                      </div>
                      {log.afterJson && (
                        <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 block">
                          {JSON.stringify(log.afterJson)}
                        </code>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

export default UserDetailDrawer;
