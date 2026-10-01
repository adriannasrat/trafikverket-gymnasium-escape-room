import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ArrowLeft, ArrowRight, Check, GripVertical, X } from "lucide-react";
import { barlow, cx, focusRing } from "../uiStyles";

type WordPart = { id: string; text: string };

type WordAssemblyBoardProps = {
  parts: WordPart[];
  order: string[];
  correctIds: Set<string>;
  incorrectIds: Set<string>;
  disabled: boolean;
  onReorder: (order: string[]) => void;
};

function moveItem(items: string[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function WordPartCard({
  part,
  index,
  total,
  correct,
  incorrect,
  disabled,
  onMove,
}: {
  part: WordPart;
  index: number;
  total: number;
  correct: boolean;
  incorrect: boolean;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const draggable = useDraggable({ id: part.id, disabled });
  const droppable = useDroppable({ id: part.id, disabled });

  return (
    <article
      ref={(node) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
      }}
      className={cx(
        "relative grid min-w-[180px] flex-1 grid-cols-[42px_minmax(0,1fr)] border-2 bg-white shadow-[0_6px_18px_rgba(25,25,25,0.07)] max-[560px]:min-w-0 max-[560px]:grid-cols-[38px_minmax(0,1fr)]",
        !correct && !incorrect && "border-[#cfcfcf]",
        correct && "border-[#23845e] bg-[#f3faf6]",
        incorrect && "border-[#c7352d] bg-[#fff7f6]",
        droppable.isOver && !disabled && "border-[#d70000] bg-[#fffafa]",
        draggable.isDragging && "z-50 opacity-80 shadow-[0_16px_35px_rgba(25,25,25,0.2)]",
      )}
      style={{
        transform: draggable.transform
          ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`
          : undefined,
      }}
    >
      <button
        className={`row-span-2 grid touch-none cursor-grab place-items-center border-0 border-r border-[#dedede] bg-[#f5f5f5] text-[#777] active:cursor-grabbing disabled:cursor-default ${focusRing}`}
        type="button"
        aria-label={`Dra orddelen ${part.text}, position ${index + 1} av ${total}`}
        disabled={disabled}
        {...draggable.listeners}
        {...draggable.attributes}
      >
        {correct ? <Check className="text-[#23845e]" size={19} /> : incorrect ? <X className="text-[#c7352d]" size={19} /> : <GripVertical size={19} />}
      </button>
      <div className="grid min-h-[82px] place-items-center px-4 py-3 text-center">
        <span className={`${barlow} text-[clamp(25px,3vw,35px)] leading-none font-bold text-[#202020] uppercase`}>{part.text}</span>
      </div>
      <div className="flex border-t border-[#e2e2e2]">
        <button
          className={`grid min-h-9 flex-1 cursor-pointer place-items-center border-0 border-r border-[#e2e2e2] bg-transparent text-[#666] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:text-[#ccc] ${focusRing}`}
          type="button"
          aria-label={`Flytta ${part.text} åt vänster`}
          disabled={disabled || index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowLeft size={16} />
        </button>
        <span className="grid min-w-10 place-items-center text-[9px] font-extrabold tracking-[0.12em] text-[#777]">{index + 1}</span>
        <button
          className={`grid min-h-9 flex-1 cursor-pointer place-items-center border-0 border-l border-[#e2e2e2] bg-transparent text-[#666] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:text-[#ccc] ${focusRing}`}
          type="button"
          aria-label={`Flytta ${part.text} åt höger`}
          disabled={disabled || index === total - 1}
          onClick={() => onMove(1)}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}

export function WordAssemblyBoard({
  parts,
  order,
  correctIds,
  incorrectIds,
  disabled,
  onReorder,
}: WordAssemblyBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const orderedParts = order
    .map((id) => parts.find((part) => part.id === id))
    .filter((part): part is WordPart => part !== undefined);

  function reorder(from: number, to: number) {
    if (disabled || from === to || to < 0 || to >= order.length) return;
    onReorder(moveItem(order, from, to));
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    reorder(order.indexOf(String(event.active.id)), order.indexOf(String(event.over.id)));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <section aria-label="Orddelar i vald ordning">
        <div className="mb-4 border-l-[3px] border-[#d70000] bg-[#fffafa] px-4 py-3 text-[11px] leading-[1.55] text-[#555]">
          Dra delarna till rätt plats. På en mindre skärm kan du även använda pilarna under varje del.
        </div>
        <div className="flex flex-wrap gap-3 max-[560px]:grid max-[560px]:grid-cols-1">
          {orderedParts.map((part, index) => (
            <WordPartCard
              key={part.id}
              part={part}
              index={index}
              total={orderedParts.length}
              correct={correctIds.has(part.id)}
              incorrect={incorrectIds.has(part.id)}
              disabled={disabled}
              onMove={(direction) => reorder(index, index + direction)}
            />
          ))}
        </div>
        <div className="mt-5 border border-[#dedede] bg-white px-5 py-4 text-center">
          <p className="m-0 text-[8px] font-extrabold tracking-[0.15em] text-[#777] uppercase">DITT SAMMANSATTA ORD</p>
          <p className={`${barlow} mt-2 mb-0 break-words text-[clamp(31px,5vw,52px)] leading-none font-bold text-[#202020] uppercase`}>
            {orderedParts.map((part) => part.text).join("")}
          </p>
        </div>
      </section>
    </DndContext>
  );
}
