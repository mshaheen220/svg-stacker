import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, type ReactNode } from "react";
import { isPartEnabled, partName, printedLevels, type Level } from "../../lib/arrangement";
import type { Part } from "../../lib/parts";
import { useProject } from "../../store/useProject";
import { ThicknessInput } from "./ThicknessInput";

// dnd-kit ids are prefixed so levels and parts share one DndContext:
//   L:<levelId>  sortable level card
//   P:<partKey>  sortable part row
//   D:<levelId>  drop zone covering a level's part list (works when empty)
const L = (id: string) => `L:${id}`;
const P = (key: string) => `P:${key}`;
const D = (id: string) => `D:${id}`;
const kind = (id: UniqueIdentifier) => String(id).slice(0, 1);
const rest = (id: UniqueIdentifier) => String(id).slice(2);

/** Which droppables an item of the given type may land on. */
const accepts = (activeId: UniqueIdentifier, targetId: UniqueIdentifier) =>
  kind(activeId) === "L" ? kind(targetId) === "L" : kind(targetId) === "P" || kind(targetId) === "D";

// The stock keyboard getter considers every droppable, so arrowing a level
// "down" just lands on a part row inside the same card. Restrict it to the
// same targets pointer dragging allows.
const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { active, droppableContainers } = args.context;
  if (!active) return sortableKeyboardCoordinates(event, args);
  const filtered = {
    getEnabled: () => droppableContainers.getEnabled().filter((c) => accepts(active.id, c.id)),
    get: (id: UniqueIdentifier) => droppableContainers.get(id),
  } as unknown as typeof droppableContainers;
  return sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, droppableContainers: filtered } });
};

interface Props {
  onHighlight: (keys: string[] | null) => void;
}

export function LevelEditor({ onHighlight }: Props) {
  const { arrangement, parts, moveLevel, movePart, addLevel } = useProject();
  const partsByKey = useMemo(() => new Map(parts.map((p) => [p.key, p])), [parts]);
  const printed = useMemo(() => new Map(printedLevels(arrangement).map((p) => [p.level.id, p])), [arrangement]);
  const levels = arrangement.levels;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );

  const levelOfPart = (key: string) => levels.find((l) => l.partKeys.includes(key));
  const nameOf = (id: UniqueIdentifier) => {
    if (kind(id) === "P") {
      const p = partsByKey.get(rest(id));
      return p ? `part ${partName(arrangement, p)}` : "part";
    }
    const idx = levels.findIndex((l) => l.id === rest(id));
    return `level ${idx + 1}`;
  };

  // Levels only collide with levels; parts with parts and level drop zones.
  const collision: CollisionDetection = (args) =>
    closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => accepts(args.active.id, c.id)) });

  // Moving a part into another level happens live while dragging, so the
  // destination list opens up a slot for it.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || kind(active.id) !== "P") return;
    const key = rest(active.id);
    const from = levelOfPart(key);
    const target = kind(over.id) === "D" ? levels.find((l) => l.id === rest(over.id)) : levelOfPart(rest(over.id));
    if (!target || target.id === from?.id) return;
    const index = kind(over.id) === "P" ? target.partKeys.indexOf(rest(over.id)) : target.partKeys.length;
    movePart(key, target.id, index);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    if (kind(active.id) === "L") {
      const from = levels.findIndex((l) => l.id === rest(active.id));
      const to = levels.findIndex((l) => l.id === rest(over.id));
      if (from >= 0 && to >= 0) moveLevel(from, to);
    } else if (kind(over.id) === "P") {
      const level = levelOfPart(rest(over.id));
      if (level) movePart(rest(active.id), level.id, level.partKeys.indexOf(rest(over.id)));
    }
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} is over ${nameOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Dropped ${nameOf(active.id)} at ${nameOf(over.id)}.` : `Dropped ${nameOf(active.id)}.`),
    onDragCancel: ({ active }) => `Cancelled moving ${nameOf(active.id)}.`,
  };

  if (parts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-400">
        Bottom (printed first) to top. Drag the ⠿ handles, or use the arrows and “Move to” menus.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        accessibility={{ announcements }}
      >
        <SortableContext items={levels.map((l) => L(l.id))} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2" aria-label="Levels, bottom to top">
            {levels.map((level, i) => (
              <LevelCard
                key={level.id}
                level={level}
                index={i}
                count={levels.length}
                partsByKey={partsByKey}
                zRange={printed.get(level.id)}
                onHighlight={onHighlight}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={addLevel}
        className="w-full rounded border border-dashed border-ink-700 py-1.5 text-sm text-ink-300 hover:border-accent-400 hover:text-ink-100"
      >
        + Add empty level on top
      </button>
    </div>
  );
}

interface LevelCardProps {
  level: Level;
  index: number;
  count: number;
  partsByKey: Map<string, Part>;
  zRange: ReturnType<typeof printedLevels>[number] | undefined;
  onHighlight: (keys: string[] | null) => void;
}

function LevelCard({ level, index, count, partsByKey, zRange, onHighlight }: LevelCardProps) {
  const { arrangement, moveLevel, removeLevel, setLevelThickness } = useProject();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: L(level.id) });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: D(level.id) });

  const levelParts = level.partKeys.map((k) => partsByKey.get(k)).filter((p): p is Part => !!p);
  const enabled = levelParts.filter((p) => isPartEnabled(arrangement, p.key));
  const colors = [...new Set(enabled.map((p) => p.color))];
  const isBase = zRange?.number === 1;
  const fallback = isBase || (!zRange && index === 0) ? arrangement.settings.baseThickness : arrangement.settings.defaultThickness;
  const title = `Level ${index + 1}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`rounded-lg border bg-ink-900/70 ${isDragging ? "z-10 border-accent-400 shadow-lg" : "border-ink-800"} ${
        zRange ? "" : "opacity-60"
      }`}
      aria-label={title}
    >
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-ink-800 px-2 py-1.5"
        onMouseEnter={() => onHighlight(enabled.map((p) => p.key))}
        onMouseLeave={() => onHighlight(null)}
      >
        <DragHandle label={`Reorder ${title}`} setRef={setActivatorNodeRef} {...attributes} {...listeners} />
        <span className="flex gap-0.5" aria-hidden>
          {colors.map((c) => (
            <span key={c} className="h-4 w-4 rounded-sm border border-ink-600" style={{ background: c }} />
          ))}
        </span>
        <span className="text-sm font-medium">
          {title}
          {isBase && <span className="ml-1 text-xs font-normal text-ink-400">(base)</span>}
        </span>
        <span className="text-xs text-ink-400">
          {zRange ? `Z ${zRange.zStart.toFixed(2)}–${zRange.zEnd.toFixed(2)}` : "not printed"}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <ThicknessInput
            label={`${title} thickness`}
            value={level.thickness}
            fallback={fallback}
            onChange={(mm) => setLevelThickness(level.id, mm)}
          />
          <IconButton label={`Move ${title} toward the base`} disabled={index === 0} onClick={() => moveLevel(index, index - 1)}>
            ↑
          </IconButton>
          <IconButton label={`Move ${title} toward the top`} disabled={index === count - 1} onClick={() => moveLevel(index, index + 1)}>
            ↓
          </IconButton>
          {level.partKeys.length === 0 && (
            <IconButton label={`Delete empty ${title}`} onClick={() => removeLevel(level.id)}>
              ✕
            </IconButton>
          )}
        </span>
        {colors.length > 1 && (
          <p className="w-full text-xs text-amber-300 day:text-amber-700">
            ⚠ A level prints in one filament. Its parts have {colors.length} colors, so the first color is used.
          </p>
        )}
      </div>
      <SortableContext items={level.partKeys.map(P)} strategy={verticalListSortingStrategy}>
        <ul ref={setDropRef} className={`min-h-9 space-y-1 p-1.5 ${isOver ? "bg-accent-500/10" : ""}`} aria-label={`Parts on ${title}`}>
          {levelParts.map((p) => (
            <PartRow key={p.key} part={p} levelIndex={index} onHighlight={onHighlight} />
          ))}
          {levelParts.length === 0 && <li className="px-2 py-1 text-xs text-ink-500">Drop parts here</li>}
        </ul>
      </SortableContext>
    </li>
  );
}

