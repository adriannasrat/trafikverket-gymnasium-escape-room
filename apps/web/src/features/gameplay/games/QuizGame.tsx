import type { GameRuntimeProps } from "../types";
import { ChoiceGame } from "./ChoiceGame";

export function QuizGame(props: GameRuntimeProps) {
  return <ChoiceGame {...props} variant="multiple-choice" />;
}
