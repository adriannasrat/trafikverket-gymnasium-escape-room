import { Check, Clock3, RotateCcw, Trash2, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../lib/api";
import { formatElapsed } from "../lib/time";
import type { AdminResult } from "../types";
import { barlow, eyebrow, focusRing } from "../uiStyles";

type AdminResultsPanelProps = {
  onUnauthorized: () => void;
};

export function AdminResultsPanel({ onUnauthorized }: AdminResultsPanelProps) {
  const [results, setResults] = useState<AdminResult[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loadResults = useCallback(async () => {
    try {
      setResults(await api.adminResults());
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized();
        return;
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "Spelresultaten kunde inte laddas.",
      );
      setResults([]);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- load and synchronize the admin list with persisted results.
    void loadResults();
  }, [loadResults]);

  async function deleteResult(result: AdminResult) {
    if (
      !window.confirm(
        `Ta bort resultatet för ”${result.playerName}”? Speltiden och alla registrerade svar tas bort permanent.`,
      )
    ) return;

    setDeleting(result.id);
    setStatus("");
    setError("");
    try {
      await api.deleteAdminResult(result.id);
      setResults((current) =>
        current
          ?.filter((candidate) => candidate.id !== result.id)
          .map((candidate, index) => ({ ...candidate, rank: index + 1 })) ?? [],
      );
      setStatus(`Resultatet för ${result.playerName} har tagits bort.`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized();
        return;
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "Spelresultatet kunde inte tas bort.",
      );
    } finally {
      setDeleting(null);
    }
  }

  async function deleteAllResults() {
    if (!results?.length) return;
    if (
      !window.confirm(
        `Töm alla ${results.length} slutförda spelresultat? Alla tider och registrerade svar tas bort permanent. Pågående spel påverkas inte.`,
      )
    ) return;

    setDeleting("all");
    setStatus("");
    setError("");
    try {
      await api.deleteAllAdminResults();
      setResults([]);
      setStatus("Alla slutförda spelresultat har tagits bort.");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized();
        return;
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "Spelresultaten kunde inte tas bort.",
      );
    } finally {
      setDeleting(null);
    }
  }

  if (results === null) {
    return (
      <div className="grid min-h-[420px] place-items-center text-[#666]">
        <div className="grid justify-items-center gap-3">
          <span className="size-9 animate-spin rounded-full border-[3px] border-[#ddd] border-t-[#d70000]" />
          <p className="m-0 text-[12px] tracking-[0.05em]">Laddar spelresultat…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7 flex items-end justify-between gap-[30px] max-[720px]:flex-col max-[720px]:items-stretch">
        <div>
          <p className={eyebrow}>TIDER & DELTAGARE</p>
          <h1 className={`${barlow} mb-[5px] text-[45px] text-[#202020] uppercase max-[420px]:text-[39px]`}>
            Spelresultat
          </h1>
          <p className="m-0 text-[13px] text-[#686868]">
            Hantera slutförda rundor som visas på topplistan.
          </p>
        </div>
        <button
          className={`inline-flex min-h-11 items-center justify-center gap-2 border border-[#b42a24] bg-white px-4 text-[10px] font-extrabold tracking-[0.08em] text-[#a32620] uppercase hover:bg-[#fff0ef] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          type="button"
          disabled={!results.length || deleting !== null}
          onClick={deleteAllResults}
        >
          <RotateCcw size={16} /> {deleting === "all" ? "Tömmer…" : "Töm alla resultat"}
        </button>
      </div>

      {status && (
        <p
          className="mb-[18px] flex items-center gap-[7px] border-l-[3px] border-[#23845e] bg-[#eaf6f0] px-[15px] py-[11px] text-[12px] text-[#166b4c]"
          role="status"
        >
          <Check size={16} /> {status}
        </p>
      )}
      {error && (
        <p
          className="mb-[18px] border-l-[3px] border-[#c7352d] bg-[#fff0ef] px-[15px] py-[11px] text-[12px] text-[#9f302b]"
          role="alert"
        >
          {error}
        </p>
      )}

      <section className="overflow-hidden border border-[#dedede] bg-white">
        <div className="flex items-center justify-between border-b border-[#dedede] bg-[#fafafa] px-5 py-4">
          <div>
            <p className={`${eyebrow} mb-1`}>TOPPLISTEDATA</p>
            <h2 className={`${barlow} text-[28px] text-[#202020] uppercase`}>
              {results.length} resultat
            </h2>
          </div>
          <span className="grid size-11 place-items-center rounded-full bg-[#f9eeee] text-[#d70000]">
            <Trophy size={21} />
          </span>
        </div>

        {results.length === 0 ? (
          <div className="grid min-h-[310px] place-items-center px-5 py-12 text-center">
            <div className="grid max-w-[360px] justify-items-center gap-3">
              <span className="grid size-14 place-items-center rounded-full bg-[#f2f2f2] text-[#777]">
                <Clock3 size={25} />
              </span>
              <h3 className={`${barlow} text-[27px] text-[#202020] uppercase`}>
                Inga resultat ännu
              </h3>
              <p className="m-0 text-[12px] leading-[1.6] text-[#6a6a6a]">
                Slutförda spelomgångar visas här och på den publika topplistan.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-[65px_minmax(150px,1fr)_120px_170px_48px] gap-3 border-b border-[#dedede] px-5 py-3 text-[9px] font-extrabold tracking-[0.11em] text-[#777] uppercase max-[820px]:grid-cols-[50px_minmax(120px,1fr)_90px_48px] max-[820px]:[&>span:nth-child(4)]:hidden">
              <span>Plats</span>
              <span>Spelare</span>
              <span>Sluttid</span>
              <span>Slutförd</span>
              <span className="sr-only">Åtgärd</span>
            </div>
            {results.map((result) => (
              <article
                className="grid min-h-[68px] grid-cols-[65px_minmax(150px,1fr)_120px_170px_48px] items-center gap-3 border-b border-[#ededed] px-5 py-3 last:border-b-0 max-[820px]:grid-cols-[50px_minmax(120px,1fr)_90px_48px]"
                key={result.id}
              >
                <strong className={`${barlow} text-[25px] text-[#d70000]`}>
                  {result.rank.toString().padStart(2, "0")}
                </strong>
                <span className="min-w-0 overflow-hidden text-[13px] font-bold text-ellipsis whitespace-nowrap text-[#202020]">
                  {result.playerName}
                </span>
                <time className={`${barlow} text-[22px] font-bold text-[#202020]`}>
                  {formatElapsed(result.elapsedMilliseconds)}
                </time>
                <time className="text-[10px] leading-[1.4] text-[#777] max-[820px]:hidden">
                  {new Intl.DateTimeFormat("sv-SE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(result.completedAtUtc))}
                </time>
                <button
                  className={`grid size-10 place-items-center border border-[#d0d0d0] bg-white text-[#a32620] hover:border-[#b42a24] hover:bg-[#fff0ef] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                  type="button"
                  aria-label={`Ta bort resultatet för ${result.playerName}`}
                  title={`Ta bort resultatet för ${result.playerName}`}
                  disabled={deleting !== null}
                  onClick={() => deleteResult(result)}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
