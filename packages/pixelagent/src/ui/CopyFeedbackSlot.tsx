import type { ReactNode } from 'react';

export function isCopyAllFeedback(status: string | null): boolean {
  if (!status) return false;
  return status === 'Copied all!' || status.startsWith('Copy failed');
}

interface CopyFeedbackSlotProps {
  feedback: string | null;
  slotClassName: string;
  children: ReactNode;
}

export function CopyFeedbackSlot({
  feedback,
  slotClassName,
  children,
}: CopyFeedbackSlotProps) {
  if (feedback && isCopyAllFeedback(feedback)) {
    return (
      <span
        className={`pa-status pa-copy-feedback-slot ${slotClassName}`}
        role="status"
        aria-live="polite"
      >
        {feedback}
      </span>
    );
  }

  return <>{children}</>;
}
