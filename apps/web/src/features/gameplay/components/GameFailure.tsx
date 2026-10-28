import { HeartOff, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandHeader } from "../../../components/BrandHeader";
import { barlow, eyebrow, primaryButton } from "../../../uiStyles";

export function GameFailure({
  playerName,
  score,
}: {
  playerName?: string;
  score: number;
}) {
  return (
    <div className="min-h-screen bg-white">
      <BrandHeader playerName={playerName} score={score} livesRemaining={0} />
      <main className="flex min-h-[calc(100vh-72px)] flex-col items-center justify-center px-6 py-12 text-center max-[720px]:min-h-[calc(100vh-66px)]">
        <span className="mb-7 grid size-[76px] place-items-center rounded-full bg-[#fff0ef] text-[#d70000] shadow-[0_0_0_12px_rgba(215,0,0,0.08)]">
          <HeartOff size={38} />
        </span>
        <p className={`${eyebrow} justify-center`}>INGA LIV KVAR</p>
        <h1 className={`${barlow} mb-3 text-[clamp(48px,6vw,70px)] text-[#202020] uppercase`}>
          Uppdraget misslyckades.
        </h1>
        <p className="max-w-[560px] text-[14px] leading-[1.7] text-[#606060]">
          Bra kämpat{playerName ? `, ${playerName}` : ""}. Du samlade ihop <strong>{score.toLocaleString("sv-SE")} poäng</strong>. Starta om och försök slå ditt resultat.
        </p>
        <Link className={`${primaryButton} mt-8`} to="/">
          <RotateCcw size={17} /> Försök igen
        </Link>
      </main>
    </div>
  );
}
