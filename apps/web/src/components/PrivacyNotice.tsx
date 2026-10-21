import { ShieldCheck } from "lucide-react";
import type { ExperienceMode } from "../types";

type PrivacyNoticeProps = {
  id?: string;
  mode: ExperienceMode;
  retentionDays: number;
  compact?: boolean;
};

export function PrivacyNotice({
  id,
  mode,
  retentionDays,
  compact = false,
}: PrivacyNoticeProps) {
  return (
    <aside
      className={`flex gap-3 border-l-[3px] border-[#d70000] bg-[#faf5f5] text-left text-[#555] ${compact ? "px-4 py-3 text-[11px] leading-[1.55]" : "px-[15px] py-[13px] text-[12px] leading-[1.6]"}`}
      id={id}
      aria-label="Information om sparade speluppgifter"
    >
      <ShieldCheck className="mt-0.5 shrink-0 text-[#d70000]" size={18} aria-hidden="true" />
      <p className="m-0">
        Använd ett smeknamn, inte ditt fullständiga namn. Smeknamn, speltid och
        registrerade svar sparas för att genomföra spelet och skapa topplistan.
        Uppgifterna sparas i {retentionDays} dagar och raderas sedan automatiskt. Endast
        smeknamn och sluttid visas offentligt i topplistan för {mode === "Demo" ? "demo" : "event"}.
      </p>
    </aside>
  );
}
