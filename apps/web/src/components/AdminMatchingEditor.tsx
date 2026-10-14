import type { AdminGame } from "../types";
import { AdminMatchingBoard } from "./AdminMatchingBoard";

type AdminMatchingEditorProps = {
  game: AdminGame;
  disabled: boolean;
  mutating: string | null;
  imageUploadsEnabled: boolean;
  onUpdate: (change: Partial<AdminGame>) => void;
  onAddDestination: () => void;
  onAddScenario: () => void;
  onUploadImage: (challengeId: string, image?: File) => void;
  onDeleteScenario: (challengeId: string) => void;
  onDeleteDestination: (sortOrder: number) => void;
};

export function AdminMatchingEditor({
  game,
  disabled,
  mutating,
  imageUploadsEnabled,
  onUpdate,
  onAddDestination,
  onAddScenario,
  onUploadImage,
  onDeleteScenario,
  onDeleteDestination,
}: AdminMatchingEditorProps) {
  return (
    <AdminMatchingBoard
      challenges={game.challenges}
      disabled={disabled}
      mutating={mutating}
      imageUploadsEnabled={imageUploadsEnabled}
      onAddDestination={onAddDestination}
      onAddScenario={onAddScenario}
      onRenameDestination={(sortOrder, text) =>
        onUpdate({
          challenges: game.challenges.map((challenge) => ({
            ...challenge,
            options: challenge.options.map((option) =>
              option.sortOrder === sortOrder ? { ...option, text } : option,
            ),
          })),
        })
      }
      onChangeDestinationIcon={(sortOrder, matchingIconKey) =>
        onUpdate({
          challenges: game.challenges.map((challenge) => ({
            ...challenge,
            options: challenge.options.map((option) =>
              option.sortOrder === sortOrder
                ? { ...option, matchingIconKey }
                : option,
            ),
          })),
        })
      }
      onMoveDestination={(sortOrder, direction) => {
        const adjacentSortOrder = sortOrder + direction;
        onUpdate({
          challenges: game.challenges.map((challenge) => {
            const current = challenge.options.find(
              (option) => option.sortOrder === sortOrder,
            );
            const adjacent = challenge.options.find(
              (option) => option.sortOrder === adjacentSortOrder,
            );
            if (!current || !adjacent) return challenge;

            return {
              ...challenge,
              options: challenge.options.map((option) => {
                if (option.sortOrder === sortOrder) {
                  return {
                    ...option,
                    text: adjacent.text,
                    matchingIconKey: adjacent.matchingIconKey,
                    isCorrect: adjacent.isCorrect,
                  };
                }
                if (option.sortOrder === adjacentSortOrder) {
                  return {
                    ...option,
                    text: current.text,
                    matchingIconKey: current.matchingIconKey,
                    isCorrect: current.isCorrect,
                  };
                }
                return option;
              }),
            };
          }),
        });
      }}
      onMoveScenario={(challengeId, direction) => {
        const current = game.challenges.find(
          (challenge) => challenge.id === challengeId,
        );
        if (!current) return;
        const adjacent = game.challenges.find(
          (challenge) => challenge.sortOrder === current.sortOrder + direction,
        );
        if (!adjacent) return;

        onUpdate({
          challenges: game.challenges.map((challenge) => {
            if (challenge.id === current.id) {
              return { ...challenge, sortOrder: adjacent.sortOrder };
            }
            if (challenge.id === adjacent.id) {
              return { ...challenge, sortOrder: current.sortOrder };
            }
            return challenge;
          }),
        });
      }}
      onAssignScenario={(challengeId, destinationSortOrder) => {
        const movedChallenge = game.challenges.find((item) => item.id === challengeId);
        const previousSortOrder = movedChallenge?.options.find(
          (option) => option.isCorrect,
        )?.sortOrder;
        if (
          !movedChallenge ||
          previousSortOrder === undefined ||
          previousSortOrder === destinationSortOrder
        ) return;

        const displacedChallenge = game.challenges.find((item) =>
          item.id !== challengeId && item.options.some(
            (option) => option.sortOrder === destinationSortOrder && option.isCorrect,
          ),
        );
        onUpdate({
          challenges: game.challenges.map((item) => {
            const assignedSortOrder = item.id === challengeId
              ? destinationSortOrder
              : item.id === displacedChallenge?.id
                ? previousSortOrder
                : undefined;
            return assignedSortOrder === undefined
              ? item
              : {
                  ...item,
                  options: item.options.map((option) => ({
                    ...option,
                    isCorrect: option.sortOrder === assignedSortOrder,
                  })),
                };
          }),
        });
      }}
      onChangePrompt={(challengeId, prompt) =>
        onUpdate({
          challenges: game.challenges.map((challenge) =>
            challenge.id === challengeId ? { ...challenge, prompt } : challenge,
          ),
        })
      }
      onUploadImage={onUploadImage}
      onDeleteScenario={onDeleteScenario}
      onDeleteDestination={onDeleteDestination}
    />
  );
}
