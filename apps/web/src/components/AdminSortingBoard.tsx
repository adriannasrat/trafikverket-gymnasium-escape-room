import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, Layers3, MousePointer2, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AdminOption } from "../types";
import { barlow, cx, focusRing } from "../uiStyles";

type AdminSortingBoardProps = {
  options: AdminOption[];
  disabled: boolean;
  onChangeText: (optionId: string, text: string) => void;
  onMove: (optionId: string, category: string | null) => void;
  onRenameCategory: (category: string, nextCategory: string) => void;
  onDelete: (optionId: string) => void;
};

function CategoryNameInput({
  category,
  categories,
  disabled,
  onRename,
}: {
  category: string;
  categories: string[];
  disabled: boolean;
  onRename: (nextCategory: string) => void;
}) {
  const [draft, setDraft] = useState(category);

  function commit() {
    const nextCategory = draft.trim();
    const duplicate = categories.some(
      (candidate) =>
        candidate !== category &&
        candidate.localeCompare(nextCategory, "sv", { sensitivity: "accent" }) === 0,
    );
    if (!nextCategory || duplicate) {
      setDraft(category);
      return;
    }
    if (nextCategory !== category) onRename(nextCategory);
  }

  return (
    <input
      className={`${barlow} min-w-0 border-0 border-b border-transparent bg-transparent p-0 text-[22px] leading-none font-bold text-[#202020] uppercase outline-none hover:border-[#c9c9c9] focus:border-[#d70000] disabled:text-[#777]`}
      aria-label={`Namn på målområdet ${category}`}
      value={draft}
      disabled={disabled}
      maxLength={80}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(category);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function AdminSortingCard({
  option,
  selected,
  disabled,
  onSelect,
  onChangeText,
  onDelete,
}: {
  option: AdminOption;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onChangeText: (text: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `admin-sorting-card-${option.id}`,
    data: { optionId: option.id },
    disabled,
  });

  return (
    <article
      ref={setNodeRef}
      className={cx(
        "grid min-h-[58px] grid-cols-[34px_minmax(0,1fr)_34px] items-center gap-2 border bg-white p-2 shadow-[0_3px_10px_rgba(25,25,25,0.05)]",
        selected ? "border-[#d70000] bg-[#fffafa]" : "border-[#d8d8d8]",
        isDragging && "z-50 opacity-85 shadow-[0_14px_30px_rgba(25,25,25,0.18)]",
      )}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
    >
      <button
        className={`grid size-[34px] touch-none cursor-grab place-items-center border-0 bg-[#f1f1f1] text-[#777] active:cursor-grabbing disabled:cursor-not-allowed ${focusRing}`}
        type="button"
        aria-label={`Flytta kortet ${option.text}`}
        title="Dra kortet, eller välj det och tryck Placera här"
        disabled={disabled}
        onClick={onSelect}
        {...listeners}
        {...attributes}
      >
        <GripVertical size={16} />
      </button>
      <input
        className="min-w-0 border-0 bg-transparent px-1 py-2 text-[11px] font-bold text-[#202020] outline-none focus:bg-white focus:ring-2 focus:ring-[rgba(215,0,0,0.2)]"
        aria-label="Korttext"
        value={option.text}
        maxLength={500}
        disabled={disabled}
        onChange={(event) => onChangeText(event.target.value)}
      />
      <button
        className={`grid size-[34px] cursor-pointer place-items-center border-0 bg-transparent text-[#888] hover:bg-[#fff0ef] hover:text-[#d70000] disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
        type="button"
        aria-label={`Ta bort kortet ${option.text}`}
        title={`Ta bort kortet ${option.text}`}
        disabled={disabled}
        onClick={onDelete}
      >
        <Trash2 size={15} />
      </button>
    </article>
  );
}

function AdminSortingZone({
  id,
  category,
  categories,
  options,
  selectedOptionId,
  disabled,
  onSelect,
  onPlaceSelected,
  onChangeText,
  onRenameCategory,
  onDelete,
}: {
  id: string;
  category: string | null;
  categories: string[];
  options: AdminOption[];
  selectedOptionId: string | null;
  disabled: boolean;
  onSelect: (optionId: string) => void;
  onPlaceSelected: () => void;
  onChangeText: (optionId: string, text: string) => void;
  onRenameCategory: (category: string, nextCategory: string) => void;
  onDelete: (optionId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { category } });
  const isPool = category === null;

  return (
    <section
      ref={setNodeRef}
      className={cx(
        "min-h-[220px] border-2 bg-white p-3 transition-colors",
        isPool
          ? "col-span-full border-dashed border-[#bdbdbd] bg-[#fafafa]"
          : "border-[#d7d7d7]",
        isOver && "!border-[#d70000] !bg-[#fffafa]",
      )}
    >
      <div className="mb-3 flex min-h-[45px] items-center justify-between gap-3 border-b border-[#e2e2e2] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cx(
            "grid size-8 shrink-0 place-items-center bg-[#f9eeee] text-[#d70000]",
            isPool && "bg-[#ededed] text-[#666]",
          )}>
            <Layers3 size={17} />
          </span>
          <div className="grid min-w-0">
            <span className="text-[8px] font-extrabold tracking-[0.13em] text-[#777] uppercase">
              {isPool ? "STARTYTA · BLUFFKORT" : "MÅLOMRÅDE"}
            </span>
            {category ? (
              <CategoryNameInput
                category={category}
                categories={categories}
                disabled={disabled}
                onRename={(nextCategory) => onRenameCategory(category, nextCategory)}
              />
            ) : (
              <strong className={`${barlow} text-[22px] leading-none uppercase`}>Lämna kvar</strong>
            )}
          </div>
        </div>
        {selectedOptionId && options.every((option) => option.id !== selectedOptionId) && (
          <button
            className={`inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1 border border-[#d70000] bg-white px-2 text-[8px] font-extrabold tracking-[0.06em] text-[#a32620] uppercase ${focusRing}`}
            type="button"
            disabled={disabled}
            onClick={onPlaceSelected}
          >
            <MousePointer2 size={12} /> Placera här
          </button>
        )}
      </div>
      <div className="grid gap-2">
        {options.map((option) => (
          <AdminSortingCard
            key={option.id}
            option={option}
            selected={selectedOptionId === option.id}
            disabled={disabled}
            onSelect={() => onSelect(option.id)}
            onChangeText={(text) => onChangeText(option.id, text)}
            onDelete={() => onDelete(option.id)}
          />
        ))}
        {options.length === 0 && (
          <p className="m-0 py-7 text-center text-[10px] text-[#999]">
            Dra eller placera kort här.
          </p>
        )}
      </div>
    </section>
  );
}

export function AdminSortingBoard({
  options,
  disabled,
  onChangeText,
  onMove,
  onRenameCategory,
  onDelete,
}: AdminSortingBoardProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const orderedOptions = [...options].sort((left, right) => left.sortOrder - right.sortOrder);
  const categories = orderedOptions.reduce<string[]>((result, option) => {
    const category = option.sortingCategory?.trim();
    if (category && !result.includes(category)) result.push(category);
    return result;
  }, []);
  const zones = [
    ...categories.map((category, index) => ({
      id: `admin-sorting-category-${index}`,
      category: category as string | null,
    })),
    { id: "admin-sorting-pool", category: null },
  ];

  function place(optionId: string, category: string | null) {
    if (disabled) return;
    onMove(optionId, category);
    setSelectedOptionId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const category = event.over?.data.current?.category;
    const optionId = event.active.data.current?.optionId;
    if (
      !event.over ||
      typeof optionId !== "string" ||
      (category !== null && typeof category !== "string")
    ) return;
    place(optionId, category);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-3 gap-3 max-[1120px]:grid-cols-2 max-[720px]:grid-cols-1">
        {zones.map((zone) => {
          const zoneOptions = orderedOptions.filter(
            (option) => (option.sortingCategory?.trim() || null) === zone.category,
          );
          return (
            <AdminSortingZone
              key={zone.id}
              id={zone.id}
              category={zone.category}
              categories={categories}
              options={zoneOptions}
              selectedOptionId={selectedOptionId}
              disabled={disabled}
              onSelect={(optionId) =>
                setSelectedOptionId((current) => current === optionId ? null : optionId)
              }
              onPlaceSelected={() => {
                if (selectedOptionId) place(selectedOptionId, zone.category);
              }}
              onChangeText={onChangeText}
              onRenameCategory={onRenameCategory}
              onDelete={onDelete}
            />
          );
        })}
      </div>
    </DndContext>
  );
}
