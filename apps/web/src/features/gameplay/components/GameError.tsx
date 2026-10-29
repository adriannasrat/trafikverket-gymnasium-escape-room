import { Link } from "react-router-dom";
import { barlow, focusRing, primaryButton } from "../../../uiStyles";

export function GameError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-5 text-center text-[#666]">
      <h1 className={`${barlow} text-[#202020] uppercase`}>Kontakten bröts</h1>
      <p className="max-w-[480px]">{message} Kontrollera anslutningen och försök igen.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-4">
        <button className={primaryButton} type="button" onClick={onRetry}>
          Försök igen
        </button>
        <Link className={`inline-flex min-h-12 items-center font-bold text-[#d70000] ${focusRing}`} to="/">
          Till startsidan
        </Link>
      </div>
    </main>
  );
}
