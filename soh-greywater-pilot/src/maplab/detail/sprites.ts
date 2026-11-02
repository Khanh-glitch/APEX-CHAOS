/* eslint-disable */
// Village sprite set for the Greywater POI detail layer.
//
// DIRECT REUSE (copied from the original prototype `src/game/art.ts`):
//   floor_wood, floor_stone, wall_wood/stone/brick, door_wood/iron, roof_*,
//   the oak / pine / willow / bush tree painters and `reeds`.
// NEWLY AUTHORED, same grammar: every village prop and interior furnishing
// below (well, notice, signpost, bench, stall, lantern, haystack, cart,
// woodpile, stump, log, garden, laundry, anvil, trough, bed, table, …).
// They are painted with the prototype's own primitives (`mk`, `ell`, `shade`,
// `R`, `P`) at the same 1px scale, and get the same 1px automatic outline.

import { ell, buildHero, mk, P, R, shade, type G, type Sprite } from "./proto-art";
import { hash2 } from "../geom";

export interface SpriteSet {
  floor: Record<string, Sprite>;
  wall: Record<string, Sprite>;
  door: Record<string, Sprite>;
  roof: Record<string, Sprite>;
  tree: Record<string, Sprite[]>;
  prop: Record<string, Sprite[]>;
  item: Record<string, Sprite>;
  hero: Record<string, Sprite[]>;
}

let SET: SpriteSet | null = null;
export function getVillageArt(): SpriteSet {
  return SET || (SET = buildVillageArt());
}

