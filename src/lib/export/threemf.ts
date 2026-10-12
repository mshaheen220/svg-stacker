import { strToU8, zipSync } from "fflate";
import type { LevelMesh } from "../geometry/mesh";
import type { SwapCommand } from "../arrangement";
import type { StackLevel, StackResult } from "../geometry/stack";

/**
 * Writes an OrcaSlicer / Bambu Studio project 3MF: one object whose parts
 * are the levels (named in Orca's object list), plus per-layer filament
 * swaps in Metadata/custom_gcode_per_layer.xml.
 *
 * The layout mirrors what OrcaSlicer 2.4 itself writes (see the developer
 * README): a root 3D/3dmodel.model holding one object made of components,
 * which point at per-part meshes in 3D/Objects/object_1.model, and
 * Metadata/model_settings.config naming the object and each part.
 *
 * No project_settings.config is written, so Orca keeps whatever printer,
 * filament and process presets are currently selected.
 */

/**
 * How swaps are embedded:
 *  - "m600": Custom G-code (type 4): M117 message + M600 (firmware filament change).
 *  - "m25": Custom G-code (type 4): M117 message + M25 (pause the SD print).
 *  - "printer-pause": Pause (type 1): the printer profile's machine_pause_gcode.
 *  - "none": nothing embedded; use the color-change table instead.
 * (Orca's ColorChange type 0 is deliberately not used: in OrcaSlicer 2.4 its
 * G-code emission is compiled out, so it would silently do nothing.)
 */
export type { SwapCommand };

export interface ThreeMfOptions {
  objectName: string;
  swap: SwapCommand;
  /** Bed size (mm); the object is centered on it. */
  bed: { x: number; y: number };
  appVersion: string;
}

/** OrcaSlicer CustomGCode::Type values (src/libslic3r/CustomGCode.hpp). */
const GCODE_TYPE = { ColorChange: 0, PausePrint: 1, Custom: 4 } as const;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "&#10;");

/** Compact number formatting for vertices (µm precision, no trailing zeros). */
const n = (v: number) => {
  const r = Math.round(v * 1e4) / 1e4;
  return Object.is(r, -0) ? "0" : String(r);
};

/** Part name as shown in Orca's object list: "3. hair med". */
export const partLabel = (l: StackLevel) => `${l.number}. ${l.name}`;

/** LCD message for a swap: printable ASCII only, short enough for a 20-char-ish display line. */
export function swapMessage(level: StackLevel): string {
  const ascii = `L${level.number} ${level.name}`.replace(/[^\x20-\x7e]/g, "").slice(0, 40);
  return `Load ${ascii}`;
}

export interface SwapEntry {
  level: StackLevel;
  topZ: number;
  type: number;
  extra: string;
  /** What Orca would emit; also written to the legacy `gcode` attribute. */
  gcode: string;
}

/** The custom G-code entries for a stack, one per level that needs a filament swap. */
export function swapEntries(stack: StackResult, swap: SwapCommand): SwapEntry[] {
  if (swap === "none") return [];
  return stack.levels
    .filter((l) => l.swap === "swap")
    .map((level) => {
      const msg = `M117 ${swapMessage(level)}`;
      if (swap === "printer-pause") {
        return { level, topZ: level.firstLayerTopZ, type: GCODE_TYPE.PausePrint, extra: swapMessage(level), gcode: "M25 ;pause print" };
      }
      const cmd = swap === "m600" ? "M600" : "M25";
      const extra = `${msg}\n${cmd}`;
      return { level, topZ: level.firstLayerTopZ, type: GCODE_TYPE.Custom, extra, gcode: extra };
    });
}

