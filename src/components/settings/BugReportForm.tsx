/**
 * BugReportForm - In-app bug reporting form
 */

import { useState } from 'react';
import { Bug, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { bugReportService } from '@/services/BugReportService';
import { toast } from 'sonner';

export function BugReportForm() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Ange en titel för problemet');
      return;
    }

    setSubmitting(true);
    
    const result = await bugReportService.submitBugReport({
      title: title.trim(),
      description: description.trim(),
      severity,
      includeDiagnostics,
    });

    setSubmitting(false);

    if (result.success) {
      setSubmitted(true);
      // Reset form after a delay
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setTitle('');
        setDescription('');
        setSeverity('medium');
        setIncludeDiagnostics(true);
      }, 2000);
    } else {
      toast.error(result.error || 'Kunde inte skicka rapporten');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          <Bug className="w-4 h-4 mr-2" />
          Rapportera problem
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rapportera problem</DialogTitle>
          <DialogDescription>
            Beskriv problemet du upplever så hjälper vi dig
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-center font-medium">Tack för din rapport!</p>
            <p className="text-center text-sm text-muted-foreground">
              Vi tittar på det och återkommer om vi behöver mer information.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="bug-title">Titel *</Label>
              <Input
                id="bug-title"
                placeholder="Kort beskrivning av problemet"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="bug-description">Beskrivning</Label>
              <Textarea
                id="bug-description"
                placeholder="Beskriv vad som hände och vad du förväntade dig..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <Label>Allvarlighetsgrad</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Låg - Mindre irritation</SelectItem>
                  <SelectItem value="medium">Medium - Påverkar användning</SelectItem>
                  <SelectItem value="high">Hög - Allvarligt problem</SelectItem>
                  <SelectItem value="critical">Kritisk - Appen kraschar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Include diagnostics */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-diagnostics"
                checked={includeDiagnostics}
                onCheckedChange={(checked) => setIncludeDiagnostics(checked === true)}
              />
              <Label htmlFor="include-diagnostics" className="text-sm">
                Bifoga diagnostik (maskat, inga känsliga uppgifter)
              </Label>
            </div>

            {/* Submit */}
            <Button 
              className="w-full" 
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
            >
              {submitting ? (
                'Skickar...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Skicka rapport
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BugReportForm;
