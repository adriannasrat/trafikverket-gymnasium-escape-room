import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  ImagePlus,
  Link2,
  MousePointer2,
  Trash2,
} from "lucide-react";
import { createElement, useState } from "react";
import type { AdminChallenge } from "../types";
import { barlow, cx, focusRing } from "../uiStyles";
import { getMatchingIcon, matchingIconOptions } from "./matchingIcons";

export type Destination = {
  sortOrder: number;
  text: string;
  matchingIconKey: string | null;
};

function positionName(index: number, total: number) {
  if (index === 0) return "Överst";
  if (index === total - 1) return "Längst ner";
  if (total === 3 && index === 1) return "Mitten";
  return `Position ${index + 1}`;
}

export function ScenarioCard({
  challenge,
  index,
  total,
  destination,
  destinations,
  destinationIndex,
  destinationTotal,
  selected,
  disabled,
  mutating,
  imageUploadsEnabled,
  canDelete,
  onNode,
  onSelect,
  onAssign,
  onMove,
  onChangePrompt,
  onUploadImage,
  onDelete,
}: {
  challenge: AdminChallenge;
  index: number;
  total: number;
  destination?: Destination;
  destinations: Destination[];
  destinationIndex: number;
  destinationTotal: number;
  selected: boolean;
  disabled: boolean;
  mutating: string | null;
  imageUploadsEnabled: boolean;
  canDelete: boolean;
  onNode: (node: HTMLElement | null) => void;
  onSelect: () => void;
  onAssign: (destinationSortOrder: number) => void;
  onMove: (direction: -1 | 1) => void;
  onChangePrompt: (prompt: string) => void;
  onUploadImage: (image?: File) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `admin-matching-scenario-${challenge.id}`,
      data: { challengeId: challenge.id },
      disabled,
    });

  return (
    <article
      ref={(node) => {
        setNodeRef(node);
        onNode(node);
      }}
      className={cx(
        "relative z-20 grid min-w-0 gap-3 overflow-hidden border bg-white p-3 shadow-[0_3px_10px_rgba(25,25,25,0.05)]",
        selected
          ? "border-2 border-[#d70000] bg-[#fffafa] p-[11px]"
          : "border-[#d8d8d8]",
        isDragging &&
          "z-50 opacity-85 shadow-[0_14px_30px_rgba(25,25,25,0.18)]",
      )}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#e5e5e5] pb-2.5">
        <div className="min-w-0">
          <strong className="block text-[9px] tracking-[0.1em] text-[#555] uppercase">
            Händelse {index + 1} av {total}
          </strong>
          <span className="mt-0.5 block text-[8px] font-bold tracking-[0.08em] text-[#a32620] uppercase">
            {positionName(index, total)} i vänsterkolumnen
          </span>
        </div>
        <div className="flex items-center">
          <button
            className={`grid size-[32px] cursor-pointer place-items-center border-0 bg-transparent text-[#666] hover:bg-[#f0f0f0] hover:text-[#202020] disabled:cursor-not-allowed disabled:opacity-25 ${focusRing}`}
            type="button"
            aria-label={`Flytta händelse ${index + 1} uppåt`}
            title="Flytta upp i vänsterkolumnen"
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp size={16} />
          </button>
          <button
            className={`grid size-[32px] cursor-pointer place-items-center border-0 bg-transparent text-[#666] hover:bg-[#f0f0f0] hover:text-[#202020] disabled:cursor-not-allowed disabled:opacity-25 ${focusRing}`}
            type="button"
            aria-label={`Flytta händelse ${index + 1} nedåt`}
            title="Flytta ner i vänsterkolumnen"
            disabled={disabled || index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown size={16} />
          </button>
          <button
            className={`grid size-[32px] cursor-pointer place-items-center border-0 bg-transparent text-[#888] hover:bg-[#fff0ef] hover:text-[#d70000] disabled:cursor-not-allowed disabled:opacity-35 ${focusRing}`}
            type="button"
            aria-label={`Ta bort händelse ${index + 1}`}
            title={
              canDelete
                ? "Ta bort händelse"
                : "Spelet måste ha minst en händelse"
            }
            disabled={disabled || !canDelete}
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {challenge.imagePath && (
        <img
          className="max-h-[150px] w-full border border-[#ececec] bg-[#fafafa] object-contain p-1"
          src={challenge.imagePath}
          alt="Bild som hör till riskhändelsen"
        />
      )}

      <label className="grid gap-1 text-[8px] font-extrabold tracking-[0.11em] text-[#666] uppercase">
        Händelsetext
        <textarea
          className="min-h-[88px] w-full resize-y border border-[#cfcfcf] bg-white px-3 py-2.5 text-[11px] leading-[1.5] font-semibold tracking-normal text-[#202020] normal-case outline-none focus:border-[#d70000] focus:ring-2 focus:ring-[rgba(215,0,0,0.15)]"
          value={challenge.prompt}
          maxLength={1200}
          disabled={disabled}
          onChange={(event) => onChangePrompt(event.target.value)}
        />
      </label>

      <div className="hidden grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2 min-[1400px]:grid">
        <div className="flex min-h-10 items-center gap-2 border border-[#e5d0ce] bg-[#fff8f7] px-3 text-[8px] font-bold tracking-[0.06em] text-[#777] uppercase">
          {destination ? (
            <>
              {createElement(getMatchingIcon(destination.matchingIconKey), {
                size: 15,
              })}
              <span className="min-w-0">
                Rätt riskzon:{" "}
                <strong className="text-[#a32620]">{destination.text}</strong>
                <small className="mt-0.5 block font-semibold text-[#888]">
                  {positionName(destinationIndex, destinationTotal)} i
                  högerkolumnen
                </small>
              </span>
            </>
          ) : (
            <span>Ingen riskzon är kopplad</span>
          )}
        </div>
        <button
          className={`inline-flex min-h-10 touch-none cursor-grab items-center justify-center gap-1.5 border border-[#bdbdbd] bg-white px-3 text-[8px] font-extrabold tracking-[0.08em] text-[#555] uppercase active:cursor-grabbing disabled:cursor-not-allowed ${focusRing}`}
          type="button"
          aria-label={`Välj eller dra händelse ${index + 1}`}
          title="Dra till en riskzon, eller välj och klicka på Koppla hit"
          disabled={disabled}
          onClick={onSelect}
          {...listeners}
          {...attributes}
        >
          <GripVertical size={15} /> {selected ? "Vald" : "Koppla"}
        </button>
      </div>

      <label className="grid min-w-0 gap-1.5 text-[8px] font-extrabold tracking-[0.11em] text-[#666] uppercase min-[1400px]:hidden">
        Koppla till riskzon
        <select
          className="min-h-11 w-full min-w-0 cursor-pointer appearance-none border border-[#bdbdbd] bg-[linear-gradient(45deg,transparent_50%,#555_50%),linear-gradient(135deg,#555_50%,transparent_50%)] bg-[position:calc(100%-17px)_50%,calc(100%-12px)_50%] bg-[size:5px_5px,5px_5px] bg-no-repeat px-3 pr-9 text-[11px] font-bold tracking-normal text-[#202020] normal-case outline-none focus:border-[#d70000] focus:ring-2 focus:ring-[rgba(215,0,0,0.15)] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Koppla händelse ${index + 1} till riskzon`}
          value={destination?.sortOrder ?? ""}
          disabled={disabled || destinations.length === 0}
          onChange={(event) => onAssign(Number(event.target.value))}
        >
          {!destination && (
            <option value="" disabled>
              Välj riskzon
            </option>
          )}
          {destinations.map((candidate, candidateIndex) => (
            <option key={candidate.sortOrder} value={candidate.sortOrder}>
              {positionName(candidateIndex, destinations.length)}:{" "}
              {candidate.text}
            </option>
          ))}
        </select>
        <span className="text-[8px] font-semibold tracking-normal text-[#888] normal-case">
          Valet uppdaterar kopplingen direkt i riskzonslistan nedanför.
        </span>
      </label>

      {imageUploadsEnabled ? (
        <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 border border-[#bdbdbd] bg-white px-3 text-[8px] font-extrabold tracking-[0.07em] text-[#555] uppercase focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[rgba(215,0,0,0.25)]">
          <ImagePlus size={14} />
          {mutating === `image-${challenge.id}`
            ? "Laddar upp…"
            : challenge.imagePath
              ? "Byt bild"
              : "Lägg till bild"}
          <input
            className="absolute size-px opacity-0"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(event) => {
              const image = event.target.files?.[0];
              event.target.value = "";
              onUploadImage(image);
            }}
          />
        </label>
      ) : (
        <p className="m-0 border-l-[3px] border-[#d70000] bg-[#fff4f3] px-3 py-2 text-[8px] leading-[1.5] font-bold text-[#8f211c]">
          Demoläge: Bildbyte är avstängt i onlineversionen.
        </p>
      )}
    </article>
  );
}

