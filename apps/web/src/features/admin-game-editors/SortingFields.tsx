import { Plus } from "lucide-react";
import { AdminSortingBoard } from "../../components/AdminSortingBoard";
import { changeChallenge, changeOption } from "./gameMutations";
import type { ChallengeFieldsProps } from "./types";

export function SortingFields({ controller, game, challenge }: ChallengeFieldsProps) {
  const disabled = controller.mutating !== null;

  return (
    <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
      <div className="mb-4 flex items-center justify-between gap-4 border-l-[3px] border-[#d70000] bg-[#fffafa] px-4 py-3 max-[560px]:items-start">
        <div>
          <p className="m-0 text-[9px] font-extrabold tracking-[0.12em] text-[#a32620] uppercase">KORT OCH MÅLOMRÅDEN</p>
          <p className="mt-1 mb-0 text-[10px] leading-[1.5] text-[#666]">
            Dra korten mellan målområdena. Kort på startytan blir bluffkort som deltagaren ska lämna kvar. Klicka på ett områdesnamn för att ändra det.
          </p>
        </div>
        <button
          className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 border border-[#d70000] bg-white px-3 text-[9px] font-extrabold tracking-[0.07em] text-[#b00000] uppercase disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={disabled}
          onClick={() => void controller.addSortingCard(challenge.id)}
        >
          <Plus size={14} />
          {controller.mutating === `sorting-card-add-${challenge.id}` ? "Lägger till…" : "Lägg till kort"}
        </button>
      </div>
      <AdminSortingBoard
        options={challenge.options}
        disabled={disabled}
        onChangeText={(optionId, text) => controller.updateGame({
          challenges: changeOption(game, challenge.id, optionId, (option) => ({ ...option, text })),
        })}
        onMove={(optionId, sortingCategory) => controller.updateGame({
          challenges: changeOption(game, challenge.id, optionId, (option) => ({ ...option, sortingCategory })),
        })}
        onRenameCategory={(category, nextCategory) => controller.updateGame({
          challenges: changeChallenge(game, challenge.id, (item) => ({
            ...item,
            options: item.options.map((option) =>
              option.sortingCategory === category
                ? { ...option, sortingCategory: nextCategory }
                : option,
            ),
          })),
        })}
        onDelete={(optionId) => void controller.deleteSortingCard(challenge.id, optionId)}
      />
    </div>
  );
}
