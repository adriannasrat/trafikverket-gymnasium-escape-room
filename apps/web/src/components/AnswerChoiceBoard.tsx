import { CheckCircle2, XCircle } from "lucide-react";
import type { AnswerOption } from "../types";
import { barlow, cx, focusWithinRing } from "../uiStyles";

type AnswerChoiceBoardProps = {
  options: AnswerOption[];
  selectedId: string;
  variant: "multiple-choice" | "true-false";
  disabled: boolean;
  completed: boolean;
  onSelect: (optionId: string) => void;
};

export function AnswerChoiceBoard({
  options,
  selectedId,
  variant,
  disabled,
  completed,
  onSelect,
}: AnswerChoiceBoardProps) {
  if (variant === "true-false") {
    return (
      <fieldset className="m-0 grid grid-cols-2 gap-4 border-0 p-0 max-[520px]:grid-cols-1">
        <legend className="absolute size-px overflow-hidden">
          Välj sant eller falskt
        </legend>
        {options.map((option) => {
          const OptionIcon = option.text.toLocaleLowerCase("sv") === "sant"
            ? CheckCircle2
            : XCircle;
          const isSelected = selectedId === option.id;

          return (
            <label
              className={cx(
                `grid min-h-[148px] cursor-pointer place-items-center gap-2 border bg-white p-5 text-center text-[#202020] ${focusWithinRing}`,
                isSelected && !completed &&
                  "!border-2 !border-[#d70000] !bg-[#fffafa] !p-[19px] shadow-[0_5px_18px_rgba(215,0,0,0.08)]",
                isSelected && completed &&
                  "!border-2 !border-[#23845e] !bg-[#f3faf6] !p-[19px] !text-[#176b4c] shadow-[0_5px_18px_rgba(35,132,94,0.1)]",
                !isSelected && !completed && "border-[#cfcfcf] hover:border-[#888]",
                completed && "cursor-default",
              )}
              key={option.id}
            >
              <input
                className="pointer-events-none absolute size-px opacity-0"
                type="radio"
                name="answer"
                value={option.id}
                checked={isSelected}
                disabled={disabled}
                onChange={() => onSelect(option.id)}
              />
              <OptionIcon
                className={cx(
                  "size-10 text-[#777]",
                  isSelected && !completed && "!text-[#d70000]",
                  isSelected && completed && "!text-[#23845e]",
                )}
                strokeWidth={1.8}
              />
              <strong className={`${barlow} text-[clamp(28px,4vw,40px)] leading-none uppercase`}>
                {option.text}
              </strong>
            </label>
          );
        })}
      </fieldset>
    );
  }

  return (
    <fieldset className="m-0 grid grid-cols-2 gap-[13px] border-0 p-0 max-[720px]:grid-cols-1">
      <legend className="absolute size-px overflow-hidden">Välj ett svar</legend>
      {options.map((option, index) => {
        const isSelected = selectedId === option.id;

        return (
          <label
            className={cx(
              `grid min-h-[78px] cursor-pointer grid-cols-[38px_minmax(0,1fr)] items-center gap-[15px] border border-[#cfcfcf] bg-white p-[15px] text-[#202020] ${focusWithinRing}`,
              isSelected && !completed &&
                "!border-2 !border-[#d70000] !bg-[#fffafa] !p-[14px] shadow-[0_5px_18px_rgba(215,0,0,0.08)] hover:!border-[#d70000]",
              isSelected && completed &&
                "!border-2 !border-[#23845e] !bg-[#f3faf6] !p-[14px] !text-[#176b4c] shadow-[0_5px_18px_rgba(35,132,94,0.1)]",
              !isSelected && !completed && "hover:border-[#888]",
              completed && "cursor-default",
            )}
            key={option.id}
          >
            <input
              className="pointer-events-none absolute size-px opacity-0"
              type="radio"
              name="answer"
              value={option.id}
              checked={isSelected}
              disabled={disabled}
              onChange={() => onSelect(option.id)}
            />
            <span
              aria-hidden="true"
              className={cx(
                `${barlow} grid size-9 place-items-center bg-[#ededed] text-[18px] font-bold text-[#555]`,
                isSelected && !completed && "!bg-[#f9eeee] !text-[#d70000]",
                isSelected && completed && "!bg-[#23845e] !text-white",
              )}
            >
              {String.fromCharCode(65 + index)}
            </span>
            <strong className="text-[14px] leading-[1.45]">{option.text}</strong>
          </label>
        );
      })}
    </fieldset>
  );
}
