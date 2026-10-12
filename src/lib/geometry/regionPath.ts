import { regionToRings, type Region } from "./region";

/** Region → SVG path data in mm (render with fill-rule nonzero). */
export function regionToD(region: Region): string {
  return regionToRings(region)
    .map((ring) => "M" + ring.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join("L") + "Z")
    .join("");
}
