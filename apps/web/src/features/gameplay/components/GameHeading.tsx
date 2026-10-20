import type { Challenge, GameType } from "../../../types";
import { barlow, eyebrow } from "../../../uiStyles";

const itemLabels: Record<GameType, string> = {
  Quiz: "FRÅGA",
  Matching: "ETAPP",
  TrueFalse: "FRÅGA",
  PixelHunt: "BILD",
  Sorting: "SORTERING",
  WordAssembly: "ORD",
  Hangman: "SIGNALORD",
};

export function GameHeading({ data }: { data: Challenge }) {
  const isMatching = data.game.type === "Matching";
  const current = isMatching ? data.challenge.number : data.challenge.questionNumber;
  const total = isMatching ? data.challenge.total : data.challenge.questionTotal;

  return (
    <div className="flex justify-between gap-10 border-b border-[#dedede] pb-[25px] max-[720px]:gap-[10px]">
      <div>
        <p className={eyebrow}>
          {itemLabels[data.game.type]} {current.toString().padStart(2, "0")} ·{" "}
          {data.game.title.toUpperCase()}
        </p>
        <h1 className={`${barlow} m-0 max-w-[820px] text-[clamp(33px,3.4vw,50px)] leading-[1.05] text-[#202020] uppercase max-[420px]:text-[31px]`}>
          {isMatching ? data.game.summary : data.challenge.prompt}
        </h1>
      </div>
      <span className={`${barlow} text-[49px] font-bold text-[#d70000] max-[720px]:hidden`}>
        {current.toString().padStart(2, "0")}
        <span className="text-[20px] text-[#999]">/{total.toString().padStart(2, "0")}</span>
      </span>
    </div>
  );
}
