import { ChevronRight } from "lucide-react";
import type { AdminGame } from "../types";
import { cx, focusRing } from "../uiStyles";

type AdminGameListProps = {
  games: AdminGame[];
  selectedId?: string;
  onSelect: (gameId: string) => void;
};

export function AdminGameList({ games, selectedId, onSelect }: AdminGameListProps) {
  return (
    <section className="border-r border-[#dedede] bg-[#fafafa] px-3 py-[18px] max-[980px]:border-r-0 max-[980px]:border-b">
      <h2 className="px-[10px] text-[10px] tracking-[0.15em] text-[#666] uppercase max-[980px]:hidden">
        Spel
      </h2>
      {games.map((game) => (
        <button
          key={game.id}
          className={cx(
            `flex w-full cursor-pointer items-center gap-[5px] border-0 bg-transparent px-[11px] py-[14px] text-left text-[#777] max-[980px]:max-w-80 ${focusRing}`,
            game.id === selectedId &&
              "border-l-[3px] border-[#d70000] bg-[#f9eeee] pl-2",
          )}
          type="button"
          onClick={() => onSelect(game.id)}
        >
          <span className="grid min-w-0 flex-1 gap-[5px]">
            <strong className="text-[12px] text-[#202020]">{game.title}</strong>
            <small className="text-[9px]">
              {game.challenges.length} uppdrag · {game.isActive ? "Aktivt" : "Pausat"}
            </small>
          </span>
          <ChevronRight size={16} />
        </button>
      ))}
    </section>
  );
}
