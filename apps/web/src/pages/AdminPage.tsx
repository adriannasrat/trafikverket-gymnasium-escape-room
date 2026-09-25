import {
  Check,
  ChevronDown,
  ChevronRight,
  Gamepad2,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Trophy,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandHeader } from "../components/BrandHeader";
import { AdminResultsPanel } from "../components/AdminResultsPanel";
import { LoadingScreen } from "../components/LoadingScreen";
import { ApiError, api } from "../lib/api";
import type { AdminGame } from "../types";
import { barlow, cx, eyebrow, field, fieldLabel, focusRing, primaryButton, secondaryButton } from "../uiStyles";

const sidebarButton = `flex min-h-[45px] w-full cursor-pointer items-center gap-[11px] border-0 bg-transparent px-3 text-left text-[12px] text-[#777] disabled:cursor-not-allowed disabled:opacity-[0.42] [&>svg]:w-[17px] max-[980px]:justify-center max-[980px]:text-[0px] max-[980px]:[&>svg]:w-[19px] max-[720px]:min-h-[42px] max-[720px]:w-auto max-[720px]:justify-start max-[720px]:px-3 max-[720px]:text-[11px] ${focusRing}`;

export function AdminPage() {
  const [activeView, setActiveView] = useState<"games" | "results">("games");
  const [games, setGames] = useState<AdminGame[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [mutating, setMutating] = useState<string | null>(null);
  const [openChallengeIds, setOpenChallengeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const navigate = useNavigate();
  const game =
    games?.find((candidate) => candidate.id === selectedId) ?? games?.[0];
  const isMatching = game?.type === "Matching";
  const isTrueFalse = game?.type === "TrueFalse";
  const isPixelHunt = game?.type === "PixelHunt";
  const isSorting = game?.type === "Sorting";
  const canManageQuestions = game?.type === "Quiz" || isMatching || isTrueFalse || isPixelHunt || isSorting;

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

  function toggleChallenge(challengeId: string) {
    setOpenChallengeIds((current) => {
      const next = new Set(current);
      if (next.has(challengeId)) next.delete(challengeId);
      else next.add(challengeId);
      return next;
    });
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

  async function addChallenge() {
    if (!game || !canManageQuestions) return;
    setMutating("add");
    setStatus("");
    try {
      const challenge = await api.createChallenge(game.id);
      updateGame({ challenges: [...game.challenges, challenge] });
      setOpenChallengeIds((current) => new Set(current).add(challenge.id));
      setStatus(`${isMatching ? "Ett nytt scenario" : isTrueFalse ? "Ett nytt påstående" : isPixelHunt ? "En ny bildfråga" : isSorting ? "En ny sorteringsrunda" : "En ny fråga"} har lagts till. Fyll i innehållet och spara ändringarna.`);
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Frågan kunde inte läggas till.",
      );
    } finally {
      setMutating(null);
    }
  }

  async function deleteChallenge(challengeId: string) {
    if (!game || !canManageQuestions || game.challenges.length <= 1) return;
    const challenge = game.challenges.find((item) => item.id === challengeId);
    if (!challenge) return;
    if (!window.confirm(`Ta bort ${isMatching ? "scenariot" : isTrueFalse ? "påståendet" : isPixelHunt ? "bildfrågan" : isSorting ? "sorteringsrundan" : "frågan"} ”${challenge.prompt}”?`)) return;

    setMutating(challengeId);
    setStatus("");
    try {
      await api.deleteChallenge(challengeId);
      updateGame({
        challenges: game.challenges
          .filter((item) => item.id !== challengeId)
          .map((item, index) => ({ ...item, sortOrder: index + 1 })),
      });
      setOpenChallengeIds((current) => {
        const next = new Set(current);
        next.delete(challengeId);
        return next;
      });
      setStatus(`${isMatching ? "Scenariot" : isTrueFalse ? "Påståendet" : isPixelHunt ? "Bildfrågan" : isSorting ? "Sorteringsrundan" : "Frågan"} har tagits bort från spelet.`);
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : "Frågan kunde inte tas bort.",
      );
    } finally {
      setMutating(null);
    }
  }

  async function addMatchingDestination() {
    if (!game || !isMatching) return;
    setMutating("add-destination");
    setStatus("");
    try {
      const result = await api.addMatchingDestination(game.id);
      const optionsByChallenge = new Map(
        result.options.map((option) => [option.challengeId, option]),
      );
      updateGame({
        challenges: game.challenges.map((challenge) => {
          const option = optionsByChallenge.get(challenge.id);
          return option
            ? { ...challenge, options: [...challenge.options, option] }
            : challenge;
        }),
      });
      setStatus("En ny riskzon har lagts till. Ge den ett namn och spara ändringarna.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Riskzonen kunde inte läggas till.");
    } finally {
      setMutating(null);
    }
  }

  async function deleteMatchingDestination(sortOrder: number) {
    if (!game || !isMatching) return;
    const destination = game.challenges[0]?.options.find(
      (option) => option.sortOrder === sortOrder,
    );
    if (!destination || !window.confirm(`Ta bort riskzonen ”${destination.text}”?`)) return;

    setMutating(`destination-${sortOrder}`);
    setStatus("");
    try {
      await api.deleteMatchingDestination(game.id, sortOrder);
      updateGame({
        challenges: game.challenges.map((challenge) => ({
          ...challenge,
          options: challenge.options
            .filter((option) => option.sortOrder !== sortOrder)
            .map((option) => ({
              ...option,
              sortOrder: option.sortOrder > sortOrder
                ? option.sortOrder - 1
                : option.sortOrder,
            })),
        })),
      });
      setStatus("Riskzonen har tagits bort.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Riskzonen kunde inte tas bort.");
    } finally {
      setMutating(null);
    }
  }

  async function logout() {
    await api.logout();
    navigate("/admin/login");
  }
  async function uploadImage(challengeId: string, image?: File) {
    if (!game || !image) return;
    setMutating(`image-${challengeId}`);
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
    } finally {
      setMutating(null);
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
            <button
              className={cx(
                sidebarButton,
                activeView === "games" &&
                  "border-l-[3px] border-[#d70000] bg-[#f9eeee] pl-[9px] font-bold text-[#d70000] max-[980px]:p-0 max-[720px]:px-3",
              )}
              type="button"
              onClick={() => setActiveView("games")}
            >
              <Gamepad2 /> Uppdrag <ChevronRight className="ml-auto w-[13px] max-[980px]:hidden" />
            </button>
            <button
              className={cx(
                sidebarButton,
                activeView === "results" &&
                  "border-l-[3px] border-[#d70000] bg-[#f9eeee] pl-[9px] font-bold text-[#d70000] max-[980px]:p-0 max-[720px]:px-3",
              )}
              type="button"
              onClick={() => setActiveView("results")}
            >
              <Trophy /> Spelresultat <ChevronRight className="ml-auto w-[13px] max-[980px]:hidden" />
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
          {activeView === "results" ? (
            <AdminResultsPanel
              onUnauthorized={() => navigate("/admin/login", { replace: true })}
            />
          ) : (
          <>
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
                  onClick={() => {
                    setSelectedId(candidate.id);
                    setOpenChallengeIds(new Set());
                  }}
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
                    {isMatching ? "TID FÖR MATCHNING (SEK)" : isPixelHunt ? "TID PER BILD (SEK)" : isSorting ? "TID PER SORTERING (SEK)" : "TID PER UPPDRAG (SEK)"}
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
                {isMatching && game.challenges[0] && (
                  <section className="mb-[30px] border border-[#dedede] bg-[#fafafa] p-5 max-[720px]:p-4">
                    <div className="mb-4 flex items-end justify-between gap-5 max-[720px]:items-stretch">
                      <div>
                        <p className={`${eyebrow} mb-[5px]`}>RISKZONER</p>
                        <p className="m-0 text-[11px] text-[#686868]">
                          Dessa platser visas på matchningsbrädets högra sida.
                        </p>
                      </div>
                      <button
                        className={`${secondaryButton} shrink-0 max-[720px]:px-3`}
                        type="button"
                        onClick={addMatchingDestination}
                        disabled={
                          mutating !== null ||
                          saving ||
                          game.challenges[0].options.length >= 6
                        }
                      >
                        <Plus size={17} /> Lägg till riskzon
                      </button>
                    </div>
                    <div className="grid gap-2">
                      {game.challenges[0].options.map((destination, index) => {
                        const isCorrectForScenario = game.challenges.some(
                          (challenge) => challenge.options.some(
                            (option) => option.sortOrder === destination.sortOrder && option.isCorrect,
                          ),
                        );
                        return (
                          <div
                            className="grid grid-cols-[34px_minmax(0,1fr)_42px] items-center gap-2"
                            key={destination.id}
                          >
                            <span className={`${barlow} grid size-[34px] place-items-center bg-[#f9eeee] text-[17px] font-bold text-[#d70000]`}>
                              {index + 1}
                            </span>
                            <input
                              className={field}
                              aria-label={`Riskzon ${index + 1}`}
                              value={destination.text}
                              onChange={(event) =>
                                updateGame({
                                  challenges: game.challenges.map((challenge) => ({
                                    ...challenge,
                                    options: challenge.options.map((option) =>
                                      option.sortOrder === destination.sortOrder
                                        ? { ...option, text: event.target.value }
                                        : option,
                                    ),
                                  })),
                                })
                              }
                            />
                            <button
                              className={`grid size-[42px] place-items-center border border-[#c9c9c9] bg-white text-[#8f2424] disabled:cursor-not-allowed disabled:opacity-35 ${focusRing}`}
                              type="button"
                              aria-label={`Ta bort riskzonen ${destination.text}`}
                              title={
                                game.challenges[0].options.length <= 2
                                  ? "Spelet måste ha minst två riskzoner"
                                  : game.challenges[0].options.length <= game.challenges.length
                                    ? "Spelet behöver minst lika många riskzoner som scenarier"
                                  : isCorrectForScenario
                                    ? "Byt rätt riskzon för berörda scenarier först"
                                    : "Ta bort riskzonen"
                              }
                              disabled={
                                game.challenges[0].options.length <= 2 ||
                                game.challenges[0].options.length <= game.challenges.length ||
                                isCorrectForScenario ||
                                mutating !== null ||
                                saving
                              }
                              onClick={() => deleteMatchingDestination(destination.sortOrder)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
                <div className="mb-[18px] flex items-end justify-between gap-5 border-b border-[#dedede] pb-[17px] max-[720px]:items-stretch">
                  <div>
                    <p className={`${eyebrow} mb-[5px]`}>
                      {isMatching
                        ? "SCENARIER I SPELET"
                        : isTrueFalse
                          ? "PÅSTÅENDEN I SPELET"
                          : isPixelHunt
                            ? "BILDER I SPELET"
                            : isSorting
                              ? "SORTERINGSRUNDOR I SPELET"
                          : "FRÅGOR I SPELET"}
                    </p>
                    <p className="m-0 text-[11px] text-[#686868]">
                      {isMatching
                        ? "Varje scenario kopplas till exakt en av riskzonerna ovan."
                        : isTrueFalse
                          ? "Deltagaren avgör om varje påstående är sant eller falskt."
                          : isPixelHunt
                            ? "Bilden visas pixlad. Varje klick gör den skarpare men lägger till 5 sekunder på totaltiden."
                            : isSorting
                              ? "Varje kort kopplas till ett område. Kort utan målkategori ska lämnas kvar som bluffkort."
                          : "Lägg till textfrågor eller använd en bild som deltagaren ska tolka."}
                    </p>
                  </div>
                  {canManageQuestions && (
                    <button
                      className={`${secondaryButton} shrink-0 max-[720px]:px-3`}
                      type="button"
                      onClick={addChallenge}
                      disabled={
                        mutating !== null ||
                        saving ||
                        Boolean(
                          isMatching &&
                          game.challenges.length >= (game.challenges[0]?.options.length ?? 0),
                        )
                      }
                      title={
                        isMatching && game.challenges.length >= (game.challenges[0]?.options.length ?? 0)
                          ? "Lägg till en riskzon först"
                          : undefined
                      }
                    >
                      <Plus size={17} /> {isMatching ? "Lägg till scenario" : isTrueFalse ? "Lägg till påstående" : isPixelHunt ? "Lägg till bildfråga" : isSorting ? "Lägg till sortering" : "Lägg till fråga"}
                    </button>
                  )}
                </div>
                {!canManageQuestions && (
                  <p className="mb-[18px] border-l-[3px] border-[#d70000] bg-[#f9eeee] px-[14px] py-[11px] text-[11px] text-[#6b2424]">
                    Den här speltypen får stöd för eget innehåll i en kommande etapp.
                  </p>
                )}
                <div className="grid gap-[22px]">
                  {game.challenges.map((challenge, challengeIndex) => {
                    const isOpen = openChallengeIds.has(challenge.id);
                    const contentId = `challenge-content-${challenge.id}`;
                    return (
                    <article
                      className="overflow-hidden border border-[#dedede] bg-white"
                      key={challenge.id}
                    >
                      <header className="flex items-center border-t-[3px] border-t-[#d70000] border-b border-b-[#dedede] bg-[#fafafa] text-[#202020]">
                        <button
                          className={`flex min-w-0 flex-1 cursor-pointer items-center gap-[13px] border-0 bg-transparent px-[18px] py-[15px] text-left text-[#202020] ${focusRing}`}
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={contentId}
                          onClick={() => toggleChallenge(challenge.id)}
                        >
                          <span className={`${barlow} text-[27px] text-[#d70000]`}>
                            {(challengeIndex + 1).toString().padStart(2, "0")}
                          </span>
                          <span className="grid min-w-0 flex-1 gap-0.5">
                            <small className="text-[8px] tracking-[0.14em] text-[#777]">
                              {isMatching ? "SCENARIO" : isTrueFalse ? "PÅSTÅENDE" : isPixelHunt ? "BILDFRÅGA" : isSorting ? "SORTERING" : "UPPDRAG"}
                            </small>
                            <strong className="overflow-hidden text-[12px] text-ellipsis whitespace-nowrap">
                              {challenge.prompt}
                            </strong>
                          </span>
                          <ChevronDown
                            className={cx(
                              "size-[18px] shrink-0 text-[#777]",
                              isOpen && "rotate-180",
                            )}
                            aria-hidden="true"
                          />
                        </button>
                        {canManageQuestions && (
                          <button
                            className={`mr-[10px] inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-[6px] border border-[#c9c9c9] bg-white px-[10px] text-[9px] font-bold tracking-[0.08em] text-[#8f2424] uppercase disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                            type="button"
                            aria-label={`Ta bort uppdrag ${challengeIndex + 1}`}
                            title={game.challenges.length <= 1 ? `Spelet måste ha minst ${isMatching ? "ett scenario" : isTrueFalse ? "ett påstående" : isPixelHunt ? "en bildfråga" : isSorting ? "en sorteringsrunda" : "en fråga"}` : `Ta bort ${isMatching ? "scenariot" : isTrueFalse ? "påståendet" : isPixelHunt ? "bildfrågan" : isSorting ? "sorteringsrundan" : "frågan"}`}
                            disabled={game.challenges.length <= 1 || mutating !== null || saving}
                            onClick={() => deleteChallenge(challenge.id)}
                          >
                            <Trash2 size={14} />
                            <span className="max-[720px]:hidden">Ta bort</span>
                          </button>
                        )}
                      </header>
                      {isOpen && (
                      <div id={contentId}>
                      <label className={`${fieldLabel} px-5 pt-5`}>
                        {isMatching ? "SCENARIO / HÄNDELSE" : isTrueFalse ? "PÅSTÅENDE" : isPixelHunt ? "FRÅGA OM BILDEN" : isSorting ? "INSTRUKTION TILL SORTERINGEN" : "FRÅGA / INSTRUKTION"}
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
                      <section className="mx-5 mt-4 grid grid-cols-[150px_minmax(0,1fr)] items-center gap-4 border border-[#dedede] bg-[#fafafa] p-3 max-[720px]:mx-3 max-[720px]:grid-cols-1">
                        {challenge.imagePath ? (
                          <img
                            className="h-[105px] w-full bg-white object-contain p-1"
                            src={challenge.imagePath}
                            alt={`Bild för uppdrag ${challengeIndex + 1}`}
                          />
                        ) : (
                          <span className="grid h-[105px] place-items-center gap-1 bg-white text-center text-[9px] text-[#777]">
                            <ImagePlus size={25} /> Ingen bild vald
                          </span>
                        )}
                        <div className="grid justify-items-start gap-2">
                          <div>
                            <p className="m-0 text-[9px] font-extrabold tracking-[0.12em] text-[#555]">
                              BILD TILL {isMatching ? "SCENARIOT" : "FRÅGAN"} {!isPixelHunt && <span className="font-normal tracking-normal text-[#777]">(VALFRI)</span>}
                            </p>
                            <p className="mt-1 mb-0 text-[10px] leading-[1.5] text-[#777]">
                              JPG, PNG eller WebP · högst 5 MB. {isPixelHunt ? "Förhandsvisningen är skarp; deltagaren ser den pixlad." : "Hela bilden visas utan beskärning."}
                            </p>
                          </div>
                          {canManageQuestions && (
                            <label className={`inline-flex min-h-9 cursor-pointer items-center gap-[7px] border border-[#777] bg-white px-[11px] text-[9px] font-extrabold tracking-[0.06em] text-[#202020] uppercase focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[rgba(215,0,0,0.25)]`}>
                              <ImagePlus size={15} />
                              {mutating === `image-${challenge.id}`
                                ? "Laddar upp…"
                                : challenge.imagePath
                                  ? "Byt bild"
                                  : "Ladda upp bild"}
                              <input
                                className="absolute size-px opacity-0"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                disabled={mutating !== null || saving}
                                onChange={(event) => {
                                  const image = event.target.files?.[0];
                                  event.target.value = "";
                                  void uploadImage(challenge.id, image);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </section>
                      {isSorting ? (
                        <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
                          <div className="mb-4 border-l-[3px] border-[#d70000] bg-[#fffafa] px-4 py-3">
                            <p className="m-0 text-[9px] font-extrabold tracking-[0.12em] text-[#a32620] uppercase">
                              KORT OCH MÅLOMRÅDEN
                            </p>
                            <p className="mt-1 mb-0 text-[10px] leading-[1.5] text-[#666]">
                              Skriv samma områdesnamn på kort som hör ihop. Lämna målet tomt för bluffkort som ska ligga kvar på startytan.
                            </p>
                          </div>
                          <datalist id={`sorting-categories-${challenge.id}`}>
                            {[...new Set(challenge.options
                              .map((option) => option.sortingCategory)
                              .filter((category): category is string => Boolean(category)))]
                              .map((category) => <option key={category} value={category} />)}
                          </datalist>
                          <div className="grid gap-3">
                            {challenge.options.map((option, optionIndex) => (
                              <div
                                className="grid grid-cols-[54px_minmax(0,1fr)_minmax(150px,0.65fr)] items-end gap-3 border border-[#dedede] bg-[#fafafa] p-3 max-[720px]:grid-cols-[42px_minmax(0,1fr)]"
                                key={option.id}
                              >
                                <span className={`${barlow} grid min-h-[58px] place-items-center bg-[#ededed] text-[19px] font-bold text-[#555]`}>
                                  {(optionIndex + 1).toString().padStart(2, "0")}
                                </span>
                                <label className={fieldLabel}>
                                  KORTTEXT
                                  <input
                                    className={field}
                                    value={option.text}
                                    onChange={(event) =>
                                      updateGame({
                                        challenges: game.challenges.map((item) =>
                                          item.id === challenge.id
                                            ? {
                                                ...item,
                                                options: item.options.map((candidate) =>
                                                  candidate.id === option.id
                                                    ? { ...candidate, text: event.target.value }
                                                    : candidate,
                                                ),
                                              }
                                            : item,
                                        ),
                                      })
                                    }
                                  />
                                </label>
                                <label className={`${fieldLabel} max-[720px]:col-start-2`}>
                                  MÅLOMRÅDE
                                  <input
                                    className={field}
                                    list={`sorting-categories-${challenge.id}`}
                                    value={option.sortingCategory ?? ""}
                                    placeholder="Lämnas kvar"
                                    onChange={(event) =>
                                      updateGame({
                                        challenges: game.challenges.map((item) =>
                                          item.id === challenge.id
                                            ? {
                                                ...item,
                                                options: item.options.map((candidate) =>
                                                  candidate.id === option.id
                                                    ? {
                                                        ...candidate,
                                                        sortingCategory: event.target.value || null,
                                                      }
                                                    : candidate,
                                                ),
                                              }
                                            : item,
                                        ),
                                      })
                                    }
                                  />
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : isMatching ? (
                        <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
                          <label className={fieldLabel}>
                            RÄTT RISKZON
                            <select
                              className={field}
                              value={challenge.options.find((option) => option.isCorrect)?.id ?? ""}
                              onChange={(event) =>
                                updateGame({
                                  challenges: game.challenges.map((item) =>
                                    item.id === challenge.id
                                      ? {
                                          ...item,
                                          options: item.options.map((option) => ({
                                            ...option,
                                            isCorrect: option.id === event.target.value,
                                          })),
                                        }
                                      : item,
                                  ),
                                })
                              }
                            >
                              {challenge.options.map((option) => (
                                <option
                                  key={option.id}
                                  value={option.id}
                                  disabled={game.challenges.some(
                                    (item) =>
                                      item.id !== challenge.id &&
                                      item.options.some(
                                        (candidate) =>
                                          candidate.sortOrder === option.sortOrder &&
                                          candidate.isCorrect,
                                      ),
                                  )}
                                >
                                  {option.text}
                                </option>
                              ))}
                            </select>
                          </label>
                          <p className="mt-2 mb-0 text-[10px] leading-[1.5] text-[#777]">
                            Spelaren kopplar scenariot till denna riskzon. Rätt svar skickas aldrig till spelarvyn.
                          </p>
                        </div>
                      ) : isTrueFalse ? (
                      <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
                        <p className="mb-3 text-[9px] font-extrabold tracking-[0.12em] text-[#555]">
                          RÄTT SVAR{" "}
                          <small className="ml-2 font-normal tracking-normal text-[#777]">
                            Välj om påståendet är sant eller falskt.
                          </small>
                        </p>
                        <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
                          {challenge.options.map((option) => (
                            <label
                              className={cx(
                                `grid min-h-[74px] cursor-pointer grid-cols-[28px_minmax(0,1fr)] items-center gap-3 border bg-white p-4 ${focusRing}`,
                                option.isCorrect
                                  ? "border-[#23845e] bg-[#f3faf6] text-[#176b4c]"
                                  : "border-[#cfcfcf] text-[#555] hover:border-[#888]",
                              )}
                              key={option.id}
                            >
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
                                                isCorrect: candidate.id === option.id,
                                              }),
                                            ),
                                          }
                                        : item,
                                    ),
                                  })
                                }
                              />
                              <i className="grid size-7 place-items-center rounded-full border border-[#aaa] text-transparent peer-checked:border-[#23845e] peer-checked:bg-[#23845e] peer-checked:text-white">
                                <Check size={15} />
                              </i>
                              <span className={`${barlow} text-[23px] font-bold uppercase`}>
                                {option.text}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                      ) : (
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
                      )}
                      </div>
                      )}
                    </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
          </>
          )}
        </main>
      </div>
    </div>
  );
}
