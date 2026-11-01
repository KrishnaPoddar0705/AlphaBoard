import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { bareTitle, brokerOf, withBroker } from '../../../lib/researchFolders';
import { getUserFriendlyError } from '../../../lib/errorSanitizer';
import { useInvalidateReports } from '../../../hooks/useResearchReports';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import type { LibraryReport } from '../../../types/researchLibrary';

interface EditReportDialogProps {
  report: LibraryReport;
  open: boolean;
  onClose: () => void;
  /** Existing brokers and sectors, offered as suggestions so folders don't split on spelling. */
  brokers: string[];
  sectors: string[];
}

const field = 'h-9 w-full rounded-md border border-[#D7D0C2] bg-[#FBF7ED] px-3 text-base text-[#1C1B17] placeholder:text-[#8B857A] focus:border-[#1C1B17]/50 focus:outline-none md:text-sm';

/**
 * Edit a report's broker, title and sector after upload. The broker is kept as the title's
 * "[Broker]" prefix, which is how the folders and the Brain already read it.
 */
export default function EditReportDialog({ report, open, onClose, brokers, sectors }: EditReportDialogProps) {
  const current = brokerOf(report);
  const [broker, setBroker] = useState(current === 'Unfiled' ? '' : current);
  const [title, setTitle] = useState(bareTitle(report.title));
  const [sector, setSector] = useState(report.sector ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateReports();

  const save = async () => {
    if (!title.trim()) { setError('The report needs a title.'); return; }
    setSaving(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('research_reports')
        .update({ title: withBroker(title, broker), sector: sector.trim() || null })
        .eq('id', report.id)
        .select('id');
      if (err) throw err;
      // RLS turns a forbidden update into zero rows rather than an error.
      if (!data?.length) throw new Error('Only the analyst who uploaded this report can edit it.');
      await invalidate();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith('Only') ? e.message : getUserFriendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit report details</DialogTitle>
          <DialogDescription>The broker and sector decide which folders this report is filed in.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#1C1B17]">Broker</span>
            <input list="research-brokers" value={broker} onChange={(e) => setBroker(e.target.value)} placeholder="e.g. Kotak, ICICI Securities" className={field} autoFocus />
            <datalist id="research-brokers">{brokers.map((b) => <option key={b} value={b} />)}</datalist>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#1C1B17]">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#1C1B17]">Sector</span>
            <input list="research-sectors" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="e.g. Defense" className={field} />
            <datalist id="research-sectors">{sectors.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <p className="text-xs text-[#6F6A60]">Saved as “{withBroker(title || '…', broker)}”</p>
          {error && <p className="text-sm text-[#B23B2A]">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
