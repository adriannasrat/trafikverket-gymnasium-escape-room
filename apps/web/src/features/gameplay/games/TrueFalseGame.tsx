import type { GameRuntimeProps } from "../types";
import { ChoiceGame } from "./ChoiceGame";

export function TrueFalseGame(props: GameRuntimeProps<"TrueFalse">) {
  return <ChoiceGame {...props} variant="true-false" />;
}
