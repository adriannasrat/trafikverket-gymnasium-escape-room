import {
  CloudRain,
  Link2,
  MapPin,
  School,
  ShieldCheck,
  TrainFront,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { barlow, cx, focusRing } from "../uiStyles";

type Scenario = {
  id: string;
  prompt: string;
  imagePath: string | null;
};

type Line = {
  scenarioId: string;
  path: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

type MatchingBoardProps = {
  scenarios: Scenario[];
  destinations: string[];
  connections: Record<string, string>;
  activeScenarioId: string | null;
  lockedIds: Set<string>;
  invalidIds: Set<string>;
  disabled: boolean;
  onSelectScenario: (scenarioId: string) => void;
  onSelectDestination: (destination: string) => void;
};

const destinationIcons = [TrainFront, CloudRain, School, MapPin, ShieldCheck];

export function MatchingBoard({
  scenarios,
  destinations,
  connections,
  activeScenarioId,
  lockedIds,
  invalidIds,
  disabled,
  onSelectScenario,
  onSelectDestination,
}: MatchingBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const scenarioRefs = useRef(new Map<string, HTMLButtonElement>());
  const destinationRefs = useRef(new Map<string, HTMLButtonElement>());
  const [lines, setLines] = useState<Line[]>([]);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const updateLines = () => {
      const boardBounds = board.getBoundingClientRect();
      const nextLines = Object.entries(connections).flatMap(
        ([scenarioId, destination]) => {
          const scenario = scenarioRefs.current.get(scenarioId);
          const target = destinationRefs.current.get(destination);
          if (!scenario || !target) return [];

          const from = scenario.getBoundingClientRect();
          const to = target.getBoundingClientRect();
          const startX = from.right - boardBounds.left;
          const startY = from.top + from.height / 2 - boardBounds.top;
          const endX = to.left - boardBounds.left;
          const endY = to.top + to.height / 2 - boardBounds.top;
          const controlX = startX + (endX - startX) / 2;
          return [{
            scenarioId,
            path: `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`,
            startX,
            startY,
            endX,
            endY,
          }];
        },
      );
      setLines(nextLines);
    };

    updateLines();
    const observer = new ResizeObserver(updateLines);
    observer.observe(board);
    window.addEventListener("resize", updateLines);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLines);
    };
  }, [connections, destinations, scenarios]);

  return (
    <div
      ref={boardRef}
      className="relative grid grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)] gap-[clamp(58px,8vw,120px)] max-[720px]:grid-cols-1 max-[720px]:gap-7"
    >
      <svg
        className="pointer-events-none absolute inset-0 z-10 size-full max-[720px]:hidden"
        aria-hidden="true"
      >
        {lines.map((line) => {
          const invalid = invalidIds.has(line.scenarioId);
          const locked = lockedIds.has(line.scenarioId);
          const color = invalid ? "#c7352d" : locked ? "#23845e" : "#d70000";
          return (
            <g key={line.scenarioId}>
              <path
                d={line.path}
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeDasharray={locked ? undefined : "7 6"}
              />
              <circle cx={line.startX} cy={line.startY} r="5" fill={color} />
              <circle cx={line.endX} cy={line.endY} r="5" fill={color} />
            </g>
          );
        })}
      </svg>

      <section className="relative z-20">
        <p className="mb-3 text-[9px] font-extrabold tracking-[0.16em] text-[#666] uppercase">
          1 · Välj en händelse
        </p>
        <div className="grid gap-3">
          {scenarios.map((scenario, index) => {
            const connectedTo = connections[scenario.id];
            const active = activeScenarioId === scenario.id;
            const locked = lockedIds.has(scenario.id);
            const invalid = invalidIds.has(scenario.id);
            return (
              <button
                ref={(node) => {
                  if (node) scenarioRefs.current.set(scenario.id, node);
                  else scenarioRefs.current.delete(scenario.id);
                }}
                key={scenario.id}
                type="button"
                className={cx(
                  `relative grid min-h-[108px] cursor-pointer grid-cols-[42px_minmax(0,1fr)] items-center gap-4 border bg-white p-4 text-left text-[#202020] ${focusRing}`,
                  active && "border-2 border-[#d70000] p-[15px] shadow-[0_5px_18px_rgba(215,0,0,0.08)]",
                  connectedTo && !active && "border-[#d70000]",
                  locked && "cursor-default !border-[#23845e] !bg-[#f3faf6]",
                  invalid && "!border-[#c7352d] !bg-[#fff0ef]",
                  disabled && "cursor-default",
                )}
                aria-pressed={active}
                disabled={disabled || locked}
                onClick={() => onSelectScenario(scenario.id)}
              >
                <span className={cx(
                  `${barlow} grid size-[42px] place-items-center bg-[#ededed] text-[19px] font-bold text-[#555]`,
                  active && "bg-[#f9eeee] text-[#d70000]",
                  locked && "!bg-[#23845e] !text-white",
                  invalid && "!bg-[#c7352d] !text-white",
                )}>
                  {locked ? <ShieldCheck size={20} /> : (index + 1).toString().padStart(2, "0")}
                </span>
                <span className="grid min-w-0 gap-2">
                  {scenario.imagePath && (
                    <img
                      className="max-h-[120px] w-full bg-[#fafafa] object-contain p-1"
                      src={scenario.imagePath}
                      alt="Bild som hör till riskscenariot"
                    />
                  )}
                  <strong className="text-[13px] leading-[1.5]">{scenario.prompt}</strong>
                  {connectedTo && (
                    <small className={cx(
                      "flex items-center gap-1.5 text-[9px] font-bold tracking-[0.08em] text-[#d70000] uppercase min-[721px]:hidden",
                      locked && "text-[#23845e]",
                      invalid && "text-[#c7352d]",
                    )}>
                      <Link2 size={12} /> {connectedTo}
                    </small>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="relative z-20">
        <p className="mb-3 text-[9px] font-extrabold tracking-[0.16em] text-[#666] uppercase">
          2 · Koppla till rätt riskzon
        </p>
        <div className="grid gap-3">
          {destinations.map((destination, index) => {
            const Icon = destinationIcons[index % destinationIcons.length];
            const connectedScenarioId = Object.entries(connections)
              .find(([, target]) => target === destination)?.[0];
            const locked = connectedScenarioId
              ? lockedIds.has(connectedScenarioId)
              : false;
            const selectable = Boolean(activeScenarioId) && !locked && !disabled;
            return (
              <button
                ref={(node) => {
                  if (node) destinationRefs.current.set(destination, node);
                  else destinationRefs.current.delete(destination);
                }}
                key={destination}
                type="button"
                className={cx(
                  `grid min-h-[108px] grid-cols-[42px_minmax(0,1fr)] items-center gap-3 border border-[#cfcfcf] bg-white p-4 text-left text-[#202020] ${focusRing}`,
                  selectable && "cursor-pointer hover:border-[#d70000] hover:bg-[#fffafa]",
                  connectedScenarioId && "border-[#d70000] bg-[#fffafa]",
                  locked && "cursor-default !border-[#23845e] !bg-[#f3faf6]",
                  !selectable && !connectedScenarioId && "cursor-default",
                )}
                disabled={!selectable}
                onClick={() => onSelectDestination(destination)}
              >
                <span className={cx(
                  "grid size-[42px] place-items-center bg-[#f9eeee] text-[#d70000]",
                  locked && "!bg-[#23845e] !text-white",
                )}>
                  <Icon size={21} />
                </span>
                <span className="grid gap-1">
                  <strong className={`${barlow} text-[20px] leading-none uppercase`}>
                    {destination}
                  </strong>
                  <small className="text-[9px] leading-[1.4] text-[#777]">
                    {locked ? "Korrekt koppling" : connectedScenarioId ? "Kopplad" : "Väntar på händelse"}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
