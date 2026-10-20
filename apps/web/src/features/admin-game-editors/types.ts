import type { ComponentType } from "react";
import type { AdminGameEditorController } from "../../hooks/useAdminGameEditor";
import type { AdminChallenge, AdminGame } from "../../types";

export type AdminGameTypeEditorProps = {
  controller: AdminGameEditorController;
  game: AdminGame;
};

export type ChallengeFieldsProps = AdminGameTypeEditorProps & {
  challenge: AdminChallenge;
};

export type ChallengeFieldsComponent = ComponentType<ChallengeFieldsProps>;
