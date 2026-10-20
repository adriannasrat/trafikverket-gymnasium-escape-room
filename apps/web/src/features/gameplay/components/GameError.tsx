import { Link } from "react-router-dom";
import { barlow, focusRing } from "../../../uiStyles";

export function GameError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white text-[#666]">
      <h1 className={`${barlow} text-[#202020] uppercase`}>Kontakten bröts</h1>
      <p>{message}</p>
      <Link className={`font-bold text-[#d70000] ${focusRing}`} to="/">Till startsidan</Link>
    </div>
  );
}
