import type { GameRuntimeProps } from "../types";
import { ChoiceGame } from "./ChoiceGame";

export function QuizGame(props: GameRuntimeProps<"Quiz">) {
  return (
    <>
      {props.data.challenge.imagePath && (
        <img
          className="mt-[22px] block max-h-[360px] w-full bg-white object-contain p-3"
          src={props.data.challenge.imagePath}
          alt="Ledtråd till uppdraget"
        />
      )}
      <ChoiceGame {...props} variant="multiple-choice" />
    </>
  );
}
