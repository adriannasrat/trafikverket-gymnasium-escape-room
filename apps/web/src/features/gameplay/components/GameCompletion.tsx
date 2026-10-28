import { CheckCircle2, RotateCcw, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandHeader } from "../../../components/BrandHeader";
import { formatElapsed } from "../../../lib/time";
import { barlow, eyebrow, primaryButton, secondaryButton } from "../../../uiStyles";

export function GameCompletion({
  playerName,
  elapsed,
  score,
}: {
  playerName?: string;
  elapsed: number;
  score: number;
}) {
  return (
    <div className="min-h-screen overflow-hidden bg-white">
      <BrandHeader playerName={playerName} elapsed={formatElapsed(elapsed)} score={score} />
      <main className="relative flex min-h-[calc(100vh-72px)] flex-col items-center justify-center px-[30px] py-12 text-center before:absolute before:top-[18%] before:left-[8%] before:size-[150px] before:rotate-8 before:border before:border-[#eee] before:content-[''] after:absolute after:right-[8%] after:bottom-[15%] after:size-[150px] after:-rotate-8 after:border after:border-[#eee] after:content-[''] max-[720px]:min-h-[calc(100vh-66px)] max-[720px]:px-5 max-[720px]:py-10 max-[720px]:before:hidden max-[720px]:after:hidden">
        <span className="mb-[30px] grid size-[76px] place-items-center rounded-full bg-[#23845e] text-white shadow-[0_0_0_12px_rgba(35,132,94,0.1)] [&>svg]:size-[38px]">
          <CheckCircle2 />
        </span>
        <p className={`${eyebrow} justify-center`}>UPPDRAG SLUTFÖRT</p>
        <h1 className={`${barlow} mb-3 text-[clamp(50px,6vw,70px)] text-[#202020] uppercase`}>Systemet är säkrat.</h1>
        <p className="text-[#606060]">
          Bra jobbat, <strong>{playerName}</strong>! Din totaltid är registrerad.
        </p>
        <div className="my-[35px] grid">
          <small className="tracking-[0.2em] text-[#777]">SLUTTID</small>
          <strong className={`${barlow} text-[70px] tracking-[0.05em] text-[#d70000]`}>{formatElapsed(elapsed)}</strong>
          <small className="mt-5 tracking-[0.2em] text-[#777]">SLUTPOÄNG</small>
          <strong className={`${barlow} mt-1 text-[45px] leading-none text-[#23845e]`}>{score.toLocaleString("sv-SE")}</strong>
        </div>
        <div className="relative z-1 flex gap-3 max-[720px]:w-[min(100%,320px)] max-[720px]:flex-col">
          <Link className={primaryButton} to="/leaderboard">
            <Trophy size={18} /> Visa topplistan
          </Link>
          <Link className={secondaryButton} to="/">
            <RotateCcw size={17} /> Nästa spelare
          </Link>
        </div>
      </main>
    </div>
  );
}
