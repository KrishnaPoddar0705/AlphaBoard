import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { bareTitle, brokerOf, withBroker } from '../../../lib/researchFolders';
import { getUserFriendlyError } from '../../../lib/errorSanitizer';
import { useInvalidateReports } from '../../../hooks/useResearchReports';
import { useBrokers } from '../../../hooks/commandCenter/useBrokers';
import BrokerCombobox from './BrokerCombobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import type { LibraryReport } from '../../../types/researchLibrary';

interface EditReportDialogProps {
  report: LibraryReport;
  open: boolean;
  onClose: () => void;
  /** Brokers and sectors already on reports, offered so folders don't split on spelling. */
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
  // The same broker list Command Center's coverage uses, plus any broker already on a report.
  const ccBrokers = useBrokers();
  const brokerOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const name of [...(ccBrokers.data ?? []).map((b) => b.name), ...brokers]) {
      const key = name.trim().toLowerCase();
      if (key && !byKey.has(key)) byKey.set(key, name.trim());
    }
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }, [ccBrokers.data, brokers]);

  const save = async () => {
    if (!title.trim()) { setError('The report needs a title.'); return; }
    setSaving(true);
    setError(null);
    try {
      // Any member of the report's organization may correct these fields; the function
      // checks membership and touches only title and sector (research_report_edit_details.sql).
      const { error: err } = await supabase.rpc('update_research_report_details', {
        p_report_id: report.id,
        p_title: withBroker(title, broker),
        p_sector: sector.trim() || null,
      });
      if (err) {
        // PGRST202: the function is not in this database yet (migration not applied).
        if (err.code === 'PGRST202') throw new Error('Editing is not switched on in this database yet. Apply database/migrations/research_report_edit_details.sql.');
        if (err.code === '42501') throw new Error('This report belongs to another organization.');
        throw err;
      }
      await invalidate();
      onClose();
    } catch (e) {
      setError(e instanceof Error && /^(Editing|This report)/.test(e.message) ? e.message : getUserFriendlyError(e));
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
            <BrokerCombobox value={broker} onChange={setBroker} options={brokerOptions} loading={ccBrokers.isLoading} />
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