function buildVillageArt(): SpriteSet {
  const floor: Record<string, Sprite> = {};
  // ---- reused: prototype floors ----
  floor.wood = mk(16, 16, (g) => { for (let y = 0; y < 16; y += 4) { R(g, 0, y, 16, 4, y % 8 ? "#9a6a3e" : "#8a5e36"); R(g, 0, y + 3, 16, 1, "#5a3a22"); P(g, (y * 5) % 16, y + 1, "#b0804a"); } }, null);
  floor.stone = mk(16, 16, (g) => {
    R(g, 0, 0, 16, 16, "#8a8a90");
    for (const [x, y, w, h] of [[0, 0, 8, 8], [8, 0, 8, 8], [0, 8, 8, 8], [8, 8, 8, 8]]) {
      R(g, x, y, w, 1, "#a8a8b0"); R(g, x, y + h - 1, w, 1, "#5e5e66"); R(g, x + w - 1, y, 1, h, "#6a6a72");
    }
  }, null);

  // ---- reused: prototype walls (16x24, top strip + face) ----
  const wall = (top: string, face: string, line: string, kind: string) => mk(16, 24, (g) => {
    R(g, 0, 0, 16, 10, top); R(g, 0, 10, 16, 14, face);
    if (kind === "wood") { for (let x = 0; x < 16; x += 4) { R(g, x, 0, 1, 24, line); R(g, x + 1, 0, 1, 10, "#b08050"); P(g, x + 2, 1, "#c89a60"); } R(g, 0, 15, 16, 1, line); }
    if (kind === "stone") { for (let y = 10; y < 24; y += 4) { R(g, 0, y, 16, 1, line); for (let x = (y % 8 ? 0 : 4); x < 16; x += 8) R(g, x, y, 1, 4, line); } R(g, 0, 0, 16, 1, "#c0c0c8"); }
    if (kind === "brick") { for (let y = 10; y < 24; y += 3) { R(g, 0, y, 16, 1, line); for (let x = (y % 6 ? 0 : 3); x < 16; x += 6) R(g, x, y, 1, 3, line); } R(g, 0, 0, 16, 1, "#e09a7a"); }
    R(g, 0, 9, 16, 1, "rgba(0,0,0,0.35)");
  });
  const wallSet: Record<string, Sprite> = {};
  wallSet.wood = wall("#8a5e36", "#7a5230", "#4a2e1a", "wood");
  wallSet.stone = wall("#9a9aa2", "#7a7a82", "#55555e", "stone");
  wallSet.brick = wall("#b0624a", "#9a4e3a", "#5a2a1e", "brick");

  // ---- reused: prototype doors ----
  const door = (c: string, band: string, open: boolean) => mk(16, 24, (g) => {
    R(g, 0, 0, 16, 10, "#5a3a22");
    if (open) { R(g, 0, 10, 2, 14, c); R(g, 14, 10, 2, 14, c); R(g, 2, 10, 12, 14, "rgba(20,12,20,0.6)"); }
    else { R(g, 1, 8, 14, 16, c); R(g, 1, 12, 14, 1, band); R(g, 1, 19, 14, 1, band); P(g, 12, 16, "#e0c060"); R(g, 7, 8, 1, 16, "rgba(0,0,0,0.3)"); }
  });
  const doorSet: Record<string, Sprite> = {};
  doorSet.wood = door("#9a6a3e", "#4a4e56", false);
  doorSet.wood_open = door("#9a6a3e", "#4a4e56", true);
  doorSet.iron = door("#6a7280", "#3a3e46", false);
  doorSet.iron_open = door("#6a7280", "#3a3e46", true);

  // ---- reused: prototype roof tiles ----
  const roof: Record<string, Sprite> = {};
  roof.thatch = mk(16, 16, (g) => { for (let y = 0; y < 16; y += 3) { R(g, 0, y, 16, 3, y % 6 ? "#c8a050" : "#b08a40"); for (let x = (y % 6 ? 1 : 3); x < 16; x += 4) P(g, x, y + 2, "#8a6a2a"); } }, null);
  roof.tile = mk(16, 16, (g) => { for (let y = 0; y < 16; y += 4) for (let x = (y % 8 ? 0 : 2); x < 16; x += 4) { R(g, x, y, 4, 4, "#a84a32"); R(g, x, y + 3, 4, 1, "#6a2a1e"); P(g, x + 1, y, "#d07a5a"); } }, null);
  roof.tin = mk(16, 16, (g) => { R(g, 0, 0, 16, 16, "#7a8288"); for (let x = 0; x < 16; x += 3) R(g, x, 0, 1, 16, "#5a6268"); for (let k = 0; k < 6; k++) P(g, (hash2(k, 1, 3) * 16) | 0, (hash2(k, 2, 3) * 16) | 0, "#a0602a"); }, null);
  roof.wood = mk(16, 16, (g) => { for (let y = 0; y < 16; y += 2) R(g, 0, y, 16, 2, y % 4 ? "#7a5230" : "#6a4426"); for (let x = 0; x < 16; x += 5) R(g, x, 0, 1, 16, "#4a2e1a"); }, null);

  // ---- reused: prototype trees ----
  const tree: Record<string, Sprite[]> = {};
  tree.oak = [0, 1, 2].map((v) => mk(24, 32, (g) => oak(g, v)));
  tree.pine = [0, 1].map((v) => mk(24, 32, (g) => pine(g, v)));
  tree.willow = [0, 1].map((v) => mk(24, 32, (g) => willow(g, v)));
  tree.bush = [0, 1].map((v) => mk(16, 16, (g) => bush(g, v)));

  // ---- village props ----
  const prop: Record<string, Sprite[]> = {};
  prop.well = [mk(24, 32, (g) => well(g))];
  prop.crate = [0, 1].map((v) => mk(16, 16, (g) => crate(g, v)));
  prop.barrel = [mk(14, 18, (g) => barrel(g))];
  prop.notice = [mk(20, 26, (g) => notice(g))];
  prop.signpost = [mk(18, 30, (g) => signpost(g))];
  prop.bench = [mk(22, 14, (g) => bench(g))];
  prop.stall = [0, 1].map((v) => mk(26, 28, (g) => stall(g, v)));
  prop.lantern = [mk(12, 26, (g) => lantern(g))];
  prop.haystack = [mk(22, 22, (g) => haystack(g))];
  prop.cart = [mk(28, 22, (g) => cart(g))];
  prop.woodpile = [mk(20, 16, (g) => woodpile(g, 20, 16))];
  prop.stump = [mk(16, 12, (g) => { ell(g, 8, 8, 5, 3, shade("#7a5232", "#c9935a", "#4a2e1a", 3)); R(g, 3, 8, 10, 3, "#6a4426"); P(g, 8, 7, "#8a5a32"); })];
  prop.log = [mk(22, 12, (g) => { R(g, 2, 5, 18, 6, "#6a4426"); R(g, 2, 5, 18, 1, "#a07040"); ell(g, 20, 8, 2.5, 3, "#c9935a"); P(g, 20, 7, "#8a5a32"); for (let x = 5; x < 18; x += 4) R(g, x, 6, 1, 4, "#4a2e1a"); })];
  prop.reeds = [0, 1].map((v) => mk(16, 16, (g) => reeds(g, v), null));
  prop.garden = [0, 1].map((v) => mk(16, 16, (g) => garden(g, v), null));
  prop.laundry = [mk(26, 24, (g) => laundry(g))];
  prop.anvil = [mk(16, 14, (g) => anvil(g))];
  prop.trough = [mk(20, 12, (g) => trough(g))];

  // ---- interiors ----
  prop.bed = [mk(16, 22, (g) => bed(g))];
  prop.table = [mk(18, 14, (g) => table(g))];
  prop.stool = [mk(10, 10, (g) => { R(g, 2, 2, 6, 3, "#a8763f"); R(g, 2, 2, 6, 1, "#c9935a"); R(g, 2, 5, 1, 4, "#5a3a22"); R(g, 7, 5, 1, 4, "#5a3a22"); })];
  prop.hearth = [mk(16, 16, (g) => hearth(g))];
  prop.shelf = [mk(16, 18, (g) => shelf(g))];
  prop.chest = [mk(16, 14, (g) => chest(g))];
  prop.forge = [mk(18, 20, (g) => forge(g))];
  prop.anvil_i = [mk(16, 14, (g) => anvil(g))];
  prop.hay = [mk(16, 12, (g) => { ell(g, 8, 8, 7, 4, shade("#c8a050", "#e8c878", "#8a6a2a", 4)); for (let x = 2; x < 14; x += 3) P(g, x, 7 + (x % 2), "#8a6a2a"); })];
  prop.sack = [mk(12, 12, (g) => { ell(g, 6, 7, 5, 4, shade("#c8b088", "#e0d0a8", "#8a7a58", 6)); R(g, 4, 2, 4, 2, "#a89068"); P(g, 5, 3, "#6a5a3a"); })];
  prop.tub = [mk(16, 14, (g) => { R(g, 1, 4, 14, 8, "#6a4426"); R(g, 1, 4, 14, 2, "#8a5a32"); R(g, 3, 6, 10, 4, "#2e6ea0"); R(g, 3, 6, 10, 1, "#6ab0d8"); for (const x of [2, 13]) R(g, x, 4, 1, 8, "#4a2e1a"); })];
  prop.pot = [mk(10, 10, (g) => { ell(g, 5, 6, 3.5, 3, "#8a5a32"); R(g, 3, 2, 4, 2, "#a8763f"); P(g, 4, 5, "#c9935a"); })];
  prop.woodpile_i = [mk(18, 14, (g) => woodpile(g, 18, 14))];

  return {
    floor,
    wall: wallSet,
    door: doorSet,
    roof,
    tree,
    prop,
    item: {},
    hero: buildHero(false) as unknown as Record<string, Sprite[]>,
  };
}