export function DestinationCard({
  destination,
  index,
  total,
  assignedChallenge,
  assignedChallengeIndex,
  selectedChallengeId,
  disabled,
  canDelete,
  onNode,
  onPlaceSelected,
  onRename,
  onChangeIcon,
  onMove,
  onDelete,
}: {
  destination: Destination;
  index: number;
  total: number;
  assignedChallenge?: AdminChallenge;
  assignedChallengeIndex: number;
  selectedChallengeId: string | null;
  disabled: boolean;
  canDelete: boolean;
  onNode: (node: HTMLElement | null) => void;
  onPlaceSelected: () => void;
  onRename: (text: string) => void;
  onChangeIcon: (iconKey: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `admin-matching-destination-${destination.sortOrder}`,
    data: { destinationSortOrder: destination.sortOrder },
  });
  const selectedIsAssigned = selectedChallengeId === assignedChallenge?.id;

  return (
    <article
      ref={(node) => {
        setNodeRef(node);
        onNode(node);
      }}
      className={cx(
        "relative z-20 grid min-h-[168px] min-w-0 gap-3 overflow-hidden border bg-white p-3 shadow-[0_3px_10px_rgba(25,25,25,0.05)]",
        isOver
          ? "border-2 border-[#d70000] bg-[#fffafa] p-[11px]"
          : "border-[#d8d8d8]",
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#e5e5e5] pb-2.5">
        <div className="min-w-0">
          <strong className="block text-[9px] tracking-[0.1em] text-[#555] uppercase">
            Riskzon {index + 1} av {total}
          </strong>
          <span className="mt-0.5 block text-[8px] font-bold tracking-[0.08em] text-[#a32620] uppercase">
            {positionName(index, total)} i högerkolumnen
          </span>
        </div>
        <div className="flex items-center">
          <button
            className={`grid size-[32px] cursor-pointer place-items-center border-0 bg-transparent text-[#666] hover:bg-[#f0f0f0] hover:text-[#202020] disabled:cursor-not-allowed disabled:opacity-25 ${focusRing}`}
            type="button"
            aria-label={`Flytta riskzon ${index + 1} uppåt`}
            title="Flytta upp i högerkolumnen"
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp size={16} />
          </button>
          <button
            className={`grid size-[32px] cursor-pointer place-items-center border-0 bg-transparent text-[#666] hover:bg-[#f0f0f0] hover:text-[#202020] disabled:cursor-not-allowed disabled:opacity-25 ${focusRing}`}
            type="button"
            aria-label={`Flytta riskzon ${index + 1} nedåt`}
            title="Flytta ner i högerkolumnen"
            disabled={disabled || index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown size={16} />
          </button>
          <button
            className={`grid size-[32px] cursor-pointer place-items-center border-0 bg-transparent text-[#888] hover:bg-[#fff0ef] hover:text-[#d70000] disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
            type="button"
            aria-label={`Ta bort riskzonen ${destination.text}`}
            title={
              canDelete ? "Ta bort riskzon" : "Riskzonen används av en händelse"
            }
            disabled={disabled || !canDelete}
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[46px_minmax(0,1fr)] items-center gap-2.5">
        <button
          className={`grid size-[46px] cursor-pointer place-items-center border border-[#e4c5c2] bg-[#f9eeee] text-[#d70000] hover:border-[#d70000] disabled:cursor-not-allowed ${focusRing}`}
          type="button"
          aria-label={`Byt ikon för ${destination.text}`}
          aria-expanded={iconPickerOpen}
          title="Byt ikon"
          disabled={disabled}
          onClick={() => setIconPickerOpen((open) => !open)}
        >
          {createElement(getMatchingIcon(destination.matchingIconKey), {
            size: 22,
          })}
        </button>
        <label className="grid min-w-0 gap-1 text-[8px] font-extrabold tracking-[0.1em] text-[#777] uppercase">
          Riskzonens namn
          <input
            className={`${barlow} min-w-0 border-0 border-b border-[#d7d7d7] bg-transparent p-0 pb-1 text-[17px] leading-none font-bold text-[#202020] uppercase outline-none focus:border-[#d70000] min-[1600px]:text-[20px]`}
            aria-label={`Namn på riskzon ${index + 1}`}
            value={destination.text}
            maxLength={500}
            disabled={disabled}
            onChange={(event) => onRename(event.target.value)}
          />
        </label>
      </div>

      {iconPickerOpen && (
        <div className="grid grid-cols-3 gap-1.5 border border-[#dedede] bg-[#fafafa] p-2 max-[900px]:grid-cols-2">
          {matchingIconOptions.map(({ key, label, Icon }) => {
            const selected = (destination.matchingIconKey ?? "map-pin") === key;
            return (
              <button
                className={cx(
                  `flex min-h-10 cursor-pointer items-center gap-2 border px-2 text-left text-[9px] font-bold ${focusRing}`,
                  selected
                    ? "border-[#d70000] bg-[#fff0ef] text-[#a32620]"
                    : "border-[#d6d6d6] bg-white text-[#555] hover:border-[#999]",
                )}
                type="button"
                key={key}
                disabled={disabled}
                onClick={() => {
                  onChangeIcon(key);
                  setIconPickerOpen(false);
                }}
              >
                <Icon size={16} /> {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex min-h-10 items-center gap-2 border border-[#e4e4e4] bg-[#f7f7f7] px-3 text-[8px] font-bold tracking-[0.06em] text-[#777] uppercase">
        <Link2 size={14} className="shrink-0 text-[#a32620]" />
        {assignedChallenge ? (
          <span className="min-w-0">
            Rätt svar för{" "}
            <strong className="text-[#a32620]">
              Händelse {assignedChallengeIndex + 1}
            </strong>
            <small className="mt-0.5 block max-w-full break-words font-semibold leading-[1.35] whitespace-normal text-[#888] normal-case">
              {assignedChallenge.prompt}
            </small>
          </span>
        ) : (
          <span>Ingen händelse är kopplad hit</span>
        )}
      </div>

      {selectedChallengeId && !selectedIsAssigned && (
        <button
          className={`inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-1.5 border border-[#d70000] bg-white px-3 text-[8px] font-extrabold tracking-[0.07em] text-[#a32620] uppercase hover:bg-[#fff5f4] ${focusRing}`}
          type="button"
          disabled={disabled}
          onClick={onPlaceSelected}
        >
          <MousePointer2 size={13} /> Koppla vald händelse hit
        </button>
      )}
    </article>
  );
}

