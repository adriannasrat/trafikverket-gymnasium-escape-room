import type { ComponentType } from "react";
import type { GameType } from "../../types";
import {
  HangmanEditor,
  MatchingEditor,
  PixelHuntEditor,
  QuizEditor,
  SortingEditor,
  TrueFalseEditor,
  WordAssemblyEditor,
} from "./editors";
import type { AdminGameTypeEditorProps } from "./types";

export const adminGameEditorRegistry = {
  Quiz: QuizEditor,
  Matching: MatchingEditor,
  TrueFalse: TrueFalseEditor,
  PixelHunt: PixelHuntEditor,
  Sorting: SortingEditor,
  WordAssembly: WordAssemblyEditor,
  Hangman: HangmanEditor,
} satisfies Record<GameType, ComponentType<AdminGameTypeEditorProps>>;