// ================= direct prototype tree painters =================
function oak(g: G, v: number) {
  R(g, 10, 22, 4, 9, "#5a3a22"); R(g, 12, 22, 2, 9, "#7a5232"); P(g, 9, 30, "#5a3a22"); P(g, 14, 30, "#5a3a22");
  const blobs = [[12, 12, 9], [6 + v, 15, 5], [18 - v, 15, 5], [12, 6, 6], [8, 9, 5], [16, 9, 5]];
  for (const [x, y, r] of blobs) ell(g, x, y, r, r * 0.85, shade("#3f7a32", "#6aa84a", "#24501e", x * 7 + y + v));
  for (let k = 0; k < 14; k++) {
    const x = (4 + hash2(k, v, 1) * 16) | 0, y = (3 + hash2(k, v, 2) * 16) | 0;
    if (g.getImageData(x, y, 1, 1).data[3]) P(g, x, y, hash2(k, v, 3) > 0.5 ? "#8ac25a" : "#2d5a27");
  }
}
function pine(g: G, v: number) {
  R(g, 11, 26, 3, 6, "#4a2e1a");
  for (let tier = 0; tier < 4; tier++) {
    const y0 = 3 + tier * 6, w = 4 + tier * 2.4;
    for (let y = 0; y < 8; y++) {
      const hw = (y / 8) * w;
      for (let x = Math.round(12 - hw); x <= Math.round(12 + hw); x++) {
        const nx = (x - 12) / (w + 0.1);
        P(g, x, y0 + y, nx < -0.3 ? "#4a8a4a" : nx > 0.35 ? "#1e4628" : "#2e6a3a");
      }
    }
  }
  for (let k = 0; k < 4; k++) P(g, (10 + hash2(k, v, 4) * 4) | 0, 8 + k * 4, "#3f7a32");
}
function willow(g: G, v: number) {
  R(g, 10, 20, 4, 11, "#4a3a26"); ell(g, 12, 10, 10, 8, shade("#4a6a3a", "#7a9a5a", "#2a3a22", v));
  for (let x = 3; x < 22; x += 2) { const l = 8 + ((hash2(x, v, 5) * 10) | 0); for (let y = 12; y < 12 + l; y++) P(g, x, y, y % 2 ? "#5a7a42" : "#3a5a2e"); }
}
function bush(g: G, v: number) {
  ell(g, 8, 10, 7, 5, shade("#3f7a32", "#6aa84a", "#24501e", 50 + v));
  ell(g, 5, 8, 3.5, 3, shade("#4a8a3a", "#7ab85a", "#2a5a22", 51 + v));
  for (let k = 0; k < 5; k++) { const x = (3 + hash2(k, v, 8) * 10) | 0, y = (6 + hash2(k, v, 9) * 7) | 0; P(g, x, y, "#e03a5a"); P(g, x, y - 1, "#ff8aa0"); }
}
function reeds(g: G, v: number) {
  for (let k = 0; k < 9; k++) {
    const x = 3 + k + ((hash2(k, v, 10) * 2) | 0), h = 4 + ((hash2(k, v, 11) * 6) | 0);
    for (let y = 0; y < h; y++) P(g, x + (y > h - 3 ? (k % 2 ? 1 : -1) : 0), 14 - y, ["#5a9a3c", "#8ac258", "#3f7a32"][(k + y) % 3]);
  }
  for (let k = 0; k < 3; k++) R(g, 4 + k * 4, 3 + k, 1, 3, "#7a4a2a");
}

