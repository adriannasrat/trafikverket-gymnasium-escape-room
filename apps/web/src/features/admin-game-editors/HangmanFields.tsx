import { barlow, field, fieldLabel } from "../../uiStyles";
import { changeChallenge } from "./gameMutations";
import type { ChallengeFieldsProps } from "./types";

export function HangmanFields({ controller, game, challenge }: ChallengeFieldsProps) {
  const secretWord = challenge.options[0]?.text ?? "";

  return (
    <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
      <div className="border-l-[3px] border-[#d70000] bg-[#fffafa] px-4 py-3">
        <p className="m-0 text-[9px] font-extrabold tracking-[0.13em] text-[#a32620] uppercase">HEMLIGT ORD</p>
        <p className="mt-1 mb-0 text-[10px] leading-[1.5] text-[#666]">
          Ordet visas här för administratören, men skickas aldrig till spelarens webbläsare. Mellanslag och bindestreck är tillåtna.
        </p>
      </div>
      <label className={`${fieldLabel} mt-4`}>
        ORDET SOM SKA GISSAS
        <input
          className={`${field} ${barlow} text-[25px] font-bold tracking-[0.08em] uppercase`}
          value={secretWord}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            const text = event.target.value.toLocaleUpperCase("sv-SE");
            controller.updateGame({
              challenges: changeChallenge(game, challenge.id, (item) => ({
                ...item,
                options: item.options.map((option, index) =>
                  index === 0 ? { ...option, text, isCorrect: false } : option,
                ),
              })),
            });
          }}
        />
      </label>
      <div className="mt-4 border border-[#dedede] bg-[#fafafa] px-4 py-5">
        <p className="mt-0 mb-4 text-[8px] font-extrabold tracking-[0.15em] text-[#777] uppercase">FÖRHANDSVISNING AV BOKSTAVSPLATSER</p>
        <div className="flex flex-wrap gap-x-2 gap-y-3">
          {secretWord.split("").map((character, index) =>
            character === " " ? (
              <span key={index} className="w-4" />
            ) : (
              <span key={index} className={`${barlow} grid h-10 w-8 place-items-center border-b-2 border-[#555] text-[24px] font-bold text-[#202020] uppercase`}>
                {character === "-" ? "-" : character}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
