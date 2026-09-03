import {
  Check,
  ChevronRight,
  Gamepad2,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandHeader } from "../components/BrandHeader";
import { LoadingScreen } from "../components/LoadingScreen";
import { ApiError, api } from "../lib/api";
import type { AdminGame } from "../types";
import { barlow, cx, eyebrow, field, fieldLabel, focusRing, primaryButton } from "../uiStyles";

const sidebarButton = `flex min-h-[45px] w-full cursor-pointer items-center gap-[11px] border-0 bg-transparent px-3 text-left text-[12px] text-[#777] disabled:cursor-not-allowed disabled:opacity-[0.42] [&>svg]:w-[17px] max-[980px]:justify-center max-[980px]:text-[0px] max-[980px]:[&>svg]:w-[19px] max-[720px]:min-h-[42px] max-[720px]:w-auto max-[720px]:justify-start max-[720px]:px-3 max-[720px]:text-[11px] ${focusRing}`;

export function AdminPage() {
  const [games, setGames] = useState<AdminGame[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const game =
    games?.find((candidate) => candidate.id === selectedId) ?? games?.[0];

  useEffect(() => {
    api
      .adminGames()
      .then((result) => {
        setGames(result);
        setSelectedId(result[0]?.id ?? "");
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401)
          navigate("/admin/login", { replace: true });
      });
  }, [navigate]);

  function updateGame(change: Partial<AdminGame>) {
    if (!game) return;
    setGames(
      (current) =>
        current?.map((candidate) =>
          candidate.id === game.id ? { ...candidate, ...change } : candidate,
        ) ?? null,
    );
    setStatus("");
  }

  async function save() {
    if (!game) return;
    setSaving(true);
    setStatus("");
    try {
      const saved = await api.updateGame(game);
      setGames(
        (current) =>
          current?.map((candidate) =>
            candidate.id === saved.id ? saved : candidate,
          ) ?? null,
      );
      setStatus("Ändringarna är sparade och klara för eventet.");
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Ändringarna kunde inte sparas.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await api.logout();
    navigate("/admin/login");
  }
  async function uploadImage(challengeId: string, image?: File) {
    if (!game || !image) return;
    setStatus("Laddar upp bilden…");
    try {
      const result = await api.uploadChallengeImage(challengeId, image);
      updateGame({
        challenges: game.challenges.map((challenge) =>
          challenge.id === challengeId
            ? { ...challenge, imagePath: result.imagePath }
            : challenge,
        ),
      });
      setStatus("Bilden är uppladdad och syns nu i uppdraget.");
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Bilden kunde inte laddas upp.",
      );
    }
  }
  if (!games) return <LoadingScreen label="Öppnar kontrollrummet…" />;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <BrandHeader mode="admin" />
      <div className="grid min-h-[calc(100vh-72px)] grid-cols-[230px_minmax(0,1fr)] max-[980px]:grid-cols-[78px_minmax(0,1fr)] max-[720px]:block max-[720px]:min-h-[calc(100vh-66px)]">
        <aside className="flex flex-col border-r border-[#dedede] bg-white px-[18px] py-7 text-[#202020] max-[980px]:px-[10px] max-[980px]:py-[25px] max-[720px]:min-h-[58px] max-[720px]:flex-row max-[720px]:items-center max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:px-[14px] max-[720px]:py-[7px]">
          <p className="m-0 px-3 pb-[13px] text-[9px] tracking-[0.18em] text-[#777] max-[980px]:text-[0px] max-[720px]:hidden">KONTROLLRUM</p>
          <nav className="grid gap-[5px] max-[720px]:flex">
            <button className={`${sidebarButton} max-[720px]:hidden`} disabled title="Kommer i nästa etapp">
              <LayoutDashboard /> Översikt
            </button>
            <button className={`${sidebarButton} border-l-[3px] border-[#d70000] bg-[#f9eeee] pl-[9px] font-bold text-[#d70000] max-[980px]:p-0 max-[720px]:px-3`}>
              <Gamepad2 /> Uppdrag <ChevronRight className="ml-auto w-[13px] max-[980px]:hidden" />
            </button>
            <button className={`${sidebarButton} max-[720px]:hidden`} disabled title="Kommer i nästa etapp">
              <ShieldCheck /> Händelselogg
            </button>
            <button className={`${sidebarButton} max-[720px]:hidden`} disabled title="Kommer i nästa etapp">
              <Settings2 /> Inställningar
            </button>
          </nav>
          <div className="mt-auto border-t border-[#dedede] pt-[18px] max-[720px]:ml-auto max-[720px]:mt-0 max-[720px]:border-0 max-[720px]:p-0">
            <span className="flex items-center gap-[7px] px-3 pb-[10px] text-[8px] tracking-[0.12em] text-[#23845e] max-[980px]:hidden">
              <i className="size-[7px] rounded-full bg-[#23845e] shadow-[0_0_0_4px_rgba(35,132,94,0.1)]" /> SYSTEM ONLINE
            </span>
            <button className={sidebarButton} onClick={logout}>
              <LogOut /> Logga ut
            </button>
          </div>
        </aside>
        <main className="min-w-0 px-[clamp(24px,4vw,60px)] pt-[38px] pb-[65px] max-[720px]:px-[14px] max-[720px]:pt-[30px] max-[720px]:pb-[45px]">
          <div className="mb-7 flex items-end justify-between gap-[30px] max-[720px]:flex-col max-[720px]:items-stretch">
            <div>
              <p className={eyebrow}>INNEHÅLL & SPELFLÖDE</p>
              <h1 className={`${barlow} mb-[5px] text-[45px] text-[#202020] uppercase max-[420px]:text-[39px]`}>Hantera uppdrag</h1>
              <p className="m-0 text-[13px] text-[#686868]">Ändra vad deltagarna ser utan att röra koden.</p>
            </div>
            <button
              className={`${primaryButton} max-[720px]:w-full`}
              onClick={save}
              disabled={!game || saving}
            >
              <Save size={17} /> {saving ? "Sparar…" : "Spara ändringar"}
            </button>
          </div>
          {status && (
            <p className="mb-[18px] flex items-center gap-[7px] border-l-[3px] border-[#23845e] bg-[#eaf6f0] px-[15px] py-[11px] text-[12px] text-[#166b4c]" role="status">
              <Check size={16} /> {status}
            </p>
          )}
          {game && (
            <section className="mb-[18px] flex items-center gap-[18px] overflow-x-auto border border-[#dedede] bg-white p-[17px] max-[720px]:grid max-[720px]:items-stretch max-[720px]:overflow-visible">
              <div className="min-w-[210px] max-[720px]:min-w-0">
                <p className={`${eyebrow} mb-[5px]`}>UPPDRAGSBILDER</p>
                <span className="text-[10px] text-[#686868]">
                  Valfria ledtrådsbilder som visas för deltagarna.
                </span>
              </div>
              {game.challenges.map((challenge, index) => (
                <div
                  className="grid min-w-[300px] grid-cols-[70px_1fr] items-center gap-x-[10px] gap-y-[5px] border-l border-[#dedede] pl-[14px] max-[720px]:min-w-0 max-[720px]:border-t max-[720px]:border-l-0 max-[720px]:pt-[14px] max-[720px]:pl-0"
                  key={challenge.id}
                >
                  {challenge.imagePath ? (
                    <img
                      className="row-span-2 h-12 w-[70px] object-cover"
                      src={challenge.imagePath}
                      alt={`Bild för uppdrag ${index + 1}`}
                    />
                  ) : (
                    <span className="row-span-2 grid h-12 w-[70px] place-items-center bg-[#f5f5f5] text-center text-[8px] text-[#777] [&>svg]:w-[17px]">
                      <ImagePlus /> Ingen bild
                    </span>
                  )}
                  <label
                    className={`flex w-max cursor-pointer items-center gap-[6px] border border-[#999] bg-white px-[9px] py-[7px] text-[9px] font-extrabold text-[#202020] uppercase focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[rgba(215,0,0,0.25)]`}
                  >
                    <ImagePlus size={15} />{" "}
                    {challenge.imagePath ? "Byt bild" : "Ladda upp"}
                    <input
                      className="absolute size-px opacity-0"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        uploadImage(challenge.id, event.target.files?.[0])
                      }
                    />
                  </label>
                  <small className="text-[8px] text-[#777]">
                    Uppdrag {index + 1} · max 5 MB
                  </small>
                </div>
              ))}
            </section>
          )}
          <div className="grid min-h-[600px] grid-cols-[235px_minmax(0,1fr)] border border-[#dedede] bg-white max-[980px]:grid-cols-1">
            <section className="border-r border-[#dedede] bg-[#fafafa] px-3 py-[18px] max-[980px]:border-r-0 max-[980px]:border-b">
              <h2 className="px-[10px] text-[10px] tracking-[0.15em] text-[#666] uppercase max-[980px]:hidden">
                Spel
              </h2>
              {games.map((candidate) => (
                <button
                  key={candidate.id}
                  className={cx(
                    `flex w-full cursor-pointer items-center gap-[5px] border-0 bg-transparent px-[11px] py-[14px] text-left text-[#777] max-[980px]:max-w-80 ${focusRing}`,
                    candidate.id === game?.id &&
                      "border-l-[3px] border-[#d70000] bg-[#f9eeee] pl-2",
                  )}
                  onClick={() => setSelectedId(candidate.id)}
                >
                  <span className="grid min-w-0 flex-1 gap-[5px]">
                    <strong className="text-[12px] text-[#202020]">
                      {candidate.title}
                    </strong>
                    <small className="text-[9px]">
                      {candidate.challenges.length} uppdrag ·{" "}
                      {candidate.isActive ? "Aktivt" : "Pausat"}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </section>
            {game && (
              <section className="min-w-0 p-[30px] max-[720px]:px-[14px] max-[720px]:py-[22px]">
                <div className="flex justify-between gap-5 border-b border-[#dedede] pb-5 max-[720px]:flex-col max-[720px]:items-start">
                  <div>
                    <p className={eyebrow}>SPELINSTÄLLNINGAR</p>
                    <h2
                      className={`${barlow} text-[33px] text-[#202020] uppercase`}
                    >
                      {game.title}
                    </h2>
                  </div>
                  <label className="flex items-center gap-[10px] text-[11px] font-bold text-[#555]">
                    <span>{game.isActive ? "Aktivt" : "Pausat"}</span>
                    <input
                      className="peer absolute size-px opacity-0"
                      type="checkbox"
                      checked={game.isActive}
                      onChange={(event) =>
                        updateGame({ isActive: event.target.checked })
                      }
                    />
                    <i className="relative h-[21px] w-[39px] rounded-[15px] bg-[#aaa] after:absolute after:top-[3px] after:left-[3px] after:size-[15px] after:rounded-full after:bg-white after:content-[''] peer-checked:bg-[#d70000] peer-checked:after:translate-x-[18px] after:transition-transform after:duration-150" />
                  </label>
                </div>
                <div className="my-[25px] mb-[35px] grid grid-cols-[1fr_190px] gap-[17px] max-[980px]:grid-cols-1">
                  <label className={fieldLabel}>
                    TITEL
                    <input
                      className={field}
                      value={game.title}
                      onChange={(event) =>
                        updateGame({ title: event.target.value })
                      }
                    />
                  </label>
                  <label className={fieldLabel}>
                    TID PER UPPDRAG (SEK)
                    <input
                      className={field}
                      type="number"
                      min="5"
                      max="900"
                      value={game.defaultTimeLimitSeconds}
                      onChange={(event) =>
                        updateGame({
                          defaultTimeLimitSeconds: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label
                    className={`${fieldLabel} col-span-full max-[980px]:col-auto`}
                  >
                    INTRODUKTION
                    <textarea
                      className={`${field} min-h-[82px] resize-y`}
                      value={game.summary}
                      onChange={(event) =>
                        updateGame({ summary: event.target.value })
                      }
                    />
                  </label>
                  <label
                    className={`${fieldLabel} col-span-full max-[980px]:col-auto`}
                  >
                    MEDDELANDE VID RÄTT SVAR
                    <textarea
                      className={`${field} min-h-[82px] resize-y`}
                      value={game.successMessage}
                      onChange={(event) =>
                        updateGame({ successMessage: event.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="grid gap-[22px]">
                  {game.challenges.map((challenge, challengeIndex) => (
                    <article
                      className="overflow-hidden border border-[#dedede] bg-white"
                      key={challenge.id}
                    >
                      <header className="flex items-center gap-[13px] border-t-[3px] border-t-[#d70000] border-b border-b-[#dedede] bg-[#fafafa] px-[18px] py-[15px] text-[#202020]">
                        <span className={`${barlow} text-[27px] text-[#d70000]`}>
                          {(challengeIndex + 1).toString().padStart(2, "0")}
                        </span>
                        <div className="grid min-w-0 gap-0.5">
                          <small className="text-[8px] tracking-[0.14em] text-[#777]">
                            UPPDRAG
                          </small>
                          <strong className="overflow-hidden text-[12px] text-ellipsis whitespace-nowrap max-[720px]:max-w-[70vw]">
                            {challenge.prompt}
                          </strong>
                        </div>
                      </header>
                      <label className={`${fieldLabel} px-5 pt-5`}>
                        FRÅGA / INSTRUKTION
                        <textarea
                          className={`${field} min-h-[88px] resize-y`}
                          value={challenge.prompt}
                          onChange={(event) =>
                            updateGame({
                              challenges: game.challenges.map((item) =>
                                item.id === challenge.id
                                  ? { ...item, prompt: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                      </label>
                      <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
                        <p className="text-[9px] font-extrabold tracking-[0.12em] text-[#555]">
                          SVARSALTERNATIV{" "}
                          <small className="ml-2 font-normal tracking-normal text-[#777] max-[420px]:mt-[5px] max-[420px]:ml-0 max-[420px]:block">
                            Markera det korrekta svaret.
                          </small>
                        </p>
                        {challenge.options.map((option, optionIndex) => (
                          <div
                            className="mt-[9px] grid grid-cols-[34px_minmax(0,1fr)_98px] items-start gap-[9px] max-[720px]:grid-cols-[34px_minmax(0,1fr)]"
                            key={option.id}
                          >
                            <span
                              className={`${barlow} grid min-h-[58px] w-[34px] place-items-center bg-[#ededed] font-bold text-[#555]`}
                            >
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <textarea
                              className={`${field} min-h-[58px] min-w-0 resize-y px-3 py-[10px] leading-[1.4]`}
                              rows={2}
                              aria-label={`Svar ${optionIndex + 1}`}
                              value={option.text}
                              onChange={(event) =>
                                updateGame({
                                  challenges: game.challenges.map((item) =>
                                    item.id === challenge.id
                                      ? {
                                          ...item,
                                          options: item.options.map(
                                            (candidate) =>
                                              candidate.id === option.id
                                                ? {
                                                    ...candidate,
                                                    text: event.target.value,
                                                  }
                                                : candidate,
                                          ),
                                        }
                                      : item,
                                  ),
                                })
                              }
                            />
                            <label className="flex min-h-[58px] cursor-pointer items-center gap-[6px] text-[10px] text-[#666] max-[720px]:col-start-2 max-[720px]:min-h-[31px] max-[720px]:px-0 max-[720px]:pt-0.5 max-[720px]:pb-2">
                              <input
                                className="peer absolute size-px opacity-0"
                                type="radio"
                                name={`correct-${challenge.id}`}
                                checked={option.isCorrect}
                                onChange={() =>
                                  updateGame({
                                    challenges: game.challenges.map((item) =>
                                      item.id === challenge.id
                                        ? {
                                            ...item,
                                            options: item.options.map(
                                              (candidate) => ({
                                                ...candidate,
                                                isCorrect:
                                                  candidate.id === option.id,
                                              }),
                                            ),
                                          }
                                        : item,
                                    ),
                                  })
                                }
                              />
                              <i className="grid size-[23px] place-items-center rounded-full border border-[#aaa] text-transparent peer-checked:border-[#23845e] peer-checked:bg-[#23845e] peer-checked:text-white">
                                <Check size={13} />
                              </i>
                              <span className="peer-checked:font-bold peer-checked:text-[#176b4c]">
                                Korrekt
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
