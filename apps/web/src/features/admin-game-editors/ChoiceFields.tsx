import { Check } from "lucide-react";
import { barlow, field } from "../../uiStyles";
import { changeOption, selectCorrectOption } from "./gameMutations";
import type { ChallengeFieldsProps } from "./types";

export function ChoiceFields({ controller, game, challenge }: ChallengeFieldsProps) {
  return (
    <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
      <p className="text-[9px] font-extrabold tracking-[0.12em] text-[#555]">
        SVARSALTERNATIV{" "}
        <small className="ml-2 font-normal tracking-normal text-[#777] max-[420px]:mt-[5px] max-[420px]:ml-0 max-[420px]:block">
          Markera det korrekta svaret.
        </small>
      </p>
      {challenge.options.map((option, optionIndex) => (
        <div
          className="mt-[9px] grid grid-cols-[34px_minmax(0,1fr)_98px] items-start gap-[9px] max-[720px]:grid-cols-[34px_minmax(0,1fr)]"
          key={option.id}
        >
          <span className={`${barlow} grid min-h-[58px] w-[34px] place-items-center bg-[#ededed] font-bold text-[#555]`}>
            {String.fromCharCode(65 + optionIndex)}
          </span>
          <textarea
            className={`${field} min-h-[58px] min-w-0 resize-y px-3 py-[10px] leading-[1.4]`}
            rows={2}
            aria-label={`Svar ${optionIndex + 1}`}
            value={option.text}
            onChange={(event) => controller.updateGame({
              challenges: changeOption(game, challenge.id, option.id, (candidate) => ({
                ...candidate,
                text: event.target.value,
              })),
            })}
          />
          <label className="flex min-h-[58px] cursor-pointer items-center gap-[6px] text-[10px] text-[#666] max-[720px]:col-start-2 max-[720px]:min-h-[31px] max-[720px]:px-0 max-[720px]:pt-0.5 max-[720px]:pb-2">
            <input
              className="peer absolute size-px opacity-0"
              type="radio"
              name={`correct-${challenge.id}`}
              checked={option.isCorrect}
              onChange={() => controller.updateGame({
                challenges: selectCorrectOption(game, challenge.id, option.id),
              })}
            />
            <i className="grid size-[23px] place-items-center rounded-full border border-[#aaa] text-transparent peer-checked:border-[#23845e] peer-checked:bg-[#23845e] peer-checked:text-white">
              <Check size={13} />
            </i>
            <span className="peer-checked:font-bold peer-checked:text-[#176b4c]">Korrekt</span>
          </label>
        </div>
      ))}
    </div>
  );
}
