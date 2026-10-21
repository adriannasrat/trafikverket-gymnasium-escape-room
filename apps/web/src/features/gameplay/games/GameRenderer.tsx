import type { GameRuntimeProps } from "../types";
import { HangmanGame } from "./HangmanGame";
import { MatchingGame } from "./MatchingGame";
import { PixelHuntGame } from "./PixelHuntGame";
import { QuizGame } from "./QuizGame";
import { SortingGame } from "./SortingGame";
import { TrueFalseGame } from "./TrueFalseGame";
import { WordAssemblyGame } from "./WordAssemblyGame";

export function GameRenderer(props: GameRuntimeProps) {
  const { data, ...runtime } = props;

  switch (data.type) {
    case "Quiz":
      return <QuizGame {...runtime} data={data} />;
    case "TrueFalse":
      return <TrueFalseGame {...runtime} data={data} />;
    case "PixelHunt":
      return <PixelHuntGame {...runtime} data={data} />;
    case "Matching":
      return <MatchingGame {...runtime} data={data} />;
    case "Sorting":
      return <SortingGame {...runtime} data={data} />;
    case "WordAssembly":
      return <WordAssemblyGame {...runtime} data={data} />;
    case "Hangman":
      return <HangmanGame {...runtime} data={data} />;
  }
}
