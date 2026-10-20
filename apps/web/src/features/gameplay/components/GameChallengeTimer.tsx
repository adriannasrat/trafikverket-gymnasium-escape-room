import { ChallengeTimer } from "../../../components/ChallengeTimer";

export function GameChallengeTimer({
  remaining,
  total,
  complete,
  completeLabel,
}: {
  remaining: number;
  total: number;
  complete: boolean;
  completeLabel?: string;
}) {
  return (
    <ChallengeTimer
      remaining={remaining}
      total={total}
      complete={complete}
      completeLabel={completeLabel}
    />
  );
}
