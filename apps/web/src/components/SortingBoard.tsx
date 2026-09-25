import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Check, GripVertical, Layers3, MousePointer2, X } from "lucide-react";
import { useState } from "react";
import { barlow, cx, focusRing } from "../uiStyles";

type SortingCard = { id: string; text: string };

type SortingBoardProps = {
  cards: SortingCard[];
  categories: string[];
  placements: Record<string, string | null>;
  correctIds: Set<string>;
  incorrectIds: Set<string>;
  disabled: boolean;
  onMove: (cardId: string, category: string | null) => void;
};

function SortingCardButton({
  card,
  selected,
  correct,
  incorrect,
  disabled,
  onSelect,
}: {
  card: SortingCard;
  selected: boolean;
  correct: boolean;
  incorrect: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cx(
        `flex min-h-[52px] touch-none items-center gap-2 border bg-white px-3 py-2 text-left text-[12px] font-bold text-[#202020] shadow-[0_3px_10px_rgba(25,25,25,0.06)] ${focusRing}`,
        !disabled && "cursor-grab active:cursor-grabbing",
        selected && "border-2 border-[#d70000] bg-[#fffafa] px-[11px] py-[7px] text-[#a32620]",
        correct && "border-[#23845e] bg-[#f3faf6] text-[#176b4c]",
        incorrect && "border-[#c7352d] bg-[#fff0ef] text-[#9f302b]",
        isDragging && "z-50 opacity-80 shadow-[0_14px_32px_rgba(25,25,25,0.18)]",
        disabled && "cursor-default",
      )}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onSelect();
      }}
      {...listeners}
      {...attributes}
    >
      {correct ? (
        <Check className="size-4 shrink-0 text-[#23845e]" />
      ) : incorrect ? (
        <X className="size-4 shrink-0 text-[#c7352d]" />
      ) : (
        <GripVertical className="size-4 shrink-0 text-[#888]" />
      )}
      <span>{card.text}</span>
    </button>
  );
}

function SortingZone({
  id,
  category,
  cards,
  selectedCardId,
  placements,
  correctIds,
  incorrectIds,
  disabled,
  onSelectCard,
  onPlaceSelected,
}: {
  id: string;
  category: string | null;
  cards: SortingCard[];
  selectedCardId: string | null;
  placements: Record<string, string | null>;
  correctIds: Set<string>;
  incorrectIds: Set<string>;
  disabled: boolean;
  onSelectCard: (cardId: string) => void;
  onPlaceSelected: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { category } });
  const isPool = category === null;

  return (
    <section
      ref={setNodeRef}
      className={cx(
        "min-h-[190px] border-2 bg-white p-4",
        isPool ? "col-span-full border-dashed border-[#bdbdbd] bg-[#fafafa]" : "border-[#d5d5d5]",
        isOver && "!border-[#d70000] !bg-[#fffafa]",
      )}
    >
      <div className="mb-3 flex min-h-9 items-center justify-between gap-3 border-b border-[#e2e2e2] pb-3">
        <div className="flex items-center gap-2">
          <span className={cx(
            "grid size-8 place-items-center bg-[#f9eeee] text-[#d70000]",
            isPool && "bg-[#ededed] text-[#666]",
          )}>
            <Layers3 size={17} />
          </span>
          <div>
            <p className="m-0 text-[8px] font-extrabold tracking-[0.13em] text-[#777] uppercase">
              {isPool ? "STARTYTA" : "OMRÅDE"}
            </p>
            <h3 className={`${barlow} m-0 text-[22px] leading-none uppercase`}>
              {category ?? "Lämna kvar"}
            </h3>
          </div>
        </div>
        {selectedCardId && !disabled && !correctIds.has(selectedCardId) &&
          placements[selectedCardId] !== category && (
          <button
            className={`inline-flex min-h-8 cursor-pointer items-center gap-1 border border-[#d70000] bg-white px-2 text-[8px] font-extrabold tracking-[0.08em] text-[#a32620] uppercase ${focusRing}`}
            type="button"
            onClick={onPlaceSelected}
          >
            <MousePointer2 size={12} /> Placera här
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 max-[480px]:grid-cols-1">
        {cards.map((card) => (
          <SortingCardButton
            key={card.id}
            card={card}
            selected={selectedCardId === card.id}
            correct={correctIds.has(card.id)}
            incorrect={incorrectIds.has(card.id)}
            disabled={disabled || correctIds.has(card.id)}
            onSelect={() => onSelectCard(card.id)}
          />
        ))}
        {cards.length === 0 && (
          <p className="col-span-full m-0 py-5 text-center text-[10px] text-[#999]">
            Dra eller placera kort här.
          </p>
        )}
      </div>
    </section>
  );
}

export function SortingBoard({
  cards,
  categories,
  placements,
  correctIds,
  incorrectIds,
  disabled,
  onMove,
}: SortingBoardProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardOrder] = useState(() =>
    [...cards]
      .sort(() => Math.random() - 0.5)
      .map((card) => card.id),
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const orderedCards = cardOrder
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is SortingCard => card !== undefined);

  function place(cardId: string, category: string | null) {
    if (disabled || correctIds.has(cardId)) return;
    onMove(cardId, category);
    setSelectedCardId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const category = event.over?.data.current?.category;
    if (!event.over || (category !== null && typeof category !== "string")) return;
    place(String(event.active.id), category);
  }

  const zones = [...categories.map((category, index) => ({
    id: `sorting-category-${index}`,
    category: category as string | null,
  })), { id: "sorting-pool", category: null }];

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-l-[3px] border-[#d70000] bg-[#fffafa] px-4 py-3 text-[11px] text-[#555]">
        <span>Dra korten till rätt område, eller välj ett kort och tryck på <strong>Placera här</strong>.</span>
        <strong className="text-[#a32620]">Bluffkorten ska ligga kvar.</strong>
      </div>
      <div className="grid grid-cols-3 gap-4 max-[980px]:grid-cols-2 max-[620px]:grid-cols-1">
        {zones.map((zone) => {
          const zoneCards = orderedCards.filter((card) => placements[card.id] === zone.category);
          return (
            <SortingZone
              key={zone.id}
              id={zone.id}
              category={zone.category}
              cards={zoneCards}
              selectedCardId={selectedCardId}
              placements={placements}
              correctIds={correctIds}
              incorrectIds={incorrectIds}
              disabled={disabled}
              onSelectCard={(cardId) => setSelectedCardId((current) => current === cardId ? null : cardId)}
              onPlaceSelected={() => {
                if (selectedCardId) place(selectedCardId, zone.category);
              }}
            />
          );
        })}
      </div>
    </DndContext>
  );
}
