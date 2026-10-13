import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AdminChallenge } from "../types";
import { barlow, secondaryButton } from "../uiStyles";
import {
  DestinationCard,
  ScenarioCard,
} from "./AdminMatchingCards";

type AdminMatchingBoardProps = {
  challenges: AdminChallenge[];
  disabled: boolean;
  mutating: string | null;
  onAddDestination: () => void;
  onAddScenario: () => void;
  onRenameDestination: (sortOrder: number, text: string) => void;
  onChangeDestinationIcon: (sortOrder: number, iconKey: string) => void;
  onMoveDestination: (sortOrder: number, direction: -1 | 1) => void;
  onMoveScenario: (challengeId: string, direction: -1 | 1) => void;
  onAssignScenario: (challengeId: string, destinationSortOrder: number) => void;
  onChangePrompt: (challengeId: string, prompt: string) => void;
  onUploadImage: (challengeId: string, image?: File) => void;
  onDeleteScenario: (challengeId: string) => void;
  onDeleteDestination: (sortOrder: number) => void;
};


type ConnectionLine = {
  challengeId: string;
  path: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};


export function AdminMatchingBoard({
  challenges,
  disabled,
  mutating,
  onAddDestination,
  onAddScenario,
  onRenameDestination,
  onChangeDestinationIcon,
  onMoveDestination,
  onMoveScenario,
  onAssignScenario,
  onChangePrompt,
  onUploadImage,
  onDeleteScenario,
  onDeleteDestination,
}: AdminMatchingBoardProps) {
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(
    null,
  );
  const [lines, setLines] = useState<ConnectionLine[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const scenarioRefs = useRef(new Map<string, HTMLElement>());
  const destinationRefs = useRef(new Map<number, HTMLElement>());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const orderedChallenges = useMemo(
    () =>
      [...challenges].sort((left, right) => left.sortOrder - right.sortOrder),
    [challenges],
  );
  const destinations = useMemo(
    () =>
      [...(orderedChallenges[0]?.options ?? [])]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((option) => ({
          sortOrder: option.sortOrder,
          text: option.text,
          matchingIconKey: option.matchingIconKey,
        })),
    [orderedChallenges],
  );

  function destinationForChallenge(challenge: AdminChallenge) {
    const correctSortOrder = challenge.options.find(
      (option) => option.isCorrect,
    )?.sortOrder;
    return destinations.find(
      (destination) => destination.sortOrder === correctSortOrder,
    );
  }

  function challengeForDestination(sortOrder: number) {
    return orderedChallenges.find((challenge) =>
      challenge.options.some(
        (option) => option.sortOrder === sortOrder && option.isCorrect,
      ),
    );
  }

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const updateLines = () => {
      const boardBounds = board.getBoundingClientRect();
      const nextLines = orderedChallenges.flatMap((challenge) => {
        const destinationSortOrder = challenge.options.find(
          (option) => option.isCorrect,
        )?.sortOrder;
        const scenarioNode = scenarioRefs.current.get(challenge.id);
        const destinationNode =
          destinationSortOrder !== undefined
            ? destinationRefs.current.get(destinationSortOrder)
            : undefined;
        if (!scenarioNode || !destinationNode) return [];

        const from = scenarioNode.getBoundingClientRect();
        const to = destinationNode.getBoundingClientRect();
        const startX = from.right - boardBounds.left;
        const startY = from.top + 74 - boardBounds.top;
        const endX = to.left - boardBounds.left;
        const endY = to.top + 74 - boardBounds.top;
        const controlX = startX + (endX - startX) / 2;
        return [
          {
            challengeId: challenge.id,
            path: `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`,
            startX,
            startY,
            endX,
            endY,
          },
        ];
      });
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
  }, [challenges, destinations, orderedChallenges]);

  function place(challengeId: string, destinationSortOrder: number) {
    if (disabled) return;
    onAssignScenario(challengeId, destinationSortOrder);
    setSelectedChallengeId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const challengeId = event.active.data.current?.challengeId;
    const destinationSortOrder = event.over?.data.current?.destinationSortOrder;
    if (
      !event.over ||
      typeof challengeId !== "string" ||
      typeof destinationSortOrder !== "number"
    )
      return;
    place(challengeId, destinationSortOrder);
  }

  return (
    <section className="mb-[30px] min-w-0 overflow-hidden border border-[#dedede] bg-[#fafafa] p-5 max-[720px]:p-3">
      <div className="mb-4 flex flex-col items-stretch justify-between gap-5 min-[1400px]:flex-row min-[1400px]:items-end">
        <div>
          <p className="m-0 text-[9px] font-extrabold tracking-[0.15em] text-[#a32620] uppercase">
            Visuell scenariokarta
          </p>
          <p className="mt-1 mb-0 max-w-[76ch] text-[11px] leading-[1.5] text-[#686868]">
            Händelserna och riskzonerna visas i samma ordning som i spelet. På
            breda skärmar kan du dra eller välja en händelse. På mindre skärmar
            väljer du riskzon direkt inuti varje händelse.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 min-[1400px]:flex min-[1400px]:w-auto">
          <button
            className={`${secondaryButton} w-full min-w-0 shrink-0 px-3 min-[1400px]:w-auto`}
            type="button"
            disabled={
              disabled || orderedChallenges.length >= destinations.length
            }
            title={
              orderedChallenges.length >= destinations.length
                ? "Lägg till en riskzon först"
                : undefined
            }
            onClick={onAddScenario}
          >
            <Plus size={15} /> Händelse
          </button>
          <button
            className={`${secondaryButton} w-full min-w-0 shrink-0 px-3 min-[1400px]:w-auto`}
            type="button"
            disabled={disabled || destinations.length >= 6}
            onClick={onAddDestination}
          >
            <Plus size={15} /> Riskzon
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          ref={boardRef}
          className="relative grid min-w-0 grid-cols-1 gap-7 min-[1400px]:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.65fr)] min-[1400px]:gap-[clamp(58px,8vw,120px)]"
        >
          <svg
            className="pointer-events-none absolute inset-0 z-10 hidden size-full min-[1400px]:block"
            aria-hidden="true"
          >
            {lines.map((line) => (
              <g key={line.challengeId}>
                <path
                  d={line.path}
                  fill="none"
                  stroke="#d70000"
                  strokeWidth="2.5"
                  strokeDasharray="7 6"
                />
                <circle
                  cx={line.startX}
                  cy={line.startY}
                  r="4"
                  fill="#d70000"
                />
                <circle cx={line.endX} cy={line.endY} r="4" fill="#d70000" />
              </g>
            ))}
          </svg>

          <section className="relative z-20 min-w-0">
            <div className="mb-3 pl-3">
              <strong
                className={`${barlow} block text-[21px] leading-none uppercase`}
              >
                Händelser
              </strong>
              <span className="text-[8px] font-bold tracking-[0.1em] text-[#777] uppercase">
                Vänsterkolumnen i spelet
              </span>
            </div>
            <div className="grid gap-3">
              {orderedChallenges.map((challenge, index) => {
                const destination = destinationForChallenge(challenge);
                const destinationIndex = destination
                  ? destinations.findIndex(
                      (candidate) =>
                        candidate.sortOrder === destination.sortOrder,
                    )
                  : -1;
                return (
                  <ScenarioCard
                    key={challenge.id}
                    challenge={challenge}
                    index={index}
                    total={orderedChallenges.length}
                    destination={destination}
                    destinations={destinations}
                    destinationIndex={destinationIndex}
                    destinationTotal={destinations.length}
                    selected={selectedChallengeId === challenge.id}
                    disabled={disabled}
                    mutating={mutating}
                    canDelete={orderedChallenges.length > 1}
                    onNode={(node) => {
                      if (node) scenarioRefs.current.set(challenge.id, node);
                      else scenarioRefs.current.delete(challenge.id);
                    }}
                    onSelect={() =>
                      setSelectedChallengeId((current) =>
                        current === challenge.id ? null : challenge.id,
                      )
                    }
                    onAssign={(destinationSortOrder) =>
                      place(challenge.id, destinationSortOrder)
                    }
                    onMove={(direction) =>
                      onMoveScenario(challenge.id, direction)
                    }
                    onChangePrompt={(prompt) =>
                      onChangePrompt(challenge.id, prompt)
                    }
                    onUploadImage={(image) =>
                      onUploadImage(challenge.id, image)
                    }
                    onDelete={() => onDeleteScenario(challenge.id)}
                  />
                );
              })}
            </div>
          </section>

          <section className="relative z-20 min-w-0">
            <div className="mb-3 pl-3">
              <strong
                className={`${barlow} block text-[21px] leading-none uppercase`}
              >
                Riskzoner
              </strong>
              <span className="text-[8px] font-bold tracking-[0.1em] text-[#777] uppercase">
                Högerkolumnen i spelet
              </span>
            </div>
            <div className="grid gap-3">
              {destinations.map((destination, index) => {
                const assignedChallenge = challengeForDestination(
                  destination.sortOrder,
                );
                const assignedChallengeIndex = assignedChallenge
                  ? orderedChallenges.findIndex(
                      (challenge) => challenge.id === assignedChallenge.id,
                    )
                  : -1;
                const canDelete =
                  !assignedChallenge &&
                  destinations.length > 2 &&
                  destinations.length > orderedChallenges.length;
                return (
                  <DestinationCard
                    key={destination.sortOrder}
                    destination={destination}
                    index={index}
                    total={destinations.length}
                    assignedChallenge={assignedChallenge}
                    assignedChallengeIndex={assignedChallengeIndex}
                    selectedChallengeId={selectedChallengeId}
                    disabled={disabled}
                    canDelete={canDelete}
                    onNode={(node) => {
                      if (node)
                        destinationRefs.current.set(
                          destination.sortOrder,
                          node,
                        );
                      else
                        destinationRefs.current.delete(destination.sortOrder);
                    }}
                    onPlaceSelected={() => {
                      if (selectedChallengeId)
                        place(selectedChallengeId, destination.sortOrder);
                    }}
                    onRename={(text) =>
                      onRenameDestination(destination.sortOrder, text)
                    }
                    onChangeIcon={(iconKey) =>
                      onChangeDestinationIcon(destination.sortOrder, iconKey)
                    }
                    onMove={(direction) =>
                      onMoveDestination(destination.sortOrder, direction)
                    }
                    onDelete={() => onDeleteDestination(destination.sortOrder)}
                  />
                );
              })}
            </div>
          </section>
        </div>
      </DndContext>
    </section>
  );
}
