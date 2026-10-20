import { Check } from "lucide-react";
import { barlow, cx, focusRing } from "../../uiStyles";
import { selectCorrectOption } from "./gameMutations";
import type { ChallengeFieldsProps } from "./types";

export function TrueFalseFields({ controller, game, challenge }: ChallengeFieldsProps) {
  return (
    <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
      <p className="mb-3 text-[9px] font-extrabold tracking-[0.12em] text-[#555]">
        RÄTT SVAR{" "}
        <small className="ml-2 font-normal tracking-normal text-[#777]">
          Välj om påståendet är sant eller falskt.
        </small>
      </p>
      <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
        {challenge.options.map((option) => (
          <label
            className={cx(
              `grid min-h-[74px] cursor-pointer grid-cols-[28px_minmax(0,1fr)] items-center gap-3 border bg-white p-4 ${focusRing}`,
              option.isCorrect
                ? "border-[#23845e] bg-[#f3faf6] text-[#176b4c]"
                : "border-[#cfcfcf] text-[#555] hover:border-[#888]",
            )}
            key={option.id}
          >
            <input
              className="peer absolute size-px opacity-0"
              type="radio"
              name={`correct-${challenge.id}`}
              checked={option.isCorrect}
              onChange={() => controller.updateGame({
                challenges: selectCorrectOption(game, challenge.id, option.id),
              })}
            />
            <i className="grid size-7 place-items-center rounded-full border border-[#aaa] text-transparent peer-checked:border-[#23845e] peer-checked:bg-[#23845e] peer-checked:text-white">
              <Check size={15} />
            </i>
            <span className={`${barlow} text-[23px] font-bold uppercase`}>{option.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
