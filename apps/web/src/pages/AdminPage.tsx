import {
  Check,
  ChevronDown,
  ChevronRight,
  Gamepad2,
  ImagePlus,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Trophy,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandHeader } from "../components/BrandHeader";
import { AdminAuditPanel } from "../components/AdminAuditPanel";
import { AdminGameList } from "../components/AdminGameList";
import { AdminGameSettings } from "../components/AdminGameSettings";
import { AdminMatchingEditor } from "../components/AdminMatchingEditor";
import { AdminResultsPanel } from "../components/AdminResultsPanel";
import { AdminSortingBoard } from "../components/AdminSortingBoard";
import { AdminWordAssemblyBoard } from "../components/AdminWordAssemblyBoard";
import { LoadingScreen } from "../components/LoadingScreen";
import { useAdminGameEditor } from "../hooks/useAdminGameEditor";
import { api } from "../lib/api";
import { barlow, cx, eyebrow, field, fieldLabel, focusRing, primaryButton, secondaryButton } from "../uiStyles";

const sidebarButton = `flex min-h-[45px] w-full cursor-pointer items-center gap-[11px] border-0 bg-transparent px-3 text-left text-[12px] text-[#777] disabled:cursor-not-allowed disabled:opacity-[0.42] [&>svg]:w-[17px] max-[980px]:justify-center max-[980px]:text-[0px] max-[980px]:[&>svg]:w-[19px] max-[720px]:min-h-[42px] max-[720px]:w-auto max-[720px]:justify-start max-[720px]:px-3 max-[720px]:text-[11px] max-[420px]:w-10 max-[420px]:justify-center max-[420px]:!px-0 max-[420px]:text-[0px] ${focusRing}`;

