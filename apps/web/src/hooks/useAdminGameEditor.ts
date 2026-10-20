import { createImageCommands } from "./admin-editor/imageCommands";
import { createMatchingCommands } from "./admin-editor/matchingCommands";
import { createSortingCommands } from "./admin-editor/sortingCommands";
import { useAdminGameEditorBase } from "./admin-editor/useAdminGameEditorBase";
import { createWordAssemblyCommands } from "./admin-editor/wordAssemblyCommands";

export function useAdminGameEditor(onUnauthorized: () => void) {
  const { controller, commandContext } = useAdminGameEditorBase(onUnauthorized);

  return {
    ...controller,
    ...createMatchingCommands(commandContext),
    ...createSortingCommands(commandContext),
    ...createWordAssemblyCommands(commandContext),
    ...createImageCommands(commandContext),
  };
}

export type AdminGameEditorController = ReturnType<typeof useAdminGameEditor>;
