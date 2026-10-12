import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type { LevelMesh } from "../../lib/geometry/mesh";
import type { StackLevel } from "../../lib/geometry/stack";
import { useTheme } from "../../hooks/useTheme";
import { useProject } from "../../store/useProject";
import { useStack } from "../../store/useStack";
import { useView } from "../../store/useView";
import { NumberSlider } from "../controls/NumberSlider";
import { LevelScrubber } from "./LevelScrubber";

/** PLA, for a rough filament estimate. */
const PLA_G_PER_MM3 = 1.24 / 1000;

interface Props {
  /** Part keys to emphasize (others are dimmed), or null. */
  highlighted: string[] | null;
}

/**
 * The stacked print in 3D: the exact watertight meshes that get exported,
 * one color per level, with the shared level slider and an exploded view.
 */
export function Preview3D({ highlighted }: Props) {
  const { result, meshes, meshesPending } = useStack();
  const arrangement = useProject((s) => s.arrangement);
  const { shownLevels, explode, setExplode } = useView();
  const { resolved } = useTheme();
  const [viewKey, setViewKey] = useState(0);

  if (!result || result.levels.length === 0) {
    return <Placeholder text="Nothing to show yet." />;
  }
  const visible = Math.min(shownLevels ?? result.levels.length, result.levels.length);
  const hiLevels = new Set(
    highlighted?.length ? arrangement.levels.filter((l) => l.partKeys.some((k) => highlighted.includes(k))).map((l) => l.id) : [],
  );
  const size = Math.max(result.widthMm, result.heightMm);
  const totalZ = result.heightZ + explode * (visible - 1);
  const totalGrams = (meshes ?? []).reduce((g, m) => g + m.volumeMm3 * PLA_G_PER_MM3, 0);

  return (
    <div className="flex h-full flex-col">
      <LevelScrubber />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pb-2 text-xs text-ink-400">
        <div className="w-56">
          <NumberSlider label="Explode" value={explode} min={0} max={10} step={0.5} unit="mm" onChange={setExplode} />
        </div>
        <button
          type="button"
          onClick={() => setViewKey((k) => k + 1)}
          className="rounded border border-ink-700 px-2 py-1 text-ink-200 hover:border-ink-500 hover:text-ink-50"
        >
          Reset view
        </button>
        <span aria-live="polite">
          {meshesPending ? (
            <span className="text-accent-300">building meshes…</span>
          ) : (
            meshes && `${result.widthMm.toFixed(1)} × ${result.heightMm.toFixed(1)} × ${result.heightZ.toFixed(2)} mm · ≈${totalGrams.toFixed(0)} g PLA`
          )}
        </span>
      </div>
      <div
        className="relative min-h-[50vh] flex-1 overflow-hidden rounded-lg border border-ink-800"
        role="img"
        aria-label={`3D preview of ${visible} of ${result.levels.length} levels. Drag to orbit, scroll to zoom, right-drag to pan.`}
      >
        {meshes && (
          <Canvas key={viewKey} camera={{ position: [size * 0.1, size * 1.15, size * 1.05], fov: 40, near: 0.5, far: size * 20 }} dpr={[1, 2]}>
            <color attach="background" args={[resolved === "day" ? "#eeedf6" : "#14131f"]} />
            <hemisphereLight args={["#ffffff", "#444455", 1.4]} />
            <directionalLight position={[size, size * 1.5, size]} intensity={1.6} />
            <directionalLight position={[-size, size * 0.6, -size * 0.5]} intensity={0.5} />
            {/* Print coords are Z-up; rotate into three's Y-up and center the footprint. */}
            <group rotation={[-Math.PI / 2, 0, 0]} position={[-result.widthMm / 2, 0, result.heightMm / 2]}>
              {result.levels.slice(0, visible).map((level, i) =>
                meshes[i] ? (
                  <LevelMeshView
                    key={level.id}
                    level={level}
                    mesh={meshes[i]}
                    offsetZ={i * explode}
                    dimmed={hiLevels.size > 0 && !hiLevels.has(level.id)}
                  />
                ) : null,
              )}
            </group>
            <Grid
              args={[size * 2, size * 2]}
              cellSize={5}
              sectionSize={50}
              cellColor={resolved === "day" ? "#c9c5e0" : "#2b2840"}
              sectionColor={resolved === "day" ? "#a49fc6" : "#4a456b"}
              fadeDistance={size * 3}
              position={[0, -0.01, 0]}
            />
            <OrbitControls makeDefault target={[0, totalZ / 2, 0]} enableDamping />
          </Canvas>
        )}
        {!meshes && <Placeholder text="Building meshes…" />}
        <Legend levels={result.levels.slice(0, visible)} meshes={meshes} />
      </div>
    </div>
  );
}

function LevelMeshView({ level, mesh, offsetZ, dimmed }: { level: StackLevel; mesh: LevelMesh; offsetZ: number; dimmed: boolean }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(mesh.positions, 3));
    g.setIndex(new BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
  }, [mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={[0, 0, offsetZ]}>
      {/* flatShading: manifold shares vertices between top and side faces, so
          smooth normals would blur the crisp level edges. */}
      <meshStandardMaterial color={level.color} flatShading roughness={0.75} metalness={0} transparent={dimmed} opacity={dimmed ? 0.15 : 1} />
    </mesh>
  );
}

function Legend({ levels, meshes }: { levels: StackLevel[]; meshes: LevelMesh[] | null }) {
  return (
    <ol
      className="pointer-events-none absolute right-2 top-2 hidden max-h-[calc(100%-1rem)] space-y-0.5 overflow-hidden rounded bg-ink-950/80 p-2 text-xs sm:block"
      aria-label="Levels shown"
    >
      {[...levels].reverse().map((l) => {
        const vol = meshes?.find((m) => m.id === l.id)?.volumeMm3;
        return (
          <li key={l.id} className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm border border-ink-600" style={{ background: l.color }} />
            <span className="max-w-40 truncate">
              {l.number}. {l.name}
            </span>
            <span className="ml-auto pl-2 text-ink-400">{vol != null ? formatGrams(vol * PLA_G_PER_MM3) : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Placeholder({ text }: { text: string }) {
  return <div className="flex h-full min-h-[40vh] items-center justify-center text-sm text-ink-400">{text}</div>;
}

const formatGrams = (g: number) => (g < 0.1 ? "<0.1 g" : `${g.toFixed(1)} g`);
