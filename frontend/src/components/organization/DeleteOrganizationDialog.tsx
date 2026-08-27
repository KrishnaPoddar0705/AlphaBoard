import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { deleteOrganization } from '../../lib/edgeFunctions';
import { safeError } from '../../lib/logger';
import { getUserFriendlyError } from '../../lib/errorSanitizer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface DeleteOrganizationDialogProps {
  organizationId: string;
  organizationName: string;
  memberCount: number;
  /** Called after a successful delete so the parent can navigate away. */
  onDeleted: () => void;
}

/**
 * Admin-only destructive action. Extracted from AdminDashboard, which is
 * already well past the 300 LOC guideline.
 *
 * Deleting an organization is irreversible and changes who can see members'
 * data, so the dialog requires the admin to type the organization name rather
 * than accepting a single click.
 */
export default function DeleteOrganizationDialog({
  organizationId,
  organizationName,
  memberCount,
  onDeleted,
}: DeleteOrganizationDialogProps) {
  const { user: clerkUser } = useUser();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = confirmText.trim() === organizationName.trim();

  const handleClose = (next: boolean) => {
    if (deleting) return;
    setOpen(next);
    if (!next) {
      setConfirmText('');
      setError(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmed || deleting) return;

    setDeleting(true);
    setError(null);

    try {
      const result = await deleteOrganization(organizationId, clerkUser?.id);

      if (result.clerkSyncError) {
        // The organization is gone from AlphaBoard either way; the admin still
        // needs to know Clerk was left holding a stale organization.
        alert(
          `Deleted "${result.organizationName}", but the linked Clerk organization ` +
            `could not be removed: ${result.clerkSyncError}\n\n` +
            `You may need to delete it manually in the Clerk dashboard.`
        );
      }

      onDeleted();
    } catch (err) {
      safeError('Error deleting organization:', err);
      setError(getUserFriendlyError(err));
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-700 sm:w-auto"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete Organization
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Delete {organizationName}?
            </DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
              <li>
                {memberCount} member{memberCount === 1 ? '' : 's'} will be removed from the
                organization, including you.
              </li>
              <li>
                The join code stops working and the linked Clerk organization is deleted.
              </li>
              <li>
                Recommendations, price targets and portfolios are <strong>kept</strong>, but they
                stop being organization data. Any member whose profile is not set to private
                becomes publicly visible again.
              </li>
            </ul>

            <div className="space-y-2">
              <Label htmlFor="confirm-org-name">
                Type <span className="font-mono font-semibold">{organizationName}</span> to confirm
              </Label>
              <Input
                id="confirm-org-name"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={organizationName}
                autoComplete="off"
                disabled={deleting}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={!confirmed || deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
