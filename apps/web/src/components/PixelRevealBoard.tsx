import { ScanSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { barlow, cx, focusRing } from "../uiStyles";

const pixelLevels = [0.03, 0.06, 0.12, 0.25, 0.5, 1] as const;

type PixelRevealBoardProps = {
  imagePath: string | null;
  revealCount: number;
  disabled: boolean;
  onReveal: () => void;
};

export function PixelRevealBoard({
  imagePath,
  revealCount,
  disabled,
  onReveal,
}: PixelRevealBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState(false);
  const fullyRevealed = revealCount >= pixelLevels.length - 1;

  useEffect(() => {
    if (!imagePath) return;
    const loadedImage = new Image();
    loadedImage.onload = () => {
      setImage(loadedImage);
      setImageError(false);
    };
    loadedImage.onerror = () => {
      setImage(null);
      setImageError(true);
    };
    loadedImage.src = imagePath;
    return () => {
      loadedImage.onload = null;
      loadedImage.onerror = null;
    };
  }, [imagePath]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    const scale = Math.min(600 / image.naturalWidth, 1);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const pixelSize = pixelLevels[Math.min(revealCount, pixelLevels.length - 1)];
    const smallWidth = Math.max(1, Math.ceil(canvas.width * pixelSize));
    const smallHeight = Math.max(1, Math.ceil(canvas.height * pixelSize));
    const smallCanvas = document.createElement("canvas");
    smallCanvas.width = smallWidth;
    smallCanvas.height = smallHeight;
    const smallContext = smallCanvas.getContext("2d");
    if (!smallContext) return;

    smallContext.drawImage(image, 0, 0, smallWidth, smallHeight);
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(smallCanvas, 0, 0, canvas.width, canvas.height);
  }, [image, revealCount]);

  return (
    <section className="mb-7 border border-[#dedede] bg-white p-[clamp(14px,2.5vw,24px)]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[9px] font-extrabold tracking-[0.15em] text-[#d70000] uppercase">
            PIXELJAKTEN · BILDEN
          </p>
          <p className="m-0 text-[12px] leading-[1.5] text-[#555]">
            Gissa direkt eller klicka på bilden för att skärpa den.
          </p>
        </div>
        <span className={`${barlow} text-[21px] font-bold text-[#c7352d] uppercase`}>
          {fullyRevealed ? "Helt skarp" : "+5 sek per klick"}
        </span>
      </div>

      {imagePath && !imageError ? (
        <button
          className={cx(
            `relative mx-auto block w-full max-w-[600px] overflow-hidden border-2 border-[#dedede] bg-[#f5f5f5] p-0 ${focusRing}`,
            !disabled && !fullyRevealed && "cursor-pointer hover:border-[#d70000]",
            (disabled || fullyRevealed) && "cursor-default",
          )}
          type="button"
          aria-label={fullyRevealed ? "Bilden är helt skarp" : "Skärp bilden och lägg till fem sekunder"}
          disabled={disabled || fullyRevealed || !image}
          onClick={onReveal}
        >
          <canvas
            ref={canvasRef}
            className="mx-auto block h-auto max-w-full"
            aria-label="Pixlad bild som ska identifieras"
            role="img"
          />
          {!fullyRevealed && (
            <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 bg-[#202020]/85 px-3 py-2 text-[10px] font-bold whitespace-nowrap text-white">
              <ScanSearch size={15} /> Klicka för att skärpa · +5 sek
            </span>
          )}
        </button>
      ) : (
        <p className="m-0 grid min-h-[180px] place-items-center bg-[#f5f5f5] p-5 text-center text-[12px] text-[#a32620]" role="alert">
          Bilden kunde inte laddas. Be en administratör kontrollera den.
        </p>
      )}

      <p className="mt-4 mb-0 text-[10px] font-bold tracking-[0.08em] text-[#777] uppercase">
        Skärpenivå {Math.min(revealCount, 5) + 1} av 6
      </p>
    </section>
  );
}
