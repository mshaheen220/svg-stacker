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
import { isPartEnabled, partName, PLATE_ID, type Level } from "../../lib/arrangement";
import { planLevels, type LevelPlan } from "../../lib/layers";
import { colorName } from "../../lib/svg/colors";
import type { Part } from "../../lib/parts";
import type { StackLevel } from "../../lib/geometry/stack";
import { useProject } from "../../store/useProject";
import { useStack } from "../../store/useStack";
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
  const { arrangement, parts, moveLevel, movePart, addLevel, reverseLevels } = useProject();
  const partsByKey = useMemo(() => new Map(parts.map((p) => [p.key, p])), [parts]);
  const printed = useMemo(() => new Map(planLevels(arrangement, partsByKey).map((p) => [p.id, p])), [arrangement, partsByKey]);
  const levels = arrangement.levels;
  // "Move…" targets, labelled like the card titles.
  const levelOptions = useMemo(
    () => levels.map((l, i) => ({ id: l.id, label: printed.get(l.id) ? `Level ${printed.get(l.id)!.number}` : `Unprinted (${i + 1} in list)` })),
    [levels, printed],
  );

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-400">
          Bottom (printed first) to top. Drag the ⠿ handles, or use the arrows and “Move…” menus.
        </p>
        <button
          type="button"
          onClick={reverseLevels}
          disabled={levels.length < 2}
          title="Reverse the print order of all levels (the plate stays at the bottom). Press again to undo."
          className="shrink-0 rounded border border-ink-700 px-2 py-0.5 text-xs text-ink-200 hover:border-accent-400 hover:text-ink-50 disabled:opacity-40"
        >
          ⇅ Reverse stack
        </button>
      </div>
      {arrangement.settings.plate.enabled && printed.get(PLATE_ID) && <PlateCard plan={printed.get(PLATE_ID)!} />}
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        accessibility={{ announcements }}
      >
        <SortableContext items={levels.map((l) => L(l.id))} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2" aria-label="Levels, bottom to top">
            {levels.map((level, index) => (
              <LevelCard
                key={level.id}
                level={level}
                index={index}
                count={levels.length}
                partsByKey={partsByKey}
                zRange={printed.get(level.id)}
                levelOptions={levelOptions}
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
  zRange: LevelPlan | undefined;
  levelOptions: LevelOption[];
  onHighlight: (keys: string[] | null) => void;
}

interface LevelOption {
  id: string;
  label: string;
}

function LevelCard({ level, index, count, partsByKey, zRange, levelOptions, onHighlight }: LevelCardProps) {
  const { arrangement, moveLevel, moveLevelToEnd, removeLevel, setLevelThickness } = useProject();
  const stackLevel = useStack((s) => s.result?.levels.find((l) => l.id === level.id));
  const minFeature = 2 * arrangement.settings.nozzle;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: L(level.id) });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: D(level.id) });

  const levelParts = level.partKeys.map((k) => partsByKey.get(k)).filter((p): p is Part => !!p);
  const enabled = levelParts.filter((p) => isPartEnabled(arrangement, p.key));
  const colors = [...new Set(enabled.map((p) => p.color))];
  const isBase = zRange?.number === 1;
  const fallback = isBase || (!zRange && index === 0) ? arrangement.settings.baseThickness : arrangement.settings.defaultThickness;
  const title = zRange ? `Level ${zRange.number}` : `Unprinted level (${index + 1} in list)`;

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
          <IconButton label={`Move ${title} to the bottom of the stack`} disabled={index === 0} onClick={() => moveLevelToEnd(level.id, "bottom")}>
            ⤒
          </IconButton>
          <IconButton label={`Move ${title} toward the base`} disabled={index === 0} onClick={() => moveLevel(index, index - 1)}>
            ↑
          </IconButton>
          <IconButton label={`Move ${title} toward the top`} disabled={index === count - 1} onClick={() => moveLevel(index, index + 1)}>
            ↓
          </IconButton>
          <IconButton label={`Move ${title} to the top of the stack`} disabled={index === count - 1} onClick={() => moveLevelToEnd(level.id, "top")}>
            ⤓
          </IconButton>
          {level.partKeys.length === 0 && (
            <IconButton label={`Delete empty ${title}`} onClick={() => removeLevel(level.id)}>
              ✕
            </IconButton>
          )}
        </span>
        {zRange && <PrintInfo plan={zRange} onFix={(mm) => setLevelThickness(level.id, mm)} />}
        {stackLevel && <LevelWarnings level={stackLevel} minFeature={minFeature} />}
        {colors.length > 1 && (
          <p className="w-full text-xs text-amber-300 day:text-amber-700">
            ⚠ A level prints in one filament. Its parts have {colors.length} colors, so the first color is used.
          </p>
        )}
      </div>
      <SortableContext items={level.partKeys.map(P)} strategy={verticalListSortingStrategy}>
        <ul ref={setDropRef} className={`min-h-9 space-y-1 p-1.5 ${isOver ? "bg-accent-500/10" : ""}`} aria-label={`Parts on ${title}`}>
          {levelParts.map((p) => (
            <PartRow key={p.key} part={p} levelId={level.id} levelOptions={levelOptions} onHighlight={onHighlight} />
          ))}
          {levelParts.length === 0 && <li className="px-2 py-1 text-xs text-ink-500">Drop parts here</li>}
        </ul>
      </SortableContext>
    </li>
  );
}

