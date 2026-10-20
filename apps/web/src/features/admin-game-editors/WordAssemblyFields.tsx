import { AdminWordAssemblyBoard } from "../../components/AdminWordAssemblyBoard";
import { changeChallenge, changeOption } from "./gameMutations";
import type { ChallengeFieldsProps } from "./types";

export function WordAssemblyFields({ controller, game, challenge }: ChallengeFieldsProps) {
  return (
    <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
      <AdminWordAssemblyBoard
        options={challenge.options}
        disabled={controller.mutating !== null}
        mutating={controller.mutating}
        onChangeText={(optionId, text) => controller.updateGame({
          challenges: changeOption(game, challenge.id, optionId, (option) => ({ ...option, text })),
        })}
        onReorder={(optionIds) => controller.updateGame({
          challenges: changeChallenge(game, challenge.id, (item) => ({
            ...item,
            options: item.options.map((option) => ({
              ...option,
              sortOrder: optionIds.indexOf(option.id) + 1,
            })),
          })),
        })}
        onAdd={() => void controller.addWordPart(challenge.id)}
        onDelete={(optionId) => void controller.deleteWordPart(challenge.id, optionId)}
      />
    </div>
  );
}