// ================= new village props =================
function well(g: G) {
  // peaked shingle roof
  for (let y = 0; y < 7; y++) {
    const w = 2 + y;
    R(g, 12 - w, y + 1, w * 2, 1, y % 2 ? "#8a5a32" : "#a06a3a");
  }
  R(g, 2, 7, 20, 2, "#5a3a22"); R(g, 3, 7, 18, 1, "#c8a050");
  // posts
  R(g, 4, 8, 2, 14, "#6a4426"); R(g, 5, 8, 1, 14, "#8a5a32");
  R(g, 18, 8, 2, 14, "#6a4426"); R(g, 18, 8, 1, 14, "#8a5a32");
  // stone ring
  ell(g, 12, 24, 8, 4.5, shade("#8a8a90", "#b0b0b8", "#5e5e66", 7));
  ell(g, 12, 22.5, 6, 3, "#3a5a6a");
  ell(g, 12, 22.5, 4.2, 2, "#2a4a5a");
  P(g, 9, 21, "#7ab0c8"); P(g, 14, 23, "#6aa0b8");
  for (const [x, y] of [[7, 24], [10, 26], [14, 25], [16, 23], [8, 22]]) P(g, x, y, "#6e6e76");
  // bucket + rope
  R(g, 11, 9, 2, 6, "#c8a878"); P(g, 11, 9, "#e0c8a0"); P(g, 12, 9, "#e0c8a0");
  R(g, 11, 13, 3, 3, "#8a5a32"); R(g, 11, 13, 3, 1, "#4a4e56"); R(g, 12, 14, 1, 1, "#a8763f");
  R(g, 12, 8, 1, 2, "#4a4e56");
  // crank
  R(g, 2, 10, 3, 1, "#4a4e56"); P(g, 2, 11, "#4a4e56"); P(g, 2, 9, "#4a4e56");
}
function crate(g: G, v: number) {
  R(g, 1, 5, 14, 10, v ? "#8a5a32" : "#9a6a3e");
  R(g, 1, 5, 14, 2, v ? "#a8763f" : "#b0804a");
  for (let x = 3; x < 14; x += 4) R(g, x, 6, 1, 8, "#6a4426");
  R(g, 1, 12, 14, 1, "#4a2e1a");
  R(g, 1, 5, 1, 10, "#5a3a22"); R(g, 14, 5, 1, 10, "#5a3a22");
  for (const [x, y] of [[2, 6], [13, 6], [2, 13], [13, 13]]) P(g, x, y, "#d0c090");
  if (v) P(g, 8, 9, "#c8b088");
}
function barrel(g: G) {
  ell(g, 7, 9, 6, 8, shade("#8a5a32", "#b07a45", "#5a3a22", 12));
  R(g, 1, 5, 12, 2, "#4a4e56"); R(g, 1, 11, 12, 2, "#4a4e56");
  R(g, 2, 3, 10, 1, "#a8763f"); ell(g, 7, 4, 5, 2, "#6a4426");
  for (let x = 3; x < 12; x += 3) R(g, x, 4, 1, 10, "rgba(60,30,10,0.35)");
  P(g, 5, 7, "#c9935a");
}
function notice(g: G) {
  R(g, 3, 10, 2, 15, "#6a4426"); R(g, 15, 10, 2, 15, "#6a4426");
  R(g, 1, 2, 18, 11, "#7a5232"); R(g, 1, 2, 18, 2, "#a8763f"); R(g, 1, 11, 18, 2, "#5a3a22");
  R(g, 3, 5, 6, 6, "#e8e0c8"); R(g, 10, 5, 7, 4, "#dccfae");
  for (let y = 6; y < 10; y += 2) R(g, 4, y, 4, 1, "#8a7a58");
  for (let y = 6; y < 8; y += 2) R(g, 11, y, 5, 1, "#8a7a58");
  P(g, 14, 9, "#b03a2a"); P(g, 9, 8, "#b03a2a");
  R(g, 2, 1, 16, 1, "#4a2e1a");
}
function signpost(g: G) {
  R(g, 7, 7, 3, 22, "#6a4426"); R(g, 8, 7, 1, 22, "#8a5a32");
  // right-pointing board
  R(g, 8, 4, 8, 5, "#a8763f"); R(g, 8, 4, 8, 1, "#c9935a"); P(g, 16, 6, "#a8763f"); P(g, 15, 5, "#a8763f"); P(g, 15, 7, "#a8763f");
  for (let x = 10; x < 15; x += 2) P(g, x, 6, "#5a3a22");
  // left-pointing board
  R(g, 2, 11, 8, 5, "#9a6a3e"); R(g, 2, 11, 8, 1, "#c9935a"); P(g, 1, 13, "#9a6a3e"); P(g, 2, 12, "#9a6a3e"); P(g, 2, 14, "#9a6a3e");
  for (let x = 4; x < 9; x += 2) P(g, x, 13, "#5a3a22");
  // small lower board
  R(g, 8, 18, 7, 4, "#b0804a"); P(g, 15, 19, "#b0804a"); P(g, 15, 20, "#b0804a");
  for (let x = 10; x < 14; x += 2) P(g, x, 20, "#5a3a22");
}
function bench(g: G) {
  R(g, 1, 4, 20, 3, "#a8763f"); R(g, 1, 4, 20, 1, "#c9935a");
  for (let x = 3; x < 20; x += 4) P(g, x, 5, "#7a5232");
  R(g, 2, 8, 2, 5, "#6a4426"); R(g, 18, 8, 2, 5, "#6a4426");
  R(g, 1, 9, 20, 2, "#8a5a32"); R(g, 1, 9, 20, 1, "#b0804a");
  R(g, 1, 1, 20, 2, "#7a5232"); R(g, 1, 1, 20, 1, "#a8763f");
  R(g, 2, 3, 1, 2, "#6a4426"); R(g, 19, 3, 1, 2, "#6a4426");
}
function stall(g: G, v: number) {
  // awning
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 26; x++) {
      const stripe = Math.floor((x + y * 0.6) / 3) % 2 === 0;
      P(g, x, y, y === 5 ? "#7a4a2a" : stripe ? (v ? "#b0442e" : "#a83a2e") : "#e8dcc0");
    }
  }
  for (let x = 0; x < 26; x++) { P(g, x, 6, "#5a3a22"); }
  R(g, 1, 7, 2, 20, "#6a4426"); R(g, 23, 7, 2, 20, "#6a4426");
  // counter
  R(g, 2, 17, 22, 5, "#8a5a32"); R(g, 2, 17, 22, 2, "#b0804a"); R(g, 2, 21, 22, 1, "#5a3a22");
  // goods
  R(g, 4, 13, 5, 4, "#c9935a"); P(g, 5, 12, "#e0b060"); P(g, 7, 12, "#e0b060");
  for (let k = 0; k < 4; k++) { ell(g, 13 + k * 2.4, 15, 1.6, 1.8, k % 2 ? "#b03a2a" : "#d07a2a"); P(g, 12 + k * 2.4, 13, "#4a9a3a"); }
  R(g, 19, 13, 4, 4, "#6a7280"); R(g, 20, 12, 2, 2, "#a8a8b0");
}
function lantern(g: G) {
  R(g, 5, 8, 2, 17, "#5a3a22"); R(g, 6, 8, 1, 17, "#7a5232");
  R(g, 4, 7, 4, 2, "#4a4e56");
  // lamp housing
  R(g, 3, 4, 6, 2, "#4a4e56");
  R(g, 4, 6, 4, 5, "#4a4e56");
  R(g, 5, 6, 2, 5, "#ffd070");
  P(g, 5, 7, "#fff0b0"); P(g, 6, 7, "#fff0b0"); P(g, 5, 8, "#ffe8a0");
  P(g, 4, 10, "#ff9a3a"); P(g, 7, 10, "#ff9a3a");
  R(g, 3, 11, 6, 1, "#4a4e56");
  R(g, 3, 24, 6, 2, "#5a3a22");
}
function haystack(g: G) {
  ell(g, 11, 14, 10, 8, shade("#c8a050", "#e8c878", "#8a6a2a", 24));
  R(g, 1, 18, 20, 3, "#a8802e");
  for (let x = 2; x < 20; x += 3) P(g, x, 16 + (x % 2), "#8a6a2a");
  for (let y = 8; y < 19; y += 3) for (let x = 2; x < 21; x += 4) P(g, x + (y % 2), y, "#b08a40");
  P(g, 11, 5, "#6a4426"); R(g, 10, 2, 3, 4, "#8a5a32");
}
function cart(g: G) {
  R(g, 3, 4, 20, 10, "#8a5a32"); R(g, 3, 4, 20, 2, "#b07a4a");
  for (let x = 5; x < 23; x += 4) R(g, x, 6, 1, 8, "#5a3a22");
  ell(g, 7, 16, 4, 4, "#4a2e1a"); ell(g, 7, 16, 2, 2, "#8a8a90");
  ell(g, 19, 16, 4, 4, "#4a2e1a"); ell(g, 19, 16, 2, 2, "#8a8a90");
  R(g, 23, 8, 5, 1, "#6a4426");
  R(g, 4, 3, 3, 2, "#c8a050"); P(g, 4, 2, "#e0c878");
}
function woodpile(g: G, w: number, h: number) {
  const rows = Math.max(2, Math.floor(h / 5));
  for (let r = 0; r < rows; r++) {
    const y = h - 4 - r * 4;
    for (let x = 1 + (r % 2); x < w - 3; x += 5) {
      R(g, x, y, 4, 3, r % 2 ? "#8a5a32" : "#7a4e2c");
      P(g, x + 3, y + 1, "#c9935a"); P(g, x, y, "#a8763f");
    }
  }
  R(g, 2, h - 2, w - 4, 1, "#4a2e1a");
}
function garden(g: G, v: number) {
  R(g, 1, 3, 14, 12, "#5a3a22");
  for (let y = 4; y < 14; y += 3) R(g, 2, y, 12, 1, "#7a4e2c");
  for (let k = 0; k < 3; k++) {
    const x = 3 + k * 4;
    R(g, x, 6 + (v % 2), 1, 4, "#4a9a3a");
    P(g, x - 1, 6 + (v % 2), "#6ac04a"); P(g, x + 1, 7 + (v % 2), "#6ac04a");
    if (v) P(g, x, 5 + (v % 2), "#e0b040");
  }
}
function laundry(g: G) {
  R(g, 1, 4, 2, 19, "#6a4426"); R(g, 23, 4, 2, 19, "#6a4426");
  R(g, 2, 5, 22, 1, "#c8b088");
  R(g, 5, 6, 6, 8, "#dce4e8"); R(g, 5, 6, 6, 1, "#f4f8fa"); P(g, 10, 10, "#b0c0c8");
  R(g, 14, 6, 7, 6, "#c8b8e0"); R(g, 14, 6, 7, 1, "#e0d8f0");
  P(g, 13, 6, "#8a7a58"); P(g, 22, 6, "#8a7a58");
}
function anvil(g: G) {
  R(g, 2, 8, 12, 4, "#5a3e22"); R(g, 2, 8, 12, 1, "#8a5a32");
  R(g, 3, 4, 10, 4, "#4a4e56"); R(g, 3, 4, 10, 1, "#8a9098");
  R(g, 12, 3, 3, 2, "#4a4e56"); P(g, 14, 3, "#8a9098");
  R(g, 6, 2, 5, 2, "#3a3e46"); P(g, 7, 2, "#6a7280");
}
function trough(g: G) {
  R(g, 1, 5, 18, 5, "#6a4426"); R(g, 1, 5, 18, 1, "#a8763f");
  R(g, 3, 6, 14, 3, "#2e6ea0"); R(g, 3, 6, 14, 1, "#6ab0d8");
  R(g, 2, 9, 2, 2, "#4a2e1a"); R(g, 16, 9, 2, 2, "#4a2e1a");
  P(g, 7, 7, "#a0d8f0");
}

