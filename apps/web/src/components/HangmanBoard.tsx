import { Check, CircleAlert, X } from "lucide-react";
import { barlow, cx, focusRing } from "../uiStyles";

const keyboardRows = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "Å"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ö", "Ä"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

type HangmanBoardProps = {
  pattern: Array<string | null>;
  guessedLetters: string[];
  mistakes: number;
  maxMistakes: number;
  disabled: boolean;
  submitting: boolean;
  onGuess: (letter: string) => void;
};

function RailwaySignal({ mistakes, maxMistakes, solved }: { mistakes: number; maxMistakes: number; solved: boolean }) {
  const active = (stage: number) => mistakes >= stage;

  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-6 max-[520px]:grid-cols-[108px_minmax(0,1fr)] max-[380px]:grid-cols-1">
      <svg
        className="mx-auto h-[240px] w-[140px] max-[520px]:h-[205px] max-[520px]:w-[108px]"
        viewBox="0 0 140 240"
        role="img"
        aria-label={`Järnvägssignalen har ${mistakes} av ${maxMistakes} varningssteg`}
      >
        <path d="M20 224H120" stroke={active(1) || solved ? "#424242" : "#dedede"} strokeWidth="8" strokeLinecap="square" />
        <path d="M55 224L64 174M85 224L76 174" stroke={active(1) || solved ? "#777" : "#e7e7e7"} strokeWidth="5" />
        <path d="M70 177V126" stroke={active(2) || solved ? "#424242" : "#dedede"} strokeWidth="10" />
        <rect x="37" y="17" width="66" height="116" rx="4" fill={active(3) || solved ? "#303030" : "#f1f1f1"} stroke={active(3) || solved ? "#202020" : "#d5d5d5"} strokeWidth="3" />
        <path d="M31 29H109L101 8H39L31 29Z" fill={active(3) || solved ? "#424242" : "#e7e7e7"} />
        <circle cx="70" cy="46" r="16" fill={!solved && active(6) ? "#d70000" : "#d6d6d6"} stroke={!solved && active(6) ? "#a50000" : "#bababa"} strokeWidth="3" />
        <circle cx="70" cy="76" r="16" fill={!solved && active(5) ? "#ef9f18" : "#d6d6d6"} stroke={!solved && active(5) ? "#b56e00" : "#bababa"} strokeWidth="3" />
        <circle cx="70" cy="106" r="16" fill={solved ? "#23845e" : active(4) ? "#ffd23f" : "#d6d6d6"} stroke={solved ? "#176b4c" : active(4) ? "#c99500" : "#bababa"} strokeWidth="3" />
        {!solved && active(6) && <circle cx="70" cy="46" r="8" fill="#ff7770" opacity="0.85" />}
        {!solved && active(5) && <circle cx="70" cy="76" r="8" fill="#ffd06c" opacity="0.85" />}
        {!solved && active(4) && <circle cx="70" cy="106" r="8" fill="#fff0a0" opacity="0.9" />}
        {solved && <circle cx="70" cy="106" r="8" fill="#78d5ac" opacity="0.9" />}
      </svg>

      <div>
        <p className="m-0 text-[9px] font-extrabold tracking-[0.17em] text-[#777] uppercase">SIGNALSTATUS</p>
        <p className={`${barlow} mt-1 mb-3 text-[clamp(30px,4vw,42px)] leading-none font-bold text-[#202020] uppercase`}>
          {solved ? "Ordet löst" : mistakes === 0 ? "Fri väg" : mistakes < maxMistakes ? "Varning" : "Stopp"}
        </p>
        <div className="grid grid-cols-6 gap-1.5" aria-hidden="true">
          {Array.from({ length: maxMistakes }, (_, index) => (
            <span
              key={index}
              className={cx(
                "h-3 border border-[#d1d1d1] bg-white",
                index < mistakes && index < 3 && "!border-[#d6a700] !bg-[#ffd23f]",
                index < mistakes && index >= 3 && index < 5 && "!border-[#c47c00] !bg-[#ef9f18]",
                index < mistakes && index >= 5 && "!border-[#a50000] !bg-[#d70000]",
              )}
            />
          ))}
        </div>
        <p className="mt-3 mb-0 text-[11px] leading-[1.55] text-[#666]">
          {solved
            ? "Grön signal – du kan gå vidare när du är redo."
            : `${mistakes} av ${maxMistakes} fel. Vid stoppsignal återställs bokstäverna och 10 sekunder läggs till på totaltiden.`}
        </p>
      </div>
    </div>
  );
}

