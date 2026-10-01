import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ArrowLeft, ArrowRight, GripVertical, Plus, Trash2 } from "lucide-react";
import type { AdminOption } from "../types";
import { barlow, cx, focusRing } from "../uiStyles";

type AdminWordAssemblyBoardProps = {
  options: AdminOption[];
  disabled: boolean;
  mutating: string | null;
  onChangeText: (optionId: string, text: string) => void;
  onReorder: (optionIds: string[]) => void;
  onAdd: () => void;
  onDelete: (optionId: string) => void;
};

function moveItem(items: string[], from: number, to: number) {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function AdminWordPart({
  option,
  index,
  total,
  disabled,
  onChangeText,
  onMove,
  onDelete,
}: {
  option: AdminOption;
  index: number;
  total: number;
  disabled: boolean;
  onChangeText: (text: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const draggable = useDraggable({ id: option.id, disabled });
  const droppable = useDroppable({ id: option.id, disabled });

  return (
    <article
      ref={(node) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
      }}
      className={cx(
        "relative min-w-[185px] flex-1 border-2 border-[#d5d5d5] bg-white shadow-[0_4px_12px_rgba(25,25,25,0.05)] max-[560px]:min-w-0",
        droppable.isOver && "border-[#d70000] bg-[#fffafa]",
        draggable.isDragging && "z-50 opacity-80 shadow-[0_14px_30px_rgba(25,25,25,0.18)]",
      )}
      style={{
        transform: draggable.transform
          ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`
          : undefined,
      }}
    >
      <div className="flex items-center justify-between border-b border-[#dedede] bg-[#fafafa] px-2 py-2">
        <button
          className={`grid size-8 touch-none cursor-grab place-items-center border-0 bg-[#ededed] text-[#777] active:cursor-grabbing disabled:cursor-default ${focusRing}`}
          type="button"
          aria-label={`Dra orddel ${index + 1}`}
          disabled={disabled}
          {...draggable.listeners}
          {...draggable.attributes}
        >
          <GripVertical size={15} />
        </button>
        <span className="text-[8px] font-extrabold tracking-[0.13em] text-[#a32620] uppercase">POSITION {index + 1}</span>
        <button
          className={`grid size-8 cursor-pointer place-items-center border-0 bg-transparent text-[#888] hover:bg-[#fff0ef] hover:text-[#d70000] disabled:cursor-not-allowed disabled:opacity-35 ${focusRing}`}
          type="button"
          aria-label={`Ta bort orddelen ${option.text}`}
          disabled={disabled || total <= 2}
          onClick={onDelete}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <label className="grid gap-1 px-3 py-4">
        <span className="text-[8px] font-extrabold tracking-[0.13em] text-[#777] uppercase">ORDDEL</span>
        <input
          className={`${barlow} min-w-0 border-0 border-b border-[#cfcfcf] bg-transparent px-0 py-2 text-[25px] font-bold text-[#202020] uppercase outline-none focus:border-[#d70000]`}
          value={option.text}
          maxLength={500}
          disabled={disabled}
          onChange={(event) => onChangeText(event.target.value)}
        />
      </label>
      <div className="flex border-t border-[#dedede]">
        <button
          className={`grid min-h-9 flex-1 cursor-pointer place-items-center border-0 border-r border-[#dedede] bg-transparent text-[#666] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:text-[#ccc] ${focusRing}`}
          type="button"
          aria-label={`Flytta ${option.text} åt vänster`}
          disabled={disabled || index === 0}
          onClick={() => onMove(-1)}
        ><ArrowLeft size={15} /></button>
        <button
          className={`grid min-h-9 flex-1 cursor-pointer place-items-center border-0 bg-transparent text-[#666] hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:text-[#ccc] ${focusRing}`}
          type="button"
          aria-label={`Flytta ${option.text} åt höger`}
          disabled={disabled || index === total - 1}
          onClick={() => onMove(1)}
        ><ArrowRight size={15} /></button>
      </div>
    </article>
  );
}

export function AdminWordAssemblyBoard({
  options,
  disabled,
  mutating,
  onChangeText,
  onReorder,
  onAdd,
  onDelete,
}: AdminWordAssemblyBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const orderedOptions = [...options].sort((a, b) => a.sortOrder - b.sortOrder);
  const ids = orderedOptions.map((option) => option.id);

  function reorder(from: number, to: number) {
    if (disabled || from === to || to < 0 || to >= ids.length) return;
    onReorder(moveItem(ids, from, to));
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    reorder(ids.indexOf(String(event.active.id)), ids.indexOf(String(event.over.id)));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="mb-4 flex items-center justify-between gap-4 border-l-[3px] border-[#d70000] bg-[#fffafa] px-4 py-3 max-[560px]:items-start">
        <div>
          <p className="m-0 text-[9px] font-extrabold tracking-[0.12em] text-[#a32620] uppercase">RÄTT ORDFÖLJD</p>
          <p className="mt-1 mb-0 text-[10px] leading-[1.5] text-[#666]">Ordningen från vänster till höger är facit. Dra delarna eller använd pilarna.</p>
        </div>
        <button
          className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-2 border border-[#d70000] bg-white px-3 text-[9px] font-extrabold tracking-[0.07em] text-[#b00000] uppercase disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          type="button"
          disabled={disabled || options.length >= 8}
          onClick={onAdd}
        >
          <Plus size={14} /> {mutating?.startsWith("word-part-add-") ? "Lägger till…" : "Lägg till del"}
        </button>
      </div>
      <div className="flex flex-wrap gap-3 max-[560px]:grid max-[560px]:grid-cols-1">
        {orderedOptions.map((option, index) => (
          <AdminWordPart
            key={option.id}
            option={option}
            index={index}
            total={orderedOptions.length}
            disabled={disabled}
            onChangeText={(text) => onChangeText(option.id, text)}
            onMove={(direction) => reorder(index, index + direction)}
            onDelete={() => onDelete(option.id)}
          />
        ))}
      </div>
      <div className="mt-4 border border-[#dedede] bg-[#fafafa] px-4 py-3 text-center">
        <span className="text-[8px] font-extrabold tracking-[0.13em] text-[#777] uppercase">FÖRHANDSVISNING AV FACIT</span>
        <p className={`${barlow} mt-2 mb-0 break-words text-[clamp(28px,4vw,42px)] leading-none font-bold text-[#202020] uppercase`}>
          {orderedOptions.map((option) => option.text).join("")}
        </p>
      </div>
    </DndContext>
  );
}
