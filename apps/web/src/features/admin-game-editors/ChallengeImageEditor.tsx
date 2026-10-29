import { ImagePlus, Trash2 } from "lucide-react";
import type { AdminGameTypeEditorProps } from "./types";
import type { AdminChallenge } from "../../types";
import { focusRing } from "../../uiStyles";

type ChallengeImageEditorProps = AdminGameTypeEditorProps & {
  challenge: AdminChallenge;
  challengeIndex: number;
  pixelatedPreview: boolean;
};

export function ChallengeImageEditor({
  controller,
  game,
  challenge,
  challengeIndex,
  pixelatedPreview,
}: ChallengeImageEditorProps) {
  if (!game.supportsChallengeImages) return null;

  return (
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
            BILD TILL FRÅGAN {!game.requiresChallengeImages && (
              <span className="font-normal tracking-normal text-[#777]">(VALFRI)</span>
            )}
          </p>
          <p className="mt-1 mb-0 text-[10px] leading-[1.5] text-[#777]">
            JPG, PNG eller WebP · högst 5 MB. {pixelatedPreview
              ? "Förhandsvisningen är skarp; deltagaren ser den pixlad."
              : "Hela bilden visas utan beskärning."}
          </p>
        </div>
        {game.allowsChallengeImageUploads ? (
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-[7px] border border-[#777] bg-white px-[11px] text-[9px] font-extrabold tracking-[0.06em] text-[#202020] uppercase focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[rgba(215,0,0,0.25)]">
              <ImagePlus size={15} />
              {controller.mutating === `image-${challenge.id}`
                ? "Arbetar…"
                : challenge.imagePath
                  ? "Byt bild"
                  : "Ladda upp bild"}
              <input
                className="absolute size-px opacity-0"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={controller.mutating !== null}
                onChange={(event) => {
                  const image = event.target.files?.[0];
                  event.target.value = "";
                  void controller.uploadImage(challenge.id, image);
                }}
              />
            </label>
            {challenge.imagePath && (
              <button
                className={`inline-flex min-h-9 items-center gap-[7px] border border-[#bd4b45] bg-white px-[11px] text-[9px] font-extrabold tracking-[0.06em] text-[#9f302b] uppercase hover:bg-[#fff0ef] disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
                type="button"
                disabled={controller.mutating !== null}
                onClick={() => void controller.removeImage(challenge.id)}
              >
                <Trash2 size={14} /> Ta bort bild
              </button>
            )}
          </div>
        ) : (
          <p className="m-0 border-l-[3px] border-[#d70000] bg-[#fff4f3] px-3 py-2 text-[9px] leading-[1.5] font-bold text-[#8f211c]">
            Demoläge: Bildbyte är avstängt i onlineversionen. De permanenta bilderna fortsätter att användas.
          </p>
        )}
      </div>
    </section>
  );
}
