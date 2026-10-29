import { AlertTriangle, Check, Clock3, LoaderCircle } from "lucide-react";
import { AdminGameList } from "../../components/AdminGameList";
import { AdminGameSettings } from "../../components/AdminGameSettings";
import type { AdminGameEditorController } from "../../hooks/useAdminGameEditor";
import { getAdminGameCopy } from "../../lib/gameCatalog";
import { barlow, cx, eyebrow, primaryButton } from "../../uiStyles";
import { AdminGameTypeEditor } from "./AdminGameTypeEditor";

export function AdminGamesView({ controller }: { controller: AdminGameEditorController }) {
  const { games, game, status, loadError, autosaveState } = controller;
  if (!games) return null;

  if (loadError) {
    return (
      <section className="grid min-h-[430px] place-items-center border border-[#dedede] bg-white px-5 text-center">
        <div className="grid max-w-[470px] justify-items-center gap-4">
          <AlertTriangle className="text-[#d70000]" size={34} />
          <h1 className={`${barlow} m-0 text-[38px] text-[#202020] uppercase`}>
            Uppdragen kunde inte laddas
          </h1>
          <p className="m-0 text-[13px] leading-[1.6] text-[#686868]" role="alert">
            {loadError} Kontrollera anslutningen och försök igen.
          </p>
          <button className={primaryButton} type="button" onClick={() => void controller.reloadGames()}>
            Försök igen
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="mb-7 flex items-end justify-between gap-[30px] max-[720px]:flex-col max-[720px]:items-stretch">
        <div>
          <p className={eyebrow}>INNEHÅLL & SPELFLÖDE</p>
          <h1 className={`${barlow} mb-[5px] text-[45px] text-[#202020] uppercase max-[420px]:text-[39px]`}>Hantera uppdrag</h1>
          <p className="m-0 text-[13px] text-[#686868]">Ändra vad deltagarna ser utan att röra koden.</p>
        </div>
        <div
          className={cx(
            "inline-flex min-h-[44px] shrink-0 items-center gap-2 border px-4 text-[10px] font-bold tracking-[0.08em] uppercase max-[720px]:w-full max-[720px]:justify-center",
            autosaveState.phase === "error"
              ? "border-[#d70000] bg-[#f9eeee] text-[#9b1c1c]"
              : autosaveState.phase === "saved"
                ? "border-[#9bcbb7] bg-[#eaf6f0] text-[#166b4c]"
                : "border-[#cfcfcf] bg-white text-[#555]",
          )}
          role="status"
          aria-live="polite"
        >
          {autosaveState.phase === "saving" ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : autosaveState.phase === "error" ? (
            <AlertTriangle size={16} />
          ) : autosaveState.phase === "saved" ? (
            <Check size={16} />
          ) : (
            <Clock3 size={16} />
          )}
          {autosaveState.message}
        </div>
      </div>
      {status && (
        <p className="mb-[18px] flex items-center gap-[7px] border-l-[3px] border-[#23845e] bg-[#eaf6f0] px-[15px] py-[11px] text-[12px] text-[#166b4c]" role="status">
          <Check size={16} /> {status}
        </p>
      )}
      <div className="grid min-h-[600px] grid-cols-[235px_minmax(0,1fr)] border border-[#dedede] bg-white max-[980px]:grid-cols-1">
        <AdminGameList games={games} selectedId={game?.id} onSelect={controller.selectGame} />
        {game && (
          <section className="min-w-0 p-[30px] max-[720px]:px-[14px] max-[720px]:py-[22px]">
            <AdminGameSettings
              game={game}
              timeLabel={getAdminGameCopy(game.type).timeLabel}
              onChange={controller.updateGame}
            />
            <AdminGameTypeEditor controller={controller} game={game} />
          </section>
        )}
      </div>
    </>
  );
}
