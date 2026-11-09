
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitBriefSignOff } from "@/src/server/actions/briefs";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

interface BriefSignOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brief: {
    id: string;
    title: string;
    version: number;
    project?: { name: string } | null;
  } | null;
  onSuccess?: () => void;
}

export function BriefSignOffDialog({
  open,
  onOpenChange,
  brief,
  onSuccess,
}: BriefSignOffDialogProps) {
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!brief) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!agreed) {
      setErrorMessage("Please confirm that you have reviewed and understand the creative brief.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await submitBriefSignOff({
        briefId: brief.id,
        version: brief.version,
        note: note.trim() || null,
      });

      if (res.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
        return;
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Worker Creative Sign-off</DialogTitle>
              <DialogDescription className="text-xs">
                {brief.project ? `${brief.project.name} • ` : ""}v{brief.version}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/15 p-3 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="rounded-lg border p-3.5 bg-muted/20 space-y-2">
            <div className="text-sm font-semibold">{brief.title}</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              By submitting this sign-off, you confirm that you have reviewed the deliverables, shot list, and visual guidelines for version {brief.version}, and are ready to execute your assigned tasks.
            </p>
          </div>

          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="confirm-signoff"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-4 w-4 rounded border mt-0.5 cursor-pointer"
            />
            <Label
              htmlFor="confirm-signoff"
              className="text-xs cursor-pointer font-medium leading-snug"
            >
              I have reviewed the creative brief requirements and understand the shoot specifications.
            </Label>
          </div>

          <div className="space-y-1.5 pt-2">
            <Label htmlFor="signoff-note" className="text-xs">
              Reviewer Note or Equipment Readiness (Optional)
            </Label>
            <Textarea
              id="signoff-note"
              placeholder="e.g. Reviewed 85mm portrait requirements. Lens and lighting pack confirmed."
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!agreed || isSubmitting}
              className="flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm Sign-off
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
