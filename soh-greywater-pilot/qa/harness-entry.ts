// Early visual harness: renders the seed map to a canvas so the authored world can be inspected.
import { buildSeedProject } from "../src/maplab/seed";
import { drawScene, preset, renderBase } from "../src/maplab/render";
import type { ViewMode } from "../src/maplab/types";

const t0 = performance.now();
const p = buildSeedProject();
const t1 = performance.now();
const base = renderBase(p, 1);
const t2 = performance.now();
const w = window as unknown as Record<string, unknown>;
w.__timing = { seed: t1 - t0, base: t2 - t1 };
w.__project = p;
const cv = document.createElement("canvas");
cv.width = 2000; cv.height = 1400;
cv.style.cssText = "width:2000px;height:1400px;display:block";
document.getElementById("root")!.appendChild(cv);
const ctx = cv.getContext("2d")!;
w.__draw = (mode: ViewMode) => {
  const pr = preset(mode);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawScene(ctx, p, { x: 0, y: 0, s: 1 }, { mode, layers: pr.layers, dim: pr.dim, sel: new Set(), hover: null, gridSize: 100, heat: null, blocked: new Set(), extras: [], ragnarok: false, selVertex: -1, hoverSeg: -1, vw: 2000, vh: 1400 }, base, 1);
};
(w.__draw as (m: ViewMode) => void)("atlas");
w.__ready = true;
