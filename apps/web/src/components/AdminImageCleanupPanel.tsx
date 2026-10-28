import { Check, HardDrive, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../lib/api";
import type { ImageCleanupReport } from "../types";
import { barlow, eyebrow, focusRing } from "../uiStyles";

type AdminImageCleanupPanelProps = {
  onUnauthorized: () => void;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminImageCleanupPanel({
  onUnauthorized,
}: AdminImageCleanupPanelProps) {
  const [report, setReport] = useState<ImageCleanupReport | null>(null);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const preview = useCallback(async () => {
    setWorking(true);
    setError("");
    try {
      setReport(await api.previewUnusedImages());
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized();
        return;
      }
      setError(caught instanceof Error
        ? caught.message
        : "Bildlagringen kunde inte kontrolleras.");
    } finally {
      setWorking(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- load the latest persisted file inventory when the panel opens.
    void preview();
  }, [preview]);

  async function cleanup() {
    if (!report?.candidateCount) return;
    if (!window.confirm(
      `Ta bort ${report.candidateCount} oanvända bildfiler (${formatBytes(report.totalBytes)})? Endast filer som inte används av någon fråga raderas.`,
    )) return;

    setWorking(true);
    setStatus("");
    setError("");
    try {
      const result = await api.cleanupUnusedImages();
      setStatus(
        `${result.deletedCount} oanvända bildfiler togs bort.${result.skippedCount ? ` ${result.skippedCount} filer lämnades kvar av säkerhetsskäl.` : ""}`,
      );
      setReport(await api.previewUnusedImages());
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized();
        return;
      }
      setError(caught instanceof Error
        ? caught.message
        : "De oanvända bilderna kunde inte rensas.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <div className="mb-7 flex items-end justify-between gap-[30px] max-[720px]:flex-col max-[720px]:items-stretch">
        <div>
          <p className={eyebrow}>SÄKER FILLAGRING</p>
          <h1 className={`${barlow} mb-[5px] text-[45px] text-[#202020] uppercase max-[420px]:text-[39px]`}>
            Bildlagring
          </h1>
          <p className="m-0 max-w-[680px] text-[13px] leading-[1.6] text-[#686868]">
            Förhandsgranskningen visar bara uppladdade filer som ingen fråga använder. Bilder som fortfarande refereras raderas aldrig.
          </p>
        </div>
        <button
          className={`inline-flex min-h-11 items-center justify-center gap-2 border border-[#cfcfcf] bg-white px-4 text-[10px] font-extrabold tracking-[0.08em] text-[#444] uppercase hover:border-[#888] disabled:cursor-wait disabled:opacity-50 ${focusRing}`}
          type="button"
          disabled={working}
          onClick={() => void preview()}
        >
          <RefreshCw className={working ? "animate-spin" : ""} size={16} />
          Kontrollera igen
        </button>
      </div>

      {status && (
        <p className="mb-[18px] flex items-center gap-2 border-l-[3px] border-[#23845e] bg-[#eaf6f0] px-[15px] py-[11px] text-[12px] text-[#166b4c]" role="status">
          <Check size={16} /> {status}
        </p>
      )}
      {error && (
        <p className="mb-[18px] border-l-[3px] border-[#c7352d] bg-[#fff0ef] px-[15px] py-[11px] text-[12px] text-[#9f302b]" role="alert">
          {error}
        </p>
      )}

      <section className="overflow-hidden border border-[#dedede] bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-[#dedede] bg-[#fafafa] px-5 py-4">
          <div>
            <p className={`${eyebrow} mb-1`}>FÖRHANDSGRANSKNING · INGET RADERAS AUTOMATISKT</p>
            <h2 className={`${barlow} text-[28px] text-[#202020] uppercase`}>
              {report ? `${report.candidateCount} oanvända filer` : "Kontrollerar filer"}
            </h2>
          </div>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#f9eeee] text-[#d70000]">
            <HardDrive size={21} />
          </span>
        </div>

        {!report ? (
          <div className="grid min-h-[250px] place-items-center text-[#666]">
            <span className="size-9 animate-spin rounded-full border-[3px] border-[#ddd] border-t-[#d70000]" />
          </div>
        ) : report.candidateCount === 0 ? (
          <div className="grid min-h-[250px] place-items-center px-5 py-12 text-center">
            <div className="grid max-w-[390px] justify-items-center gap-3">
              <span className="grid size-14 place-items-center rounded-full bg-[#eaf6f0] text-[#23845e]">
                <ShieldCheck size={26} />
              </span>
              <h3 className={`${barlow} text-[27px] text-[#202020] uppercase`}>Allt är städat</h3>
              <p className="m-0 text-[12px] leading-[1.6] text-[#6a6a6a]">
                Det finns inga oanvända, systemhanterade bildfiler att ta bort.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-[360px] overflow-y-auto">
              {report.files.map((file) => (
                <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-4 border-b border-[#ededed] px-5 py-3 last:border-b-0" key={file.imagePath}>
                  <code className="overflow-hidden text-[10px] text-ellipsis whitespace-nowrap text-[#555]">{file.imagePath}</code>
                  <span className="text-right text-[10px] font-bold text-[#777]">{formatBytes(file.sizeBytes)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-5 border-t border-[#dedede] bg-[#fafafa] px-5 py-4 max-[600px]:flex-col max-[600px]:items-stretch">
              <p className="m-0 text-[11px] text-[#666]">
                Totalt <strong>{formatBytes(report.totalBytes)}</strong>. En ny referenskontroll görs direkt före varje radering.
              </p>
              <button
                className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-[#b42a24] bg-[#d70000] px-4 text-[10px] font-extrabold tracking-[0.08em] text-white uppercase hover:bg-[#b90000] disabled:cursor-wait disabled:opacity-50 ${focusRing}`}
                type="button"
                disabled={working}
                onClick={() => void cleanup()}
              >
                <Trash2 size={16} /> {working ? "Rensar…" : "Rensa oanvända filer"}
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
