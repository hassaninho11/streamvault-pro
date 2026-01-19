/**
 * AdminAudit - Audit logs page
 */

import { useState, useEffect } from 'react';
import { ScrollText, Crown, Ban, UserCog, FileText, Settings } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { adminService, AuditLog } from '@/services/AdminService';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

const actionIcons: Record<string, React.ElementType> = {
  grant_premium: Crown,
  revoke_premium: Crown,
  disable_user: Ban,
  enable_user: Ban,
  change_role: UserCog,
  note_update: FileText,
  bug_status_change: ScrollText,
  settings_change: Settings,
};

const actionLabels: Record<string, string> = {
  grant_premium: 'Premium tilldelat',
  revoke_premium: 'Premium återkallat',
  disable_user: 'Användare inaktiverad',
  enable_user: 'Användare aktiverad',
  change_role: 'Roll ändrad',
  note_update: 'Anteckning uppdaterad',
  bug_status_change: 'Bugg-status ändrad',
  settings_change: 'Inställningar ändrade',
};

export function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = await adminService.getAuditLogs(100);
        setLogs(data);
      } catch (err) {
        toast.error('Kunde inte ladda audit logs');
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, []);

  const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (action.includes('revoke') || action.includes('disable')) return 'destructive';
    if (action.includes('grant') || action.includes('enable')) return 'default';
    return 'secondary';
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">Spårning av alla admin-åtgärder</p>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tidpunkt</TableHead>
                <TableHead>Åtgärd</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Mål</TableHead>
                <TableHead>Detaljer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Laddar...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Inga audit logs
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const Icon = actionIcons[log.actionType] || ScrollText;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.createdAt), 'PPp', { locale: sv })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <Badge variant={getActionBadgeVariant(log.actionType)}>
                            {actionLabels[log.actionType] || log.actionType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {log.adminUserId.slice(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell>
                        {log.targetUserId ? (
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {log.targetUserId.slice(0, 8)}...
                          </code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.afterJson && (
                          <code className="text-xs bg-muted px-2 py-1 rounded block max-w-xs truncate">
                            {JSON.stringify(log.afterJson)}
                          </code>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAudit;
