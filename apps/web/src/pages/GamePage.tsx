import { ArrowRight, CheckCircle2, RotateCcw, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandHeader } from "../components/BrandHeader";
import { ChallengeTimer } from "../components/ChallengeTimer";
import { LoadingScreen } from "../components/LoadingScreen";
import { MissionRoute } from "../components/MissionRoute";
import { api } from "../lib/api";
import { formatElapsed } from "../lib/time";
import type { Challenge } from "../types";
import { barlow, cx, eyebrow, focusRing, primaryButton, secondaryButton } from "../uiStyles";

export function GamePage() {
  const { sessionId = "" } = useParams();
  const [data, setData] = useState<Challenge | null>(null);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    text: string;
  } | null>(null);
  const [completed, setCompleted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [timingOut, setTimingOut] = useState(false);
  const [awaitingNext, setAwaitingNext] = useState(false);
  const [error, setError] = useState("");

  const loadChallenge = useCallback(async () => {
    const result = await api.currentChallenge(sessionId);
    if (result.completed) {
      setCompleted(true);
      return;
    }
    setData(result);
    setRemaining(result.challenge.secondsRemaining);
    setSelected("");
    setAwaitingNext(result.challenge.awaitingNext);
    setFeedback(
      result.challenge.awaitingNext
        ? { correct: true, text: "Frågan är klar. Gå vidare när du är redo." }
        : null,
    );
  }, [sessionId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- load and synchronize the UI with the current server session.
    loadChallenge().catch(() => setError("Uppdraget kunde inte laddas."));
  }, [loadChallenge]);
  useEffect(() => {
    if (!data || completed) return;
    const tick = () => {
      setElapsed(Date.now() - new Date(data.startedAtUtc).getTime());
      if (awaitingNext) return;
      const challengeElapsed =
        (Date.now() -
          new Date(data.challenge.challengeStartedAtUtc).getTime()) /
        1000;
      setRemaining(
        Math.max(0, data.challenge.timeLimitSeconds - challengeElapsed),
      );
    };
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [data, completed, awaitingNext]);

  useEffect(() => {
    const challengeId = data?.challenge.id;
    if (!challengeId || completed || awaitingNext || timingOut || remaining > 0) return;
    // oxlint-disable-next-line react/set-state-in-effect -- zero on the visible server timer triggers one timeout registration.
    setTimingOut(true);
    api
      .timeout(sessionId, challengeId)
      .then((result) => {
        setData((current) =>
          current?.challenge.id === challengeId
            ? {
                ...current,
                challenge: {
                  ...current.challenge,
                  challengeStartedAtUtc: result.challengeStartedAtUtc,
                },
              }
            : current,
        );
        setRemaining(
          result.secondsRemaining ?? result.timeLimitSeconds,
        );
        if (result.expired) {
          setSelected("");
          setFeedback({
            correct: false,
            text: result.message ?? "Tiden tog slut. Försök igen.",
          });
        }
      })
      .catch((caught) => {
        setFeedback({
          correct: false,
          text:
            caught instanceof Error
              ? caught.message
              : "Tiden kunde inte registreras.",
        });
      })
      .finally(() => setTimingOut(false));
  }, [awaitingNext, completed, data?.challenge.id, remaining, sessionId, timingOut]);

  async function submit() {
    if (!data || !selected || awaitingNext || timingOut) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await api.answer(sessionId, data.challenge.id, selected);
      setFeedback({
        correct: result.correct,
        text: result.successMessage ?? result.message ?? "",
      });
      if (result.completed) {
        setElapsed(result.elapsedMilliseconds ?? elapsed);
        setCompleted(true);
      } else if (result.correct) {
        setAwaitingNext(true);
        setRemaining(0);
      } else if (result.challengeStartedAtUtc) {
        setData({
          ...data,
          challenge: {
            ...data.challenge,
            challengeStartedAtUtc: result.challengeStartedAtUtc,
          },
        });
        setRemaining(
          result.timeLimitSeconds ?? data.challenge.timeLimitSeconds,
        );
        setSelected("");
      }
    } catch (caught) {
      setFeedback({
        correct: false,
        text:
          caught instanceof Error
            ? caught.message
            : "Svaret kunde inte skickas.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function goToNextChallenge() {
    if (!awaitingNext || submitting) return;
    setSubmitting(true);
    try {
      await api.nextChallenge(sessionId);
      await loadChallenge();
    } catch (caught) {
      setFeedback({
        correct: false,
        text:
          caught instanceof Error
            ? caught.message
            : "Nästa fråga kunde inte laddas.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (error)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white text-[#666]">
        <h1 className={`${barlow} text-[#202020] uppercase`}>Kontakten bröts</h1>
        <p>{error}</p>
        <Link className={`font-bold text-[#d70000] ${focusRing}`} to="/">Till startsidan</Link>
      </div>
    );
  if (completed)
    return (
      <div className="min-h-screen overflow-hidden bg-white">
        <BrandHeader
          playerName={data?.playerName}
          elapsed={formatElapsed(elapsed)}
        />
        <main className="relative flex min-h-[calc(100vh-72px)] flex-col items-center justify-center px-[30px] py-12 text-center before:absolute before:top-[18%] before:left-[8%] before:size-[150px] before:rotate-8 before:border before:border-[#eee] before:content-[''] after:absolute after:right-[8%] after:bottom-[15%] after:size-[150px] after:-rotate-8 after:border after:border-[#eee] after:content-[''] max-[720px]:min-h-[calc(100vh-66px)] max-[720px]:px-5 max-[720px]:py-10 max-[720px]:before:hidden max-[720px]:after:hidden">
          <span className="mb-[30px] grid size-[76px] place-items-center rounded-full bg-[#23845e] text-white shadow-[0_0_0_12px_rgba(35,132,94,0.1)] [&>svg]:size-[38px]">
            <CheckCircle2 />
          </span>
          <p className={`${eyebrow} justify-center`}>UPPDRAG SLUTFÖRT</p>
          <h1 className={`${barlow} mb-3 text-[clamp(50px,6vw,70px)] text-[#202020] uppercase`}>Systemet är säkrat.</h1>
          <p className="text-[#606060]">
            Bra jobbat, <strong>{data?.playerName}</strong>! Din totaltid är
            registrerad.
          </p>
          <div className="my-[35px] grid">
            <small className="tracking-[0.2em] text-[#777]">SLUTTID</small>
            <strong className={`${barlow} text-[70px] tracking-[0.05em] text-[#d70000]`}>{formatElapsed(elapsed)}</strong>
          </div>
          <div className="relative z-1 flex gap-3 max-[720px]:w-[min(100%,320px)] max-[720px]:flex-col">
            <Link
              className={primaryButton}
              to="/leaderboard"
            >
              <Trophy size={18} /> Visa topplistan
            </Link>
            <Link
              className={secondaryButton}
              to="/"
            >
              <RotateCcw size={17} /> Nästa spelare
            </Link>
          </div>
        </main>
      </div>
    );
  if (!data) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <BrandHeader
        playerName={data.playerName}
        elapsed={formatElapsed(elapsed)}
      />
      <div className="grid min-h-[calc(100vh-72px)] grid-cols-[280px_minmax(0,1fr)] max-[980px]:grid-cols-[230px_minmax(0,1fr)] max-[720px]:block max-[720px]:min-h-[calc(100vh-66px)]">
        <MissionRoute
          current={data.challenge.number}
          total={data.challenge.total}
        />
        <main className="mx-auto w-full max-w-[1120px] p-[clamp(34px,4.5vw,68px)] max-[720px]:px-5 max-[720px]:pt-[34px] max-[720px]:pb-[42px]">
          <div className="flex justify-between gap-10 border-b border-[#dedede] pb-[25px] max-[720px]:gap-[10px]">
            <div>
              <p className={eyebrow}>
                ETAPP {data.challenge.number.toString().padStart(2, "0")} ·{" "}
                {data.game.title.toUpperCase()}
              </p>
              <h1 className={`${barlow} m-0 max-w-[820px] text-[clamp(33px,3.4vw,50px)] leading-[1.05] text-[#202020] uppercase max-[420px]:text-[31px]`}>{data.challenge.prompt}</h1>
            </div>
            <span className={`${barlow} text-[49px] font-bold text-[#d70000] max-[720px]:hidden`}>
              {data.challenge.number.toString().padStart(2, "0")}
              <span className="text-[20px] text-[#999]">/{data.challenge.total.toString().padStart(2, "0")}</span>
            </span>
          </div>
          {data.challenge.imagePath && (
            <img
              className="mt-[22px] block max-h-[360px] w-full bg-white object-contain p-3"
              src={data.challenge.imagePath}
              alt="Ledtråd till uppdraget"
            />
          )}
          <ChallengeTimer
            remaining={remaining}
            total={data.challenge.timeLimitSeconds}
            complete={awaitingNext}
          />
          <fieldset className="m-0 grid grid-cols-2 gap-[13px] border-0 p-0 max-[720px]:grid-cols-1">
            <legend className="absolute size-px overflow-hidden">Välj ett svar</legend>
            {data.challenge.options.map((option, index) => (
              <label
                className={cx(
                  'grid min-h-[78px] cursor-pointer grid-cols-[38px_minmax(0,1fr)] items-center gap-[15px] border border-[#cfcfcf] bg-white p-[15px] text-[#202020]',
                  selected === option.id
                    ? 'border-2 border-[#d70000] p-[14px] shadow-[0_5px_18px_rgba(215,0,0,0.08)] hover:border-[#d70000]'
                    : 'hover:border-[#888]',
                  awaitingNext && 'cursor-default',
                )}
                key={option.id}
              >
                <input
                  className="pointer-events-none absolute size-px opacity-0"
                  type="radio"
                  name="answer"
                  value={option.id}
                  checked={selected === option.id}
                  disabled={awaitingNext || submitting || timingOut}
                  onChange={() => {
                    setSelected(option.id);
                    setFeedback(null);
                  }}
                />
                <span className={cx(`${barlow} grid size-9 place-items-center bg-[#ededed] text-[18px] font-bold text-[#555]`, selected === option.id && 'bg-[#f9eeee] text-[#d70000]')}>{String.fromCharCode(65 + index)}</span>
                <strong className="text-[14px] leading-[1.45]">{option.text}</strong>
              </label>
            ))}
          </fieldset>
          <div className="mt-[22px] grid min-h-[52px] grid-cols-[1fr_auto] items-center gap-5 max-[720px]:grid-cols-1">
            <div>
              {feedback && (
                <p
                  className={cx(
                    'm-0 border-l-[3px] px-[13px] py-[11px] text-[13px]',
                    feedback.correct ? 'border-[#23845e] bg-[#eaf8f2] text-[#116e4c]' : 'border-[#c7352d] bg-[#fff0ef] text-[#9f302b]',
                  )}
                  role="status"
                >
                  {feedback.text}
                </p>
              )}
            </div>
            <button
              className={`${primaryButton} max-[720px]:w-full`}
              disabled={awaitingNext ? submitting : !selected || submitting || timingOut}
              onClick={awaitingNext ? goToNextChallenge : submit}
            >
              {submitting
                ? awaitingNext
                  ? "Laddar nästa…"
                  : "Kontrollerar…"
                : awaitingNext
                  ? "Nästa fråga"
                  : timingOut
                    ? "Tiden registreras…"
                    : "Bekräfta svar"}{" "}
              <ArrowRight size={18} />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
