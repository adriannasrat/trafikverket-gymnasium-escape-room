import type { AdminGame } from "../../types";

export type AdminEditorMutation = {
  gameId: string;
  key: string;
  pendingMessage?: string;
  fallbackErrorMessage: string;
  execute: () => Promise<string>;
};

export type AdminEditorCommandContext = {
  game: AdminGame | undefined;
  confirm: (message: string) => boolean;
  getCurrentGame: (gameId: string, fallback: AdminGame) => AdminGame;
  updateGameById: (gameId: string, change: Partial<AdminGame>) => void;
  runMutation: (mutation: AdminEditorMutation) => Promise<void>;
};
