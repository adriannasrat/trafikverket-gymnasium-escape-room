import { useCallback, useEffect, useRef, type AnimationEvent } from "react";
import { Heart, Sparkles, Star } from "lucide-react";
import type { ProgressAnimation as Animation } from "../hooks/useSessionProgress";
import { barlow } from "../../../uiStyles";

export function ProgressAnimation({
  animation,
  onFinished,
}: {
  animation: Animation | null;
  onFinished: () => void;
}) {
  const onFinishedRef = useRef(onFinished);
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const finish = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    onFinishedRef.current();
  }, []);

  useEffect(() => {
    if (!animation) return;
    hasFinishedRef.current = false;
    const fallback = window.setTimeout(finish, 2_800);
    return () => window.clearTimeout(fallback);
  }, [animation, finish]);

  if (!animation) return null;

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target) finish();
  };

  if (animation.type === "life") {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-[100] grid place-items-center"
        aria-live="assertive"
      >
        <div
          key={animation.id}
          className="life-loss-animation grid justify-items-center gap-2"
          onAnimationEnd={handleAnimationEnd}
        >
          <span className="grid size-20 place-items-center rounded-full bg-[#fff0ef] text-[#d70000] shadow-[0_0_0_12px_rgba(215,0,0,0.08),0_18px_55px_rgba(80,20,20,0.22)]">
            <Heart className="life-loss-heart size-10" fill="currentColor" strokeWidth={1.8} />
          </span>
          <strong className={`${barlow} text-[34px] leading-none text-[#a32620] uppercase drop-shadow-[0_2px_0_white]`}>
            {animation.timedOut
              ? "Game over"
              : animation.gameOver ? "Alla liv förlorade" : "Ett liv förlorat"}
          </strong>
          <small className="rounded-full bg-white/95 px-4 py-1.5 text-[10px] font-extrabold tracking-[0.14em] text-[#555] uppercase shadow-lg">
            {animation.timedOut
              ? "Tiden tog slut"
              : `${animation.livesRemaining} liv kvar`}
          </small>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] grid place-items-center overflow-hidden"
      aria-live="polite"
    >
      <div
        key={animation.id}
        className="score-burst-animation relative grid size-[280px] place-items-center"
        onAnimationEnd={handleAnimationEnd}
      >
        <span className="score-ring absolute size-40 rounded-full border-[3px] border-[#23845e]/45" />
        <span className="score-ring score-ring-delay absolute size-40 rounded-full border-2 border-[#f3b61f]/50" />
        {[0, 1, 2, 3, 4, 5].map((particle) => (
          <Star
            className={`score-particle score-particle-${particle} absolute size-5 text-[#f3b61f]`}
            fill="currentColor"
            key={particle}
          />
        ))}
        <div className="relative grid min-w-[230px] justify-items-center border border-[#a9d4c1] bg-white px-8 py-7 shadow-[0_24px_70px_rgba(20,90,62,0.28)] before:absolute before:inset-1 before:border before:border-[#dcefe6] before:content-['']">
          <Sparkles className="relative mb-2 size-7 text-[#23845e]" />
          <strong className={`${barlow} relative text-[64px] leading-[0.85] text-[#23845e]`}>
            +{animation.amount}
          </strong>
          <span className="relative mt-3 text-[10px] font-extrabold tracking-[0.22em] text-[#555] uppercase">
            Poäng
          </span>
        </div>
      </div>
    </div>
  );
}
