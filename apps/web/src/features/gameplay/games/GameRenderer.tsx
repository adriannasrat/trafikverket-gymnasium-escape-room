import type { GameRuntimeProps } from "../types";
import { GameFeedback } from "../components/GameFeedback";
import { HangmanGame } from "./HangmanGame";
import { MatchingGame } from "./MatchingGame";
import { PixelHuntGame } from "./PixelHuntGame";
import { QuizGame } from "./QuizGame";
import { SortingGame } from "./SortingGame";
import { TrueFalseGame } from "./TrueFalseGame";
import { WordAssemblyGame } from "./WordAssemblyGame";

export function GameRenderer(props: GameRuntimeProps) {
  switch (props.data.game.type) {
    case "Quiz":
      return <QuizGame {...props} />;
    case "TrueFalse":
      return <TrueFalseGame {...props} />;
    case "PixelHunt":
      return <PixelHuntGame {...props} />;
    case "Matching":
      return props.data.matching
        ? <MatchingGame {...props} data={{ ...props.data, matching: props.data.matching }} />
        : <GameFeedback feedback={{ correct: false, text: "Matchningsspelet kunde inte laddas." }} />;
    case "Sorting":
      return props.data.sorting
        ? <SortingGame {...props} data={{ ...props.data, sorting: props.data.sorting }} />
        : <GameFeedback feedback={{ correct: false, text: "Sorteringsspelet kunde inte laddas." }} />;
    case "WordAssembly":
      return props.data.wordAssembly
        ? <WordAssemblyGame {...props} data={{ ...props.data, wordAssembly: props.data.wordAssembly }} />
        : <GameFeedback feedback={{ correct: false, text: "Ordspelet kunde inte laddas." }} />;
    case "Hangman":
      return props.data.hangman
        ? <HangmanGame {...props} data={{ ...props.data, hangman: props.data.hangman }} />
        : <GameFeedback feedback={{ correct: false, text: "Signalordet kunde inte laddas." }} />;
  }
}