export function build3mf(stack: StackResult, meshes: LevelMesh[], opts: ThreeMfOptions): Uint8Array {
  const levels = stack.levels.map((level, i) => ({ level, mesh: meshes[i] })).filter((x) => x.mesh && x.mesh.indices.length > 0);
  if (levels.length === 0) throw new Error("Nothing to export.");

  // Center the footprint on the origin; the build item moves it to bed center.
  const cx = stack.widthMm / 2;
  const cy = stack.heightMm / 2;
  const NS =
    'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"';
  const objectsPath = "/3D/Objects/object_1.model";
  const assemblyId = levels.length + 1;
  const uuid = (prefix: string, i: number) => `${prefix}${i.toString(16).padStart(4, "0")}-81cb-4c03-9d28-80fed5dfa1dc`;

  // ---- 3D/Objects/object_1.model: one mesh object per level ----
  const parts: string[] = [];
  levels.forEach(({ mesh }, i) => {
    const id = i + 1;
    const p = mesh.positions;
    const v: string[] = new Array(p.length / 3);
    for (let k = 0; k < p.length; k += 3) v[k / 3] = `<vertex x="${n(p[k] - cx)}" y="${n(p[k + 1] - cy)}" z="${n(p[k + 2])}"/>`;
    const t: string[] = new Array(mesh.indices.length / 3);
    const ix = mesh.indices;
    for (let k = 0; k < ix.length; k += 3) t[k / 3] = `<triangle v1="${ix[k]}" v2="${ix[k + 1]}" v3="${ix[k + 2]}"/>`;
    parts.push(
      ` <object id="${id}" p:UUID="${uuid("0001", id)}" type="model">\n  <mesh>\n   <vertices>\n${v.join("\n")}\n   </vertices>\n   <triangles>\n${t.join("\n")}\n   </triangles>\n  </mesh>\n </object>`,
    );
  });
  const objectsModel = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" ${NS}>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <resources>
${parts.join("\n")}
 </resources>
 <build/>
</model>
`;

  // ---- 3D/3dmodel.model: the assembly object and its placement ----
  const identity = "1 0 0 0 1 0 0 0 1 0 0 0";
  const placement = `1 0 0 0 1 0 0 0 1 ${n(opts.bed.x / 2)} ${n(opts.bed.y / 2)} 0`;
  const components = levels
    .map((_, i) => `    <component p:path="${objectsPath}" objectid="${i + 1}" p:UUID="${uuid("0002", i + 1)}" transform="${identity}"/>`)
    .join("\n");
  const rootModel = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" ${NS}>
 <metadata name="Application">SVG Stacker ${esc(opts.appVersion)}</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="Title">${esc(opts.objectName)}</metadata>
 <resources>
  <object id="${assemblyId}" p:UUID="${uuid("0003", assemblyId)}" type="model">
   <components>
${components}
   </components>
  </object>
 </resources>
 <build p:UUID="2c7c17d8-22b5-4d84-8835-1976022ea369">
  <item objectid="${assemblyId}" p:UUID="${uuid("0004", assemblyId)}" transform="${placement}" printable="1"/>
 </build>
</model>
`;

  // ---- Metadata/model_settings.config: object + part names ----
  const partSettings = levels
    .map(
      ({ level }, i) => `    <part id="${i + 1}" subtype="normal_part">
      <metadata key="name" value="${esc(partLabel(level))}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="extruder" value="1"/>
      <mesh_stat edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>
    </part>`,
    )
    .join("\n");
  const modelSettings = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="${assemblyId}">
    <metadata key="name" value="${esc(opts.objectName)}"/>
    <metadata key="extruder" value="1"/>
${partSettings}
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>
    <model_instance>
      <metadata key="object_id" value="${assemblyId}"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="1"/>
    </model_instance>
  </plate>
  <assemble>
   <assemble_item object_id="${assemblyId}" instance_id="0" transform="${placement}" offset="0 0 0" />
  </assemble>
</config>
`;

  // ---- Metadata/custom_gcode_per_layer.xml: filament swaps ----
  const swaps = swapEntries(stack, opts.swap)
    .map(
      (s) =>
        `<layer top_z="${n(s.topZ)}" type="${s.type}" extruder="1" color="${esc(s.level.color.toUpperCase())}" extra="${esc(s.extra)}" gcode="${esc(s.gcode)}"/>`,
    )
    .join("\n");
  const customGcode = `<?xml version="1.0" encoding="utf-8"?>
<custom_gcodes_per_layer>
<plate>
<plate_info id="1"/>
${swaps ? swaps + "\n" : ""}<mode value="SingleExtruder"/>
</plate>
</custom_gcodes_per_layer>
`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
 <Default Extension="gcode" ContentType="text/x.gcode"/>
</Types>
`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;
  const modelRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="${objectsPath}" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;

  return zipSync(
    {
      "[Content_Types].xml": strToU8(contentTypes),
      "_rels/.rels": strToU8(rels),
      "3D/3dmodel.model": strToU8(rootModel),
      "3D/_rels/3dmodel.model.rels": strToU8(modelRels),
      "3D/Objects/object_1.model": strToU8(objectsModel),
      "Metadata/model_settings.config": strToU8(modelSettings),
      "Metadata/custom_gcode_per_layer.xml": strToU8(customGcode),
    },
    { level: 6 },
  );
}
