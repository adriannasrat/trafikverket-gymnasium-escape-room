import { ArrowRight } from "lucide-react";
import { cx, primaryButton } from "../../../uiStyles";
import type { GameFeedbackMessage } from "../types";

type GameAction = {
  label: string;
  busyLabel: string;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
};

export function GameFeedback({ feedback }: { feedback: GameFeedbackMessage | null }) {
  if (!feedback) return null;
  return (
    <p
      className={cx(
        "m-0 border-l-[3px] px-[13px] py-[11px] text-[13px]",
        feedback.correct
          ? "border-[#23845e] bg-[#eaf8f2] text-[#116e4c]"
          : "border-[#c7352d] bg-[#fff0ef] text-[#9f302b]",
      )}
      role="status"
    >
      {feedback.text}
    </p>
  );
}

export function GameActionArea({
  feedback,
  action,
}: {
  feedback: GameFeedbackMessage | null;
  action?: GameAction;
}) {
  return (
    <div className="mt-[22px] grid min-h-[52px] grid-cols-[1fr_auto] items-center gap-5 max-[720px]:grid-cols-1">
      <div><GameFeedback feedback={feedback} /></div>
      {action && (
        <button
          className={`${primaryButton} max-[720px]:w-full`}
          type="button"
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.busy ? action.busyLabel : action.label} <ArrowRight size={18} />
        </button>
      )}
    </div>
  );
}