function PartRow({
  part,
  levelId,
  levelOptions,
  onHighlight,
}: {
  part: Part;
  levelId: string;
  levelOptions: LevelOption[];
  onHighlight: (keys: string[] | null) => void;
}) {
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
        {levelOptions.map((o) =>
          o.id === levelId ? null : (
            <option key={o.id} value={o.id}>
              {o.label}
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

function LevelWarnings({ level, minFeature }: { level: StackLevel; minFeature: number }) {
  const fmt = (a: number) => (a < 10 ? a.toFixed(1) : Math.round(a).toString());
  return (
    <>
      {level.unsupportedAreaMm2 >= 0.01 && (
        <p className="w-full text-xs text-red-400 day:text-red-700">
          ⚠ {fmt(level.unsupportedAreaMm2)} mm² has nothing underneath and will float. Turn on support fill or reorder.
        </p>
      )}
      {level.thinAreaMm2 > 0 && (
        <p className="w-full text-xs text-amber-300 day:text-amber-700">
          ⚠ {fmt(level.thinAreaMm2)} mm² is thinner than {minFeature.toFixed(2)} mm and may not print (red in the preview).
        </p>
      )}
    </>
  );
}

function PlateCard({ plan }: { plan: LevelPlan }) {
  const { arrangement } = useProject();
  const stackLevel = useStack((s) => s.result?.levels.find((l) => l.isPlate));
  const { plate, nozzle } = arrangement.settings;
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/70 px-2 py-1.5" aria-label="Level 1, background plate">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden className="h-4 w-4 rounded-sm border border-ink-600" style={{ background: plate.color }} />
        <span className="text-sm font-medium">
          Level 1 <span className="text-xs font-normal text-ink-400">(plate)</span>
        </span>
        <span className="text-xs text-ink-400">
          Z {plan.zStart.toFixed(2)}–{plan.zEnd.toFixed(2)}
        </span>
        <span className="ml-auto text-xs text-ink-400">margin {plate.margin} mm · set in Support &amp; size</span>
        <PrintInfo plan={plan} />
        {stackLevel && <LevelWarnings level={stackLevel} minFeature={2 * nozzle} />}
      </div>
    </div>
  );
}

/**
 * Layer range, the filament swap before this level, snapping notes, and
 * the opacity check (with a one-click fix).
 */
function PrintInfo({ plan, onFix }: { plan: LevelPlan; onFix?: (mm: number) => void }) {
  const layers =
    Number.isInteger(plan.layerCount) || Math.abs(plan.layerCount - Math.round(plan.layerCount)) < 1e-6
      ? `layers ${plan.layerStart}–${plan.layerStart + Math.round(plan.layerCount) - 1} (${Math.round(plan.layerCount)})`
      : `≈${plan.layerCount.toFixed(1)} layers from ${plan.layerStart}`;
  const snapped = Math.abs(plan.requested - plan.thickness) > 1e-6;
  const name = `${colorName(plan.color)} ${plan.color}`;
  return (
    <>
      <p className="w-full text-xs text-ink-400">
        {layers}
        {snapped && (
          <span title="Rounded to whole layers">
            {" "}
            · {plan.requested.toFixed(2)} → {plan.thickness.toFixed(2)} mm
          </span>
        )}
        {" · "}
        {plan.swap === "start" && <span>load {name} to start</span>}
        {plan.swap === "swap" && (
          <span className="text-accent-300">
            ⇄ swap to {name} before layer {plan.layerStart}
          </span>
        )}
        {plan.swap === "same" && <span>same filament as below, no swap</span>}
      </p>
      {!plan.aligned && (
        <p className="w-full text-xs text-amber-300 day:text-amber-700">
          ⚠ Starts mid-layer (Z {plan.zStart.toFixed(2)}), so the color change can’t happen exactly here. Turn on “Whole layers only”.
        </p>
      )}
      {plan.showThrough && plan.minOpaque != null && (
        <p className="flex w-full items-center gap-2 text-xs text-amber-300 day:text-amber-700">
          <span>
            ⚠ {plan.thickness.toFixed(2)} mm of {colorName(plan.color)} may let the {colorName(plan.belowColor!)} below show through;
            needs {plan.minOpaque.toFixed(2)} mm.
          </span>
          {onFix && (
            <button
              type="button"
              onClick={() => onFix(plan.minOpaque!)}
              className="shrink-0 rounded border border-amber-500/50 px-1.5 py-0.5 hover:bg-amber-500/10"
              aria-label={`Raise level ${plan.number} to ${plan.minOpaque.toFixed(2)} mm`}
            >
              Fix
            </button>
          )}
        </p>
      )}
    </>
  );
}

