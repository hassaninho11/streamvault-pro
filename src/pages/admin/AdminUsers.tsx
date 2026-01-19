/**
 * AdminUsers - User management page
 */

import { useState, useEffect } from 'react';
import { Search, MoreHorizontal, Crown, Ban, UserCog, FileText } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { adminService, AdminUser } from '@/services/AdminService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export function AdminUsers() {
  const { isOwner } = useAdminAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [premiumFilter, setPremiumFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // Dialog states
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await adminService.getUsers({
        search,
        role: roleFilter || undefined,
        premiumStatus: premiumFilter || undefined,
        status: statusFilter || undefined,
      });
      setUsers(data);
    } catch (err) {
      toast.error('Kunde inte ladda användare');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [search, roleFilter, premiumFilter, statusFilter]);

  const handleGrantPremium = async (duration: 'month' | 'year' | 'lifetime') => {
    if (!selectedUser) return;
    try {
      await adminService.grantPremium(selectedUser.id, duration);
      toast.success('Premium aktiverat');
      setPremiumDialogOpen(false);
      loadUsers();
    } catch (err) {
      toast.error('Kunde inte aktivera premium');
    }
  };

  const handleRevokePremium = async (user: AdminUser) => {
    try {
      await adminService.revokePremium(user.id);
      toast.success('Premium återkallat');
      loadUsers();
    } catch (err) {
      toast.error('Kunde inte återkalla premium');
    }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    try {
      const newStatus = user.status === 'active' ? 'disabled' : 'active';
      await adminService.toggleUserStatus(user.id, newStatus);
      toast.success(newStatus === 'active' ? 'Användare aktiverad' : 'Användare inaktiverad');
      loadUsers();
    } catch (err) {
      toast.error('Kunde inte ändra status');
    }
  };

  const handleChangeRole = async (user: AdminUser, newRole: 'admin' | 'user') => {
    try {
      await adminService.changeUserRole(user.id, newRole);
      toast.success('Roll uppdaterad');
      loadUsers();
    } catch (err) {
      toast.error('Kunde inte ändra roll');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedUser) return;
    try {
      await adminService.updateAdminNotes(selectedUser.id, notes);
      toast.success('Anteckningar sparade');
      setNotesDialogOpen(false);
      loadUsers();
    } catch (err) {
      toast.error('Kunde inte spara anteckningar');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="default">OWNER</Badge>;
      case 'admin':
        return <Badge variant="secondary">ADMIN</Badge>;
      default:
        return <Badge variant="outline">USER</Badge>;
    }
  };

  const getPremiumBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Premium</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500">Trial</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Återkallat</Badge>;
      case 'expired':
        return <Badge variant="outline">Utgånget</Badge>;
      default:
        return <Badge variant="outline">Gratis</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Användare</h1>
          <p className="text-muted-foreground">Hantera användare och behörigheter</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Sök på email eller namn..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={roleFilter || 'all'} onValueChange={(v) => setRoleFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Roll" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla roller</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>

          <Select value={premiumFilter || 'all'} onValueChange={(v) => setPremiumFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Premium" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="active">Premium</SelectItem>
              <SelectItem value="trialing">Trial</SelectItem>
              <SelectItem value="none">Gratis</SelectItem>
              <SelectItem value="expired">Utgånget</SelectItem>
              <SelectItem value="revoked">Återkallat</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="disabled">Inaktiverad</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Användare</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registrerad</TableHead>
                <TableHead>Senast aktiv</TableHead>
                <TableHead className="text-right">Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Laddar...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Inga användare hittades
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
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getPremiumBadge(user.premiumStatus)}
                        {user.premiumUntil && (
                          <span className="text-xs text-muted-foreground">
                            t.o.m. {new Date(user.premiumUntil).toLocaleDateString('sv-SE')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'active' ? 'outline' : 'destructive'}>
                        {user.status === 'active' ? 'Aktiv' : 'Inaktiverad'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true, locale: sv })}
                    </TableCell>
                    <TableCell>
                      {user.lastSeenAt 
                        ? formatDistanceToNow(new Date(user.lastSeenAt), { addSuffix: true, locale: sv })
                        : 'Aldrig'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Åtgärder</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          
                          {/* Premium actions */}
                          {user.premiumStatus !== 'active' ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setPremiumDialogOpen(true);
                              }}
                            >
                              <Crown className="w-4 h-4 mr-2" />
                              Ge Premium
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleRevokePremium(user)}>
                              <Crown className="w-4 h-4 mr-2" />
                              Återkalla Premium
                            </DropdownMenuItem>
                          )}

                          {/* Status toggle */}
                          <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                            <Ban className="w-4 h-4 mr-2" />
                            {user.status === 'active' ? 'Inaktivera' : 'Aktivera'}
                          </DropdownMenuItem>

                          {/* Role change (owner only, can't change owner role) */}
                          {isOwner && user.role !== 'owner' && (
                            <DropdownMenuItem
                              onClick={() => handleChangeRole(user, user.role === 'admin' ? 'user' : 'admin')}
                            >
                              <UserCog className="w-4 h-4 mr-2" />
                              {user.role === 'admin' ? 'Ta bort admin' : 'Gör till admin'}
                            </DropdownMenuItem>
                          )}

                          {/* Notes */}
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setNotes(user.adminNotes || '');
                              setNotesDialogOpen(true);
                            }}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Anteckningar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Grant Premium Dialog */}
        <Dialog open={premiumDialogOpen} onOpenChange={setPremiumDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ge Premium</DialogTitle>
              <DialogDescription>
                Ge premium till {selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-4">
              <Button onClick={() => handleGrantPremium('month')} variant="outline">
                30 dagar
              </Button>
              <Button onClick={() => handleGrantPremium('year')} variant="outline">
                1 år
              </Button>
              <Button onClick={() => handleGrantPremium('lifetime')}>
                Livstid
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Notes Dialog */}
        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Interna anteckningar</DialogTitle>
              <DialogDescription>
                Anteckningar för {selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Skriv interna anteckningar här..."
              rows={5}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
                Avbryt
              </Button>
              <Button onClick={handleSaveNotes}>Spara</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

export default AdminUsers;
