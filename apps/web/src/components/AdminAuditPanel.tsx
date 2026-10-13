import { History, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../lib/api";
import type { AuditEntry } from "../types";
import { barlow, eyebrow, focusRing } from "../uiStyles";

type AdminAuditPanelProps = {
  onUnauthorized: () => void;
};

const actionLabels: Record<string, string> = {
  created: "Skapad",
  updated: "Uppdaterad",
  deleted: "Borttagen",
  cleared: "Tömd",
  "uploaded-image": "Bild uppladdad",
};

const entityLabels: Record<string, string> = {
  game: "Spel",
  challenge: "Uppdrag",
  "matching-destination": "Riskzon",
  "sorting-card": "Sorteringskort",
  "word-part": "Orddel",
  session: "Spelresultat",
  results: "Resultatlista",
};

export function AdminAuditPanel({ onUnauthorized }: AdminAuditPanelProps) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadEntries = useCallback(async () => {
    setError("");
    try {
      setEntries(await api.adminAudit());
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized();
        return;
      }
      setError(caught instanceof Error ? caught.message : "Händelseloggen kunde inte laddas.");
      setEntries([]);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- load the latest persisted administration events.
    void loadEntries();
  }, [loadEntries]);

  async function refresh() {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  }

  if (entries === null) {
    return (
      <div className="grid min-h-[420px] place-items-center text-[#666]">
        <div className="grid justify-items-center gap-3">
          <span className="size-9 animate-spin rounded-full border-[3px] border-[#ddd] border-t-[#d70000]" />
          <p className="m-0 text-[12px] tracking-[0.05em]">Laddar händelselogg…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7 flex items-end justify-between gap-[30px] max-[720px]:flex-col max-[720px]:items-stretch">
        <div>
          <p className={eyebrow}>SPÅRBARHET & KONTROLL</p>
          <h1 className={`${barlow} mb-[5px] text-[45px] text-[#202020] uppercase max-[420px]:text-[39px]`}>
            Händelselogg
          </h1>
          <p className="m-0 text-[13px] text-[#686868]">
            De 50 senaste ändringarna som administratörer har gjort.
          </p>
        </div>
        <button
          className={`inline-flex min-h-11 items-center justify-center gap-2 border border-[#cfcfcf] bg-white px-4 text-[10px] font-extrabold tracking-[0.08em] text-[#444] uppercase hover:border-[#888] disabled:cursor-wait disabled:opacity-50 ${focusRing}`}
          type="button"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          <RefreshCw className={refreshing ? "animate-spin" : ""} size={16} />
          {refreshing ? "Uppdaterar…" : "Uppdatera"}
        </button>
      </div>

      {error && (
        <p className="mb-[18px] border-l-[3px] border-[#c7352d] bg-[#fff0ef] px-[15px] py-[11px] text-[12px] text-[#9f302b]" role="alert">
          {error}
        </p>
      )}

      <section className="overflow-hidden border border-[#dedede] bg-white">
        <div className="flex items-center justify-between border-b border-[#dedede] bg-[#fafafa] px-5 py-4">
          <div>
            <p className={`${eyebrow} mb-1`}>SENASTE HÄNDELSER</p>
            <h2 className={`${barlow} text-[28px] text-[#202020] uppercase`}>
              {entries.length} loggposter
            </h2>
          </div>
          <span className="grid size-11 place-items-center rounded-full bg-[#f9eeee] text-[#d70000]">
            <History size={21} />
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="grid min-h-[280px] place-items-center px-5 py-12 text-center">
            <p className="m-0 max-w-[360px] text-[12px] leading-[1.6] text-[#6a6a6a]">
              Det finns inga registrerade administrationshändelser ännu.
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry) => (
              <article
                className="grid grid-cols-[170px_130px_130px_minmax(180px,1fr)] gap-4 border-b border-[#ededed] px-5 py-4 last:border-b-0 max-[900px]:grid-cols-[140px_110px_minmax(170px,1fr)] max-[900px]:[&>span:nth-child(3)]:hidden max-[620px]:grid-cols-1 max-[620px]:gap-1"
                key={entry.id}
              >
                <time className="text-[10px] leading-[1.5] text-[#666]">
                  {new Intl.DateTimeFormat("sv-SE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(entry.occurredAtUtc))}
                </time>
                <span className="text-[10px] font-bold text-[#202020]">
                  {entry.actor}
                </span>
                <span className="text-[9px] font-extrabold tracking-[0.08em] text-[#a32620] uppercase">
                  {actionLabels[entry.action] ?? entry.action} · {entityLabels[entry.entityType] ?? entry.entityType}
                </span>
                <p className="m-0 text-[11px] leading-[1.5] text-[#555]">{entry.summary}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
