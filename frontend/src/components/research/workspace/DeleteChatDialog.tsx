import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import type { ResearchConversation } from '../../../types/researchChat';

interface DeleteChatDialogProps {
  conversation: ResearchConversation | null;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}

/** Deleting a conversation removes its messages for good, so it is always confirmed. */
export default function DeleteChatDialog({ conversation, onCancel, onConfirm }: DeleteChatDialogProps) {
  return (
    <Dialog open={!!conversation} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this conversation?</DialogTitle>
          <DialogDescription>“{conversation?.title}” and all its messages will be permanently deleted.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={() => { if (conversation) onConfirm(conversation.id); onCancel(); }}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