// ================= interiors =================
function bed(g: G) {
  R(g, 2, 2, 12, 18, "#6a4426"); R(g, 3, 3, 10, 16, "#8a5e36");
  R(g, 3, 3, 10, 5, "#e8e0d0"); R(g, 4, 3, 8, 4, "#f4efe4");
  R(g, 3, 8, 10, 11, "#a83a3a"); R(g, 3, 8, 10, 1, "#d06060");
  for (let y = 10; y < 19; y += 3) P(g, 6, y, "#8a2a2a");
  R(g, 1, 1, 14, 2, "#4a2e1a"); R(g, 1, 1, 2, 20, "#4a2e1a"); R(g, 13, 1, 2, 20, "#4a2e1a");
}
function table(g: G) {
  R(g, 1, 1, 16, 8, "#a8763f"); R(g, 1, 1, 16, 2, "#c9935a"); R(g, 1, 7, 16, 2, "#7a5232");
  R(g, 3, 9, 2, 4, "#5a3a22"); R(g, 13, 9, 2, 4, "#5a3a22");
  R(g, 4, 3, 3, 2, "#e8e0c8"); P(g, 8, 3, "#b03a2a"); P(g, 10, 4, "#4a9a3a");
}
function hearth(g: G) {
  R(g, 1, 6, 14, 9, "#6e6e76"); R(g, 1, 6, 14, 1, "#9a9aa2");
  for (let y = 7; y < 15; y += 3) R(g, 1, y, 14, 1, "#4e4e56");
  R(g, 4, 8, 8, 6, "#2a2224"); R(g, 5, 11, 6, 3, "#ff7a2a"); R(g, 6, 12, 4, 2, "#ffd070");
  P(g, 7, 11, "#fff0a0"); P(g, 9, 13, "#ff9a3a");
  R(g, 5, 3, 2, 3, "#4e4e56"); R(g, 9, 3, 2, 3, "#4e4e56");
  ell(g, 8, 3, 3, 1.5, "#2a2224");
}
function shelf(g: G) {
  R(g, 1, 1, 14, 16, "#7a5232"); R(g, 2, 2, 12, 14, "#4a2e1a");
  for (const y of [5, 10, 14]) { R(g, 2, y, 12, 1, "#a8763f"); }
  for (const [x, y, c] of [[3, 3, "#c8a050"], [6, 2, "#8ab0c8"], [9, 3, "#b03a2a"], [4, 7, "#dce4e8"], [8, 8, "#6a8a3a"], [11, 12, "#c8b088"]] as [number, number, string][]) {
    R(g, x, y, 2, 2, c); P(g, x, y, "#f0f0f0");
  }
}
function chest(g: G) {
  R(g, 1, 4, 14, 9, "#8a5a32"); R(g, 1, 4, 14, 3, "#a8763f");
  R(g, 1, 8, 14, 1, "#5a3a22"); R(g, 7, 4, 2, 7, "#4a4e56");
  R(g, 7, 7, 2, 2, "#e0c060"); P(g, 1, 5, "#c0c0c8"); P(g, 14, 5, "#c0c0c8");
  R(g, 2, 12, 12, 1, "#5a3a22");
}
function forge(g: G) {
  R(g, 1, 5, 16, 13, "#5e5e66"); R(g, 1, 5, 16, 1, "#8a8a92");
  for (let y = 7; y < 18; y += 3) R(g, 1, y, 16, 1, "#3e3e46");
  R(g, 5, 8, 8, 6, "#2a1e1a"); R(g, 6, 11, 6, 3, "#ff6a1e"); R(g, 7, 12, 4, 2, "#ffd040");
  P(g, 8, 11, "#fff0a0"); P(g, 10, 13, "#ff9a3a");
  R(g, 7, 1, 4, 4, "#3e3e46"); R(g, 6, 0, 6, 2, "#2a2a30");
}