export function AdminPage() {
  const [activeView, setActiveView] = useState<"games" | "results" | "audit">("games");
  const navigate = useNavigate();
  const handleUnauthorized = useCallback(
    () => navigate("/admin/login", { replace: true }),
    [navigate],
  );
  const {
    games,
    game,
    status,
    saving,
    mutating,
    openChallengeIds,
    isMatching,
    isTrueFalse,
    isPixelHunt,
    isSorting,
    isWordAssembly,
    isHangman,
    canManageQuestions,
    gameCopy,
    selectGame,
    toggleChallenge,
    updateGame,
    save,
    addChallenge,
    deleteChallenge,
    addMatchingDestination,
    deleteMatchingDestination,
    addSortingCard,
    deleteSortingCard,
    addWordPart,
    deleteWordPart,
    uploadImage,
  } = useAdminGameEditor(handleUnauthorized);

  async function logout() {
    await api.logout();
    navigate("/admin/login");
  }
  if (!games) return <LoadingScreen label="Öppnar kontrollrummet…" />;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <BrandHeader mode="admin" />
      <div className="grid min-h-[calc(100vh-72px)] grid-cols-[230px_minmax(0,1fr)] max-[980px]:grid-cols-[78px_minmax(0,1fr)] max-[720px]:block max-[720px]:min-h-[calc(100vh-66px)]">
        <aside className="flex flex-col border-r border-[#dedede] bg-white px-[18px] py-7 text-[#202020] max-[980px]:px-[10px] max-[980px]:py-[25px] max-[720px]:min-h-[58px] max-[720px]:flex-row max-[720px]:items-center max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:px-[14px] max-[720px]:py-[7px]">
          <p className="m-0 px-3 pb-[13px] text-[9px] tracking-[0.18em] text-[#777] max-[980px]:text-[0px] max-[720px]:hidden">KONTROLLRUM</p>
          <nav className="grid gap-[5px] max-[720px]:flex">
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
            <button
              className={cx(
                sidebarButton,
                activeView === "audit" &&
                  "border-l-[3px] border-[#d70000] bg-[#f9eeee] pl-[9px] font-bold text-[#d70000] max-[980px]:p-0 max-[720px]:px-3",
              )}
              type="button"
              onClick={() => setActiveView("audit")}
            >
              <ShieldCheck /> Händelselogg
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
              onUnauthorized={handleUnauthorized}
            />
          ) : activeView === "audit" ? (
            <AdminAuditPanel
              onUnauthorized={handleUnauthorized}
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
            <AdminGameList
              games={games}
              selectedId={game?.id}
              onSelect={selectGame}
            />
            {game && (
              <section className="min-w-0 p-[30px] max-[720px]:px-[14px] max-[720px]:py-[22px]">
                <AdminGameSettings
                  game={game}
                  timeLabel={gameCopy.timeLabel}
                  onChange={updateGame}
                />
                {isMatching && game.challenges[0] && (
                  <AdminMatchingEditor
                    game={game}
                    disabled={mutating !== null || saving}
                    mutating={mutating}
                    onAddDestination={() => void addMatchingDestination()}
                    onAddScenario={() => void addChallenge()}
                    onUpdate={updateGame}
                    onUploadImage={(challengeId, image) => void uploadImage(challengeId, image)}
                    onDeleteScenario={(challengeId) => void deleteChallenge(challengeId)}
                    onDeleteDestination={(sortOrder) => void deleteMatchingDestination(sortOrder)}
                  />
                )}
                <div className={cx(
                  "mb-[18px] flex items-end justify-between gap-5 border-b border-[#dedede] pb-[17px] max-[720px]:items-stretch",
                  isMatching && "hidden",
                )}>
                  <div>
                    <p className={`${eyebrow} mb-[5px]`}>
                      {gameCopy.listTitle}
                    </p>
                    <p className="m-0 text-[11px] text-[#686868]">
                      {gameCopy.listDescription}
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
                      <Plus size={17} /> {gameCopy.addLabel}
                    </button>
                  )}
                </div>
                {!canManageQuestions && (
                  <p className="mb-[18px] border-l-[3px] border-[#d70000] bg-[#f9eeee] px-[14px] py-[11px] text-[11px] text-[#6b2424]">
                    Den här speltypen får stöd för eget innehåll i en kommande etapp.
                  </p>
                )}
                <div className={cx("grid gap-[22px]", isMatching && "hidden")}>
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
                              {gameCopy.itemLabel}
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
                            title={game.challenges.length <= 1 ? `Spelet måste ha minst ${gameCopy.minimumItem}` : `Ta bort ${gameCopy.definiteItem}`}
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
                        {gameCopy.editorLabel}
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
                      {!isHangman && <section className="mx-5 mt-4 grid grid-cols-[150px_minmax(0,1fr)] items-center gap-4 border border-[#dedede] bg-[#fafafa] p-3 max-[720px]:mx-3 max-[720px]:grid-cols-1">
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
                      </section>}
                      {isSorting ? (
                        <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
                          <div className="mb-4 flex items-center justify-between gap-4 border-l-[3px] border-[#d70000] bg-[#fffafa] px-4 py-3 max-[560px]:items-start">
                            <div>
                              <p className="m-0 text-[9px] font-extrabold tracking-[0.12em] text-[#a32620] uppercase">
                                KORT OCH MÅLOMRÅDEN
                              </p>
                              <p className="mt-1 mb-0 text-[10px] leading-[1.5] text-[#666]">
                                Dra korten mellan målområdena. Kort på startytan blir bluffkort som deltagaren ska lämna kvar. Klicka på ett områdesnamn för att ändra det.
                              </p>
                            </div>
                            <button
                              className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 border border-[#d70000] bg-white px-3 text-[9px] font-extrabold tracking-[0.07em] text-[#b00000] uppercase disabled:cursor-not-allowed disabled:opacity-50"
                              type="button"
                              disabled={mutating !== null || saving}
                              onClick={() => void addSortingCard(challenge.id)}
                            >
                              <Plus size={14} />
                              {mutating === `sorting-card-add-${challenge.id}` ? "Lägger till…" : "Lägg till kort"}
                            </button>
                          </div>
                          <AdminSortingBoard
                            options={challenge.options}
                            disabled={mutating !== null || saving}
                            onChangeText={(optionId, text) =>
                              updateGame({
                                challenges: game.challenges.map((item) =>
                                  item.id === challenge.id
                                    ? {
                                        ...item,
                                        options: item.options.map((option) =>
                                          option.id === optionId ? { ...option, text } : option,
                                        ),
                                      }
                                    : item,
                                ),
                              })
                            }
                            onMove={(optionId, sortingCategory) =>
                              updateGame({
                                challenges: game.challenges.map((item) =>
                                  item.id === challenge.id
                                    ? {
                                        ...item,
                                        options: item.options.map((option) =>
                                          option.id === optionId
                                            ? { ...option, sortingCategory }
                                            : option,
                                        ),
                                      }
                                    : item,
                                ),
                              })
                            }
                            onRenameCategory={(category, nextCategory) =>
                              updateGame({
                                challenges: game.challenges.map((item) =>
                                  item.id === challenge.id
                                    ? {
                                        ...item,
                                        options: item.options.map((option) =>
                                          option.sortingCategory === category
                                            ? { ...option, sortingCategory: nextCategory }
                                            : option,
                                        ),
                                      }
                                    : item,
                                ),
                              })
                            }
                            onDelete={(optionId) => void deleteSortingCard(challenge.id, optionId)}
                          />
                        </div>
                      ) : isWordAssembly ? (
                        <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
                          <AdminWordAssemblyBoard
                            options={challenge.options}
                            disabled={mutating !== null || saving}
                            mutating={mutating}
                            onChangeText={(optionId, text) =>
                              updateGame({
                                challenges: game.challenges.map((item) =>
                                  item.id === challenge.id
                                    ? {
                                        ...item,
                                        options: item.options.map((option) =>
                                          option.id === optionId ? { ...option, text } : option,
                                        ),
                                      }
                                    : item,
                                ),
                              })
                            }
                            onReorder={(optionIds) =>
                              updateGame({
                                challenges: game.challenges.map((item) =>
                                  item.id === challenge.id
                                    ? {
                                        ...item,
                                        options: item.options.map((option) => ({
                                          ...option,
                                          sortOrder: optionIds.indexOf(option.id) + 1,
                                        })),
                                      }
                                    : item,
                                ),
                              })
                            }
                            onAdd={() => void addWordPart(challenge.id)}
                            onDelete={(optionId) => void deleteWordPart(challenge.id, optionId)}
                          />
                        </div>
                      ) : isHangman ? (
                        <div className="p-5 max-[720px]:px-3 max-[720px]:py-4">
                          <div className="border-l-[3px] border-[#d70000] bg-[#fffafa] px-4 py-3">
                            <p className="m-0 text-[9px] font-extrabold tracking-[0.13em] text-[#a32620] uppercase">HEMLIGT ORD</p>
                            <p className="mt-1 mb-0 text-[10px] leading-[1.5] text-[#666]">
                              Ordet visas här för administratören, men skickas aldrig till spelarens webbläsare. Mellanslag och bindestreck är tillåtna.
                            </p>
                          </div>
                          <label className={`${fieldLabel} mt-4`}>
                            ORDET SOM SKA GISSAS
                            <input
                              className={`${field} ${barlow} text-[25px] font-bold tracking-[0.08em] uppercase`}
                              value={challenge.options[0]?.text ?? ""}
                              maxLength={40}
                              autoComplete="off"
                              spellCheck={false}
                              onChange={(event) => {
                                const text = event.target.value.toLocaleUpperCase("sv-SE");
                                updateGame({
                                  challenges: game.challenges.map((item) =>
                                    item.id === challenge.id
                                      ? {
                                          ...item,
                                          options: item.options.map((option, index) =>
                                            index === 0 ? { ...option, text, isCorrect: false } : option,
                                          ),
                                        }
                                      : item,
                                  ),
                                });
                              }}
                            />
                          </label>
                          <div className="mt-4 border border-[#dedede] bg-[#fafafa] px-4 py-5">
                            <p className="mt-0 mb-4 text-[8px] font-extrabold tracking-[0.15em] text-[#777] uppercase">FÖRHANDSVISNING AV BOKSTAVSPLATSER</p>
                            <div className="flex flex-wrap gap-x-2 gap-y-3">
                              {(challenge.options[0]?.text ?? "").split("").map((character, index) =>
                                character === " " ? (
                                  <span key={index} className="w-4" />
                                ) : (
                                  <span key={index} className={`${barlow} grid h-10 w-8 place-items-center border-b-2 border-[#555] text-[24px] font-bold text-[#202020] uppercase`}>
                                    {character === "-" ? "-" : character}
                                  </span>
                                ),
                              )}
                            </div>
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
