import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { getAdminGameCopy } from "../../lib/gameCatalog";
import { barlow, cx, eyebrow, field, fieldLabel, focusRing, secondaryButton } from "../../uiStyles";
import { ChallengeImageEditor } from "./ChallengeImageEditor";
import { changeChallenge } from "./gameMutations";
import type { AdminGameTypeEditorProps, ChallengeFieldsComponent } from "./types";

type ChallengeListEditorProps = AdminGameTypeEditorProps & {
  Fields: ChallengeFieldsComponent;
  addDisabled?: boolean;
  addDisabledTitle?: string;
  pixelatedPreview?: boolean;
};

export function ChallengeListEditor({
  controller,
  game,
  Fields,
  addDisabled = false,
  addDisabledTitle,
  pixelatedPreview = false,
}: ChallengeListEditorProps) {
  const copy = getAdminGameCopy(game.type);
  const enabledCount = game.challenges.filter((challenge) => challenge.isEnabled).length;

  return (
    <>
      <div className="mb-[18px] flex items-end justify-between gap-5 border-b border-[#dedede] pb-[17px] max-[720px]:items-stretch">
        <div>
          <p className={`${eyebrow} mb-[5px]`}>{copy.listTitle}</p>
          <p className="m-0 text-[11px] text-[#686868]">{copy.listDescription}</p>
        </div>
        <button
          className={`${secondaryButton} shrink-0 max-[720px]:px-3`}
          type="button"
          onClick={() => void controller.addChallenge()}
          disabled={controller.mutating !== null || addDisabled}
          title={addDisabled ? addDisabledTitle : undefined}
        >
          <Plus size={17} /> {copy.addLabel}
        </button>
      </div>
      <div className="grid gap-[22px]">
        {game.challenges.map((challenge, challengeIndex) => {
          const isOpen = controller.openChallengeIds.has(challenge.id);
          const contentId = `challenge-content-${challenge.id}`;
          const canDeleteChallenge = game.challenges.some(
            (candidate) => candidate.id !== challenge.id && candidate.isEnabled,
          );
          const isOnlyEnabledChallenge = challenge.isEnabled && enabledCount === 1;

          return (
            <article
              className={cx(
                "overflow-hidden border border-[#dedede] bg-white",
                !challenge.isEnabled && "border-dashed bg-[#fafafa]",
              )}
              key={challenge.id}
            >
              <header className="flex items-center border-t-[3px] border-t-[#d70000] border-b border-b-[#dedede] bg-[#fafafa] text-[#202020]">
                <button
                  className={`flex min-w-0 flex-1 cursor-pointer items-center gap-[13px] border-0 bg-transparent px-[18px] py-[15px] text-left text-[#202020] ${focusRing}`}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => controller.toggleChallenge(challenge.id)}
                >
                  <span className={`${barlow} text-[27px] text-[#d70000]`}>
                    {(challengeIndex + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <small className="text-[8px] tracking-[0.14em] text-[#777]">{copy.itemLabel}</small>
                    <strong className="overflow-hidden text-[12px] text-ellipsis whitespace-nowrap">{challenge.prompt}</strong>
                  </span>
                  <ChevronDown
                    className={cx("size-[18px] shrink-0 text-[#777]", isOpen && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                {game.supportsChallengeActivation && (
                  <label
                    className="mr-2 inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 px-2 text-[9px] font-bold tracking-[0.08em] text-[#555] uppercase has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45"
                    title={isOnlyEnabledChallenge
                      ? "Spelet måste ha minst en aktiv fråga"
                      : challenge.isEnabled ? "Inaktivera frågan" : "Aktivera frågan"}
                  >
                    <input
                      className="peer absolute size-px opacity-0"
                      type="checkbox"
                      checked={challenge.isEnabled}
                      disabled={isOnlyEnabledChallenge || controller.mutating !== null}
                      onChange={(event) => controller.updateGame({
                        challenges: changeChallenge(game, challenge.id, (item) => ({
                          ...item,
                          isEnabled: event.target.checked,
                        })),
                      })}
                    />
                    <i className="relative h-[19px] w-[35px] rounded-full bg-[#aaa] after:absolute after:top-[3px] after:left-[3px] after:size-[13px] after:rounded-full after:bg-white after:transition-transform after:duration-150 after:content-[''] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgba(215,0,0,0.25)] peer-checked:bg-[#23845e] peer-checked:after:translate-x-4" />
                    <span className="max-[720px]:hidden">{challenge.isEnabled ? "Aktiv" : "Inaktiv"}</span>
                  </label>
                )}
                <button
                  className={`mr-[10px] inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-[6px] border border-[#c9c9c9] bg-white px-[10px] text-[9px] font-bold tracking-[0.08em] text-[#8f2424] uppercase disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                  type="button"
                  aria-label={`Ta bort uppdrag ${challengeIndex + 1}`}
                  title={!canDeleteChallenge ? "Spelet måste ha minst en aktiv fråga" : `Ta bort ${copy.definiteItem}`}
                  disabled={!canDeleteChallenge || controller.mutating !== null}
                  onClick={() => void controller.deleteChallenge(challenge.id)}
                >
                  <Trash2 size={14} />
                  <span className="max-[720px]:hidden">Ta bort</span>
                </button>
              </header>
              {isOpen && (
                <div id={contentId}>
                  <label className={`${fieldLabel} px-5 pt-5`}>
                    {copy.editorLabel}
                    <textarea
                      className={`${field} min-h-[88px] resize-y`}
                      value={challenge.prompt}
                      onChange={(event) => controller.updateGame({
                        challenges: changeChallenge(game, challenge.id, (item) => ({
                          ...item,
                          prompt: event.target.value,
                        })),
                      })}
                    />
                  </label>
                  <ChallengeImageEditor
                    controller={controller}
                    game={game}
                    challenge={challenge}
                    challengeIndex={challengeIndex}
                    pixelatedPreview={pixelatedPreview}
                  />
                  <Fields controller={controller} game={game} challenge={challenge} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
