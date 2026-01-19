/**
 * AdminBugs - Bug reports management page
 */

import { useState, useEffect } from 'react';
import { Bug, CheckCircle, Clock, XCircle, Filter } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { adminService, BugReport } from '@/services/AdminService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

const severityColors: Record<string, string> = {
  low: 'bg-slate-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const statusIcons: Record<string, React.ElementType> = {
  open: Bug,
  triaged: Filter,
  in_progress: Clock,
  done: CheckCircle,
  wont_fix: XCircle,
};

export function AdminBugs() {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);

  const loadBugs = async () => {
    try {
      setLoading(true);
      const data = await adminService.getBugReports({
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        platform: platformFilter || undefined,
      });
      setBugs(data);
    } catch (err) {
      toast.error('Kunde inte ladda bugrapporter');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBugs();
  }, [severityFilter, statusFilter, platformFilter]);

  const handleStatusChange = async (bugId: string, status: string) => {
    try {
      await adminService.updateBugStatus(bugId, status);
      toast.success('Status uppdaterad');
      loadBugs();
      if (selectedBug?.id === bugId) {
        setSelectedBug({ ...selectedBug, status: status as BugReport['status'] });
      }
    } catch (err) {
      toast.error('Kunde inte uppdatera status');
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Bugrapporter</h1>
          <p className="text-muted-foreground">Hantera inrapporterade problem</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Allvarlighet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alla</SelectItem>
              <SelectItem value="critical">Kritisk</SelectItem>
              <SelectItem value="high">Hög</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Låg</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alla</SelectItem>
              <SelectItem value="open">Öppen</SelectItem>
              <SelectItem value="triaged">Triagerad</SelectItem>
              <SelectItem value="in_progress">Pågår</SelectItem>
              <SelectItem value="done">Klar</SelectItem>
              <SelectItem value="wont_fix">Fixas ej</SelectItem>
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Plattform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alla</SelectItem>
              <SelectItem value="android">Android</SelectItem>
              <SelectItem value="ios">iOS</SelectItem>
              <SelectItem value="web">Webb</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bug List */}
        <div className="grid gap-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Laddar...</div>
          ) : bugs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Inga bugrapporter hittades
            </div>
          ) : (
            bugs.map((bug) => {
              const StatusIcon = statusIcons[bug.status] || Bug;
              return (
                <Card 
                  key={bug.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedBug(bug)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={severityColors[bug.severity]}>
                          {bug.severity.toUpperCase()}
                        </Badge>
                        <CardTitle className="text-lg">{bug.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground capitalize">
                          {bug.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {bug.description || 'Ingen beskrivning'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {bug.platform && <span>Plattform: {bug.platform}</span>}
                      {bug.appVersion && <span>Version: {bug.appVersion}</span>}
                      <span>
                        {formatDistanceToNow(new Date(bug.createdAt), { addSuffix: true, locale: sv })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Bug Detail Dialog */}
        <Dialog open={!!selectedBug} onOpenChange={() => setSelectedBug(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={selectedBug ? severityColors[selectedBug.severity] : ''}>
                  {selectedBug?.severity.toUpperCase()}
                </Badge>
              </div>
              <DialogTitle>{selectedBug?.title}</DialogTitle>
              <DialogDescription>
                Rapporterad {selectedBug && formatDistanceToNow(new Date(selectedBug.createdAt), { addSuffix: true, locale: sv })}
              </DialogDescription>
            </DialogHeader>

            {selectedBug && (
              <div className="space-y-4">
                {/* Description */}
                <div>
                  <h4 className="font-medium mb-2">Beskrivning</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedBug.description || 'Ingen beskrivning'}
                  </p>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Plattform:</span>{' '}
                    {selectedBug.platform || 'Okänd'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Version:</span>{' '}
                    {selectedBug.appVersion || 'Okänd'}
                  </div>
                </div>

                {/* Status Change */}
                <div>
                  <h4 className="font-medium mb-2">Ändra status</h4>
                  <div className="flex flex-wrap gap-2">
                    {['open', 'triaged', 'in_progress', 'done', 'wont_fix'].map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={selectedBug.status === status ? 'default' : 'outline'}
                        onClick={() => handleStatusChange(selectedBug.id, status)}
                      >
                        {status.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                {selectedBug.tags.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Taggar</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedBug.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

export default AdminBugs;
