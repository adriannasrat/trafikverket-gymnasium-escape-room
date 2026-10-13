import type { AdminGame } from "../types";
import { barlow, eyebrow, field, fieldLabel } from "../uiStyles";

type AdminGameSettingsProps = {
  game: AdminGame;
  timeLabel: string;
  onChange: (change: Partial<AdminGame>) => void;
};

export function AdminGameSettings({ game, timeLabel, onChange }: AdminGameSettingsProps) {
  return (
    <>
      <div className="flex justify-between gap-5 border-b border-[#dedede] pb-5 max-[720px]:flex-col max-[720px]:items-start">
        <div>
          <p className={eyebrow}>SPELINSTÄLLNINGAR</p>
          <h2 className={`${barlow} text-[33px] text-[#202020] uppercase`}>
            {game.title}
          </h2>
        </div>
        <label className="flex items-center gap-[10px] text-[11px] font-bold text-[#555]">
          <span>{game.isActive ? "Aktivt" : "Pausat"}</span>
          <input
            className="peer absolute size-px opacity-0"
            type="checkbox"
            checked={game.isActive}
            onChange={(event) => onChange({ isActive: event.target.checked })}
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
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <label className={fieldLabel}>
          {timeLabel}
          <input
            className={field}
            type="number"
            min="5"
            max="900"
            value={game.defaultTimeLimitSeconds}
            onChange={(event) => onChange({
              defaultTimeLimitSeconds: Number(event.target.value),
            })}
          />
        </label>
        <label className={`${fieldLabel} col-span-full max-[980px]:col-auto`}>
          INTRODUKTION
          <textarea
            className={`${field} min-h-[82px] resize-y`}
            value={game.summary}
            onChange={(event) => onChange({ summary: event.target.value })}
          />
        </label>
        <label className={`${fieldLabel} col-span-full max-[980px]:col-auto`}>
          MEDDELANDE VID RÄTT SVAR
          <textarea
            className={`${field} min-h-[82px] resize-y`}
            value={game.successMessage}
            onChange={(event) => onChange({ successMessage: event.target.value })}
          />
        </label>
      </div>
    </>
  );
}
