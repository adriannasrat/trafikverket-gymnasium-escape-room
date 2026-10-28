import { ChevronRight, Gamepad2, HardDrive, LogOut, ShieldCheck, Trophy } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AdminAuditPanel } from "../components/AdminAuditPanel";
import { AdminImageCleanupPanel } from "../components/AdminImageCleanupPanel";
import { BrandHeader } from "../components/BrandHeader";
import { LoadingScreen } from "../components/LoadingScreen";
import { AdminResultsPanel } from "../components/AdminResultsPanel";
import { AdminGamesView } from "../features/admin-game-editors/AdminGamesView";
import { useAdminGameEditor } from "../hooks/useAdminGameEditor";
import { api } from "../lib/api";
import { cx, focusRing } from "../uiStyles";

const sidebarButton = `flex min-h-[45px] w-full cursor-pointer items-center gap-[11px] border-0 bg-transparent px-3 text-left text-[12px] text-[#777] disabled:cursor-not-allowed disabled:opacity-[0.42] [&>svg]:w-[17px] max-[980px]:justify-center max-[980px]:text-[0px] max-[980px]:[&>svg]:w-[19px] max-[720px]:min-h-[42px] max-[720px]:w-auto max-[720px]:justify-start max-[720px]:px-3 max-[720px]:text-[11px] max-[420px]:w-10 max-[420px]:justify-center max-[420px]:!px-0 max-[420px]:text-[0px] ${focusRing}`;

type AdminView = "games" | "results" | "images" | "audit";

export function AdminPage() {
  const [activeView, setActiveView] = useState<AdminView>("games");
  const navigate = useNavigate();
  const handleUnauthorized = useCallback(
    () => navigate("/admin/login", { replace: true }),
    [navigate],
  );
  const controller = useAdminGameEditor(handleUnauthorized);

  async function logout() {
    if (!(await controller.flushPendingSaves())) return;
    await api.logout();
    navigate("/admin/login");
  }

  if (!controller.games) return <LoadingScreen label="Öppnar kontrollrummet…" />;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <BrandHeader mode="admin" />
      <div className="grid min-h-[calc(100vh-72px)] grid-cols-[230px_minmax(0,1fr)] max-[980px]:grid-cols-[78px_minmax(0,1fr)] max-[720px]:block max-[720px]:min-h-[calc(100vh-66px)]">
        <aside className="flex flex-col border-r border-[#dedede] bg-white px-[18px] py-7 text-[#202020] max-[980px]:px-[10px] max-[980px]:py-[25px] max-[720px]:min-h-[58px] max-[720px]:flex-row max-[720px]:items-center max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:px-[14px] max-[720px]:py-[7px]">
          <p className="m-0 px-3 pb-[13px] text-[9px] tracking-[0.18em] text-[#777] max-[980px]:text-[0px] max-[720px]:hidden">KONTROLLRUM</p>
          <nav className="grid gap-[5px] max-[720px]:flex">
            <SidebarButton active={activeView === "games"} onClick={() => setActiveView("games")}>
              <Gamepad2 /> Uppdrag <ChevronRight className="ml-auto w-[13px] max-[980px]:hidden" />
            </SidebarButton>
            <SidebarButton active={activeView === "results"} onClick={() => setActiveView("results")}>
              <Trophy /> Spelresultat <ChevronRight className="ml-auto w-[13px] max-[980px]:hidden" />
            </SidebarButton>
            <SidebarButton active={activeView === "audit"} onClick={() => setActiveView("audit")}>
              <ShieldCheck /> Händelselogg
            </SidebarButton>
            <SidebarButton active={activeView === "images"} onClick={() => setActiveView("images")}>
              <HardDrive /> Bildlagring
            </SidebarButton>
          </nav>
          <div className="mt-auto border-t border-[#dedede] pt-[18px] max-[720px]:ml-auto max-[720px]:mt-0 max-[720px]:border-0 max-[720px]:p-0">
            <span className="flex items-center gap-[7px] px-3 pb-[10px] text-[8px] tracking-[0.12em] text-[#23845e] max-[980px]:hidden">
              <i className="size-[7px] rounded-full bg-[#23845e] shadow-[0_0_0_4px_rgba(35,132,94,0.1)]" /> SYSTEM ONLINE
            </span>
            <button
              className={sidebarButton}
              type="button"
              onClick={() => void logout()}
              disabled={controller.mutating !== null}
            >
              <LogOut /> Logga ut
            </button>
          </div>
        </aside>
        <main className="min-w-0 px-[clamp(24px,4vw,60px)] pt-[38px] pb-[65px] max-[720px]:px-[14px] max-[720px]:pt-[30px] max-[720px]:pb-[45px]">
          {activeView === "results" ? (
            <AdminResultsPanel onUnauthorized={handleUnauthorized} />
          ) : activeView === "images" ? (
            <AdminImageCleanupPanel onUnauthorized={handleUnauthorized} />
          ) : activeView === "audit" ? (
            <AdminAuditPanel onUnauthorized={handleUnauthorized} />
          ) : (
            <AdminGamesView controller={controller} />
          )}
        </main>
      </div>
    </div>
  );
}

function SidebarButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={cx(
        sidebarButton,
        active && "border-l-[3px] border-[#d70000] bg-[#f9eeee] pl-[9px] font-bold text-[#d70000] max-[980px]:p-0 max-[720px]:px-3",
      )}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
