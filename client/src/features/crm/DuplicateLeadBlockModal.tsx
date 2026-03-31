import { formatPhoneDisplay } from "@shared/phone";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface DuplicateMatchSummary {
  name: string;
  businessName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  assignedRepName: string | null;
  stageName: string | null;
}

interface Props {
  open: boolean;
  match: DuplicateMatchSummary | null;
  onClose: () => void;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export function DuplicateLeadBlockModal({ open, match, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="modal-duplicate-lead">
        <DialogHeader>
          <DialogTitle className="text-destructive">Duplicate Lead Detected</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mb-4">
          A lead with this information already exists in the system. No new record was created.
        </p>

        {match && (
          <div className="rounded-md border bg-muted/30 px-4 py-2">
            <InfoRow label="Name"         value={match.name} />
            <InfoRow label="Business"     value={match.businessName} />
            <InfoRow label="Phone"        value={match.phone ? formatPhoneDisplay(match.phone) : null} />
            <InfoRow
              label="Location"
              value={
                match.city && match.state
                  ? `${match.city}, ${match.state}`
                  : match.city ?? match.state
              }
            />
            <InfoRow label="Assigned Rep" value={match.assignedRepName} />
            <InfoRow label="Stage"        value={match.stageName} />
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="button-close-duplicate-modal"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