function PartRow({ part, levelIndex, onHighlight }: { part: Part; levelIndex: number; onHighlight: (keys: string[] | null) => void }) {
  const { arrangement, renamePart, setPartEnabled, movePart } = useProject();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: P(part.key) });
  const enabled = isPartEnabled(arrangement, part.key);
  const name = partName(arrangement, part);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onMouseEnter={() => onHighlight([part.key])}
      onMouseLeave={() => onHighlight(null)}
      className={`flex items-center gap-1.5 rounded border px-1.5 py-1 ${
        isDragging ? "relative z-10 border-accent-400 bg-ink-800" : "border-ink-800 bg-ink-950/60"
      }`}
    >
      <DragHandle label={`Move part ${name}`} setRef={setActivatorNodeRef} {...attributes} {...listeners} />
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => setPartEnabled(part.key, e.target.checked)}
        aria-label={`Include ${name} in the print`}
        title="Include in print"
      />
      <span aria-hidden className="h-4 w-4 shrink-0 rounded-sm border border-ink-600" style={{ background: part.color }} title={part.color} />
      <input
        type="text"
        value={arrangement.parts[part.key]?.name ?? ""}
        placeholder={part.defaultName}
        onChange={(e) => renamePart(part.key, e.target.value)}
        onFocus={() => onHighlight([part.key])}
        onBlur={() => onHighlight(null)}
        aria-label={`Name for ${part.defaultName}`}
        className={`min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm placeholder:text-ink-200 hover:border-ink-700 focus:border-accent-400 focus:outline-none ${
          enabled ? "" : "line-through opacity-50"
        }`}
      />
      <select
        aria-label={`Move ${name} to level`}
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v) movePart(part.key, v);
        }}
        className="w-16 shrink-0 rounded border border-ink-700 bg-ink-900 px-0.5 py-0.5 text-xs text-ink-300"
      >
        <option value="">Move…</option>
        {arrangement.levels.map((l, i) =>
          i === levelIndex ? null : (
            <option key={l.id} value={l.id}>
              Level {i + 1}
            </option>
          ),
        )}
        <option value="new-top">New level on top</option>
        <option value="new-bottom">New level at bottom</option>
      </select>
    </li>
  );
}

function DragHandle({ label, setRef, ...props }: { label: string; setRef: (el: HTMLElement | null) => void } & Record<string, unknown>) {
  return (
    <button
      type="button"
      ref={setRef}
      aria-label={label}
      title="Drag to reorder (or focus and press Space, then arrow keys)"
      className="cursor-grab touch-none rounded px-0.5 text-ink-400 hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-accent-400 active:cursor-grabbing"
      {...props}
    >
      ⠿
    </button>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded px-1 text-sm text-ink-300 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
