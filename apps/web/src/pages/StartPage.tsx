import {
  ArrowRight,
  Clock3,
  LockKeyhole,
  RadioTower,
  Route,
  TrainFront,
  Trophy,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandHeader } from "../components/BrandHeader";
import { api } from "../lib/api";
import { formatElapsed } from "../lib/time";
import type { GameSummary, LeaderboardEntry } from "../types";
import {
  barlow,
  eventFooter,
  eyebrow,
  fieldLabel,
  focusRing,
  formError,
  primaryButton,
} from "../uiStyles";

export function StartPage() {
  const [playerName, setPlayerName] = useState("");
  const [game, setGame] = useState<GameSummary | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .games()
      .then((games) => setGame(games[0] ?? null))
      .catch(() => undefined);
    api
      .leaderboard()
      .then((entries) => setLeaders(entries.slice(0, 3)))
      .catch(() => setLeaders([]));
  }, []);

  async function start(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStarting(true);
    try {
      const session = await api.startSession(playerName);
      navigate(`/play/${session.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Spelet kunde inte startas.",
      );
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-white">
      <BrandHeader />
      <main className="relative mx-auto flex min-h-[calc(100vh-126px)] w-[min(1180px,100%)] flex-col items-center px-8 pt-[clamp(54px,7vh,88px)] pb-[34px] max-[720px]:min-h-[calc(100vh-120px)] max-[720px]:px-[18px] max-[720px]:pt-[43px] max-[720px]:pb-7">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <span className="absolute top-[14%] left-[2%] grid size-[72px] -rotate-5 place-items-center border border-[#ececec] bg-white text-[#d70000] shadow-[0_18px_45px_rgba(40,40,40,0.08)] after:absolute after:-inset-3 after:border after:border-[#f4f4f4] after:content-[''] [&>svg]:size-[27px] [&>svg]:stroke-[1.7] max-[980px]:left-[2%] max-[980px]:scale-[.82] max-[980px]:opacity-[.34] max-[720px]:hidden">
            <TrainFront />
          </span>
          <span className="absolute top-[12%] right-[2%] grid size-[72px] rotate-5 place-items-center border border-[#ececec] bg-white text-[#d70000] shadow-[0_18px_45px_rgba(40,40,40,0.08)] after:absolute after:-inset-3 after:border after:border-[#f4f4f4] after:content-[''] [&>svg]:size-[27px] [&>svg]:stroke-[1.7] max-[980px]:right-[2%] max-[980px]:scale-[.82] max-[980px]:opacity-[.34] max-[720px]:hidden">
            <Route />
          </span>
          <span className="absolute bottom-[16%] left-[12%] grid size-[72px] rotate-4 place-items-center border border-[#ececec] bg-white text-[#d70000] shadow-[0_18px_45px_rgba(40,40,40,0.08)] after:absolute after:-inset-3 after:border after:border-[#f4f4f4] after:content-[''] [&>svg]:size-[27px] [&>svg]:stroke-[1.7] max-[980px]:left-[2%] max-[980px]:scale-[.82] max-[980px]:opacity-[.34] max-[720px]:hidden">
            <RadioTower />
          </span>
          <span className="absolute right-[12%] bottom-[15%] grid size-[72px] -rotate-4 place-items-center border border-[#ececec] bg-white text-[#d70000] shadow-[0_18px_45px_rgba(40,40,40,0.08)] after:absolute after:-inset-3 after:border after:border-[#f4f4f4] after:content-[''] [&>svg]:size-[27px] [&>svg]:stroke-[1.7] max-[980px]:right-[2%] max-[980px]:scale-[.82] max-[980px]:opacity-[.34] max-[720px]:hidden">
            <Trophy />
          </span>
        </div>

        <section className="relative z-2 w-[min(720px,100%)] text-center">
          <p className={`${eyebrow} mb-5 justify-center`}>
            TRAFIKVERKET · ESCAPE ROOM
          </p>
          <h1
            className={`${barlow} m-0 text-[clamp(64px,7vw,92px)] leading-[.86] font-bold tracking-[-.025em] text-[#202020] uppercase max-[720px]:text-[57px] max-[420px]:text-[50px]`}
          >
            Håll Sverige
            <br />
            <mark className="bg-transparent text-[#d70000]">i rörelse.</mark>
          </h1>
          <p className="mx-auto mt-7 max-w-[600px] text-[15px] leading-[1.7] text-[#565656] max-[720px]:mt-[23px] max-[720px]:text-[14px]">
            Ta plats i Trafikverkets digitala kontrollrum. Lös uppdragen, slå
            klockan och upptäck tekniken bakom resan.
          </p>

          <form
            className="mx-auto mt-[31px] w-[min(640px,100%)] text-left"
            onSubmit={start}
          >
            <label className={`${fieldLabel} mb-2`} htmlFor="playerName">
              DITT NAMN
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] border border-[#9a9a9a] bg-white p-[5px] shadow-[0_8px_24px_rgba(30,30,30,0.06)] focus-within:border-[#d70000] focus-within:shadow-[0_0_0_3px_rgba(215,0,0,0.09)] max-[720px]:grid-cols-1 max-[720px]:gap-[5px]">
              <input
                className={`min-w-0 border-0 bg-white px-[14px] py-3 text-[#202020] outline-none shadow-none ${focusRing}`}
                id="playerName"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Skriv ditt namn"
                minLength={2}
                maxLength={80}
                autoComplete="off"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] bg-white pt-[5px] shadow-[0_8px_24px_rgba(30,30,30,0.06)]">
              <button
                className={`${primaryButton} min-w-[190px] max-[720px]:w-full max-[720px]:min-w-0`}
                disabled={starting || playerName.trim().length < 2}
              >
                {starting ? "Startar…" : "Starta uppdraget"}{" "}
                <ArrowRight size={18} />
              </button>
            </div>
            {error && (
              <p className={`${formError} mt-[9px]`} role="alert">
                {error}
              </p>
            )}
            <small className="mt-3 flex items-center justify-center gap-[6px] text-[10px] text-[#747474]">
              <Clock3 size={14} /> Totaltiden börjar när du startar.
            </small>
          </form>

          {game && (
            <p className="mt-[18px] inline-flex items-center gap-[9px] text-[10px] text-[#606060] max-[420px]:flex-col max-[420px]:items-start max-[420px]:gap-1">
              <span className="text-[8px] font-extrabold tracking-[.13em] text-[#d70000]">
                AKTIVT UPPDRAG
              </span>
              {game.title}
            </p>
          )}
        </section>

        <section
          className="relative z-2 mt-[clamp(38px,6vh,64px)] w-[min(720px,100%)] border-t border-[#dedede] pt-[19px]"
          aria-labelledby="best-times-title"
        >
          <header className="mb-[11px] flex items-end justify-between gap-[18px]">
            <div>
              <p className={`${eyebrow} mb-[3px] text-[8px]`}>TOPPLISTA</p>
              <h2
                className={`${barlow} m-0 text-[26px] text-[#202020] uppercase`}
                id="best-times-title"
              >
                Bästa tider
              </h2>
            </div>
            <Link
              className={`flex items-center gap-[6px] text-[10px] font-bold text-[#555] ${focusRing}`}
              to="/leaderboard"
            >
              Visa alla <ArrowRight size={14} />
            </Link>
          </header>
          {leaders === null ? (
            <div className="flex min-h-12 items-center justify-center gap-[10px] bg-[#f5f5f5] text-[10px] text-[#6c6c6c]">
              Hämtar tider…
            </div>
          ) : leaders.length === 0 ? (
            <div className="flex min-h-12 items-center justify-center gap-[10px] bg-[#f5f5f5] text-[10px] text-[#6c6c6c]">
              <Trophy className="text-[#d70000]" size={21} />
              <span className="flex gap-1 max-[720px]:grid">
                <strong className="text-[#333]">Första rekordet väntar.</strong>{" "}
                Din tid kan bli den första.
              </span>
            </div>
          ) : (
            <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0 max-[720px]:grid-cols-1">
              {leaders.map((entry) => (
                <li
                  className="grid grid-cols-[25px_1fr] items-center gap-x-2 gap-y-px bg-[#f5f5f5] px-3 py-[10px] text-left"
                  key={entry.id}
                >
                  <span
                    className={`${barlow} row-span-2 grid size-6 place-items-center bg-[#d70000] font-bold text-white`}
                  >
                    {entry.rank}
                  </span>
                  <strong className="overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-[#303030]">
                    {entry.playerName}
                  </strong>
                  <time
                    className={`${barlow} text-[13px] font-semibold tracking-[.04em] text-[#686868]`}
                  >
                    {formatElapsed(entry.elapsedMilliseconds)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
      <footer className={eventFooter}>
        <span className="max-[720px]:hidden">TRAFIKVERKET · GYMNASIUM</span>
        <nav className="flex gap-[25px]">
          <Link
            className={`flex items-center gap-[5px] text-[#555] ${focusRing}`}
            to="/leaderboard"
          >
            Topplista
          </Link>
          <Link
            className={`flex items-center gap-[5px] text-[#555] ${focusRing}`}
            to="/admin/login"
          >
            <LockKeyhole size={13} /> Admin
          </Link>
        </nav>
      </footer>
    </div>
  );
}