export function HangmanBoard({
  pattern,
  guessedLetters,
  mistakes,
  maxMistakes,
  disabled,
  submitting,
  onGuess,
}: HangmanBoardProps) {
  const guessed = new Set(guessedLetters);
  const answerLetters = new Set(pattern.filter((character): character is string => Boolean(character && /[A-ZÅÄÖ]/.test(character))));
  const solved = pattern.every((character) => character !== null);

  return (
    <section aria-label="Gissa signalordet" className="grid gap-6">
      <div className="border border-[#d7d7d7] bg-white p-[clamp(18px,3vw,30px)] shadow-[0_8px_26px_rgba(30,30,30,0.05)]">
        <RailwaySignal mistakes={mistakes} maxMistakes={maxMistakes} solved={solved} />
      </div>

      <div className="border border-[#d7d7d7] bg-white px-4 py-6 text-center">
        <p className="mt-0 mb-5 text-[9px] font-extrabold tracking-[0.17em] text-[#777] uppercase">ORDET</p>
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-4" aria-label="Ordets bokstäver">
          {pattern.map((character, index) => {
            if (character === " ") return <span key={index} className="w-5" aria-label="mellanslag" />;
            if (character === "-") return <span key={index} className={`${barlow} grid w-5 place-items-end text-3xl text-[#555]`}>-</span>;
            return (
              <span
                key={index}
                className={cx(
                  `${barlow} grid h-[52px] w-[38px] place-items-center border-b-[3px] border-[#555] text-[36px] leading-none font-bold text-[#202020] uppercase max-[480px]:h-[44px] max-[480px]:w-[30px] max-[480px]:text-[29px]`,
                  character && "!border-[#23845e] !bg-[#f3faf6] !text-[#176b4c]",
                )}
              >
                {character ?? ""}
              </span>
            );
          })}
        </div>
      </div>

      <div className="border border-[#d7d7d7] bg-white p-[clamp(14px,2.5vw,24px)]">
        <div className="mb-4 flex items-center gap-2 text-[10px] font-extrabold tracking-[0.14em] text-[#666] uppercase">
          <CircleAlert size={16} className="text-[#d70000]" /> Välj en bokstav
        </div>
        <div className="grid gap-2" aria-label="Tangentbord">
          {keyboardRows.map((row, rowIndex) => (
            <div key={rowIndex} className="mx-auto grid w-full max-w-[580px] grid-cols-[repeat(11,minmax(0,1fr))] gap-1">
              {row.map((letter, letterIndex) => {
                const wasGuessed = guessed.has(letter);
                const wasCorrect = wasGuessed && answerLetters.has(letter);
                return (
                  <button
                    key={letter}
                    type="button"
                    className={cx(
                      `${barlow} grid h-12 min-w-0 place-items-center border border-[#bfbfbf] bg-[#f7f7f7] px-1 text-[20px] font-bold text-[#202020] hover:border-[#d70000] hover:bg-[#fffafa] disabled:cursor-not-allowed max-[560px]:h-11 max-[560px]:px-0 max-[560px]:text-[16px] ${focusRing}`,
                      rowIndex === 2 && letterIndex === 0 && "col-start-3",
                      wasGuessed && wasCorrect && "!border-[#23845e] !bg-[#eaf6f0] !text-[#176b4c]",
                      wasGuessed && !wasCorrect && "!border-[#c7352d] !bg-[#fde8e6] !text-[#9f302b]",
                    )}
                    disabled={disabled || submitting || wasGuessed}
                    onClick={() => onGuess(letter)}
                    aria-label={wasGuessed ? `${letter}, redan gissad` : `Gissa på ${letter}`}
                  >
                    {wasGuessed ? wasCorrect ? <Check size={18} /> : <X size={18} /> : letter}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
