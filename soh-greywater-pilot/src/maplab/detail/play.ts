// POI Detail Layer — walk-and-interact session for the Greywater pilot.
// Movement, tile collision, roof-aware interiors and finite interactions.
// Deterministic: no Math.random in simulation, only in cosmetic particles.

import { hash2 } from "../geom";
import { buildingAt, gridIndex, type SiteGrid } from "./grid";
import type { DetailProp, ResolvedPlan, TilePt } from "./types";

export type Dir = 0 | 1 | 2 | 3; // down, left, right, up (prototype convention)

export interface Particle { x: number; y: number; vx: number; vy: number; col: string; life: number; max: number }

export interface PlaySession {
  x: number; y: number;
  vx: number; vy: number;
  dir: Dir;
  moving: boolean;
  anim: number;
  inside: string | null;
  counters: { water: number; supplies: number; reads: number; lamps: number };
  used: Record<string, boolean>;
  lamps: Record<string, boolean>;
  toast: string;
  toastT: number;
  noticeOpen: boolean;
  particles: Particle[];
  target: { id: string; label: string; kind: string; kindLabel: string } | null;
  steps: number;
}

const RADIUS = 0.3;
const SPEED = 3.1; // tiles / second

export function createSession(plan: ResolvedPlan, saved?: { water?: number; supplies?: number; reads?: number; lamps?: number; used?: Record<string, boolean>; lampsOn?: Record<string, boolean> }): PlaySession {
  return {
    x: plan.spawn[0], y: plan.spawn[1], vx: 0, vy: 0, dir: 3, moving: false, anim: 0,
    inside: null,
    counters: { water: saved?.water || 0, supplies: saved?.supplies || 0, reads: saved?.reads || 0, lamps: saved?.lamps || 0 },
    used: { ...(saved?.used || {}) },
    lamps: { ...(saved?.lampsOn || {}) },
    toast: "", toastT: 0, noticeOpen: false, particles: [], target: null, steps: 0,
  };
}

export interface PlayInput { up: boolean; down: boolean; left: boolean; right: boolean }

export function stepSession(s: PlaySession, grid: SiteGrid, plan: ResolvedPlan, dt: number, input: PlayInput) {
  const sp = SPEED * dt;
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  if (len > 0) { dx /= len; dy /= len; }
  const moving = len > 0;
  s.moving = moving;
  if (moving) {
    // prototype dir convention: 0 down, 1 left, 2 right, 3 up
    if (Math.abs(dy) > Math.abs(dx)) s.dir = dy > 0 ? 0 : 3;
    else s.dir = dx > 0 ? 2 : 1;
    s.anim += dt * 7;
    s.steps += dt;
  } else {
    s.anim += dt * 1.6;
  }

  const tryMove = (nx: number, ny: number) => {
    if (!blocked(grid, nx, s.y)) s.x = nx;
    if (!blocked(grid, s.x, ny)) s.y = ny;
  };
  // axis-separated so wall sliding feels right
  tryMove(s.x + dx * sp, s.y + dy * sp);

  s.vx = dx; s.vy = dy;
  s.inside = insideBuilding(grid, s.x, s.y);
  updateTarget(s, plan);
  updateParticles(s, dt);
  if (s.toastT > 0) { s.toastT -= dt; if (s.toastT <= 0) s.toast = ""; }
}

function blocked(grid: SiteGrid, x: number, y: number): boolean {
  const pts: TilePt[] = [[x, y], [x + RADIUS, y], [x - RADIUS, y], [x, y + RADIUS], [x, y - RADIUS], [x + RADIUS, y + RADIUS], [x - RADIUS, y - RADIUS], [x + RADIUS, y - RADIUS], [x - RADIUS, y + RADIUS]];
  for (const [px, py] of pts) {
    const i = gridIndex(grid, px, py);
    if (i < 0) return true;
    if (grid.solid[i]) return true;
    if (grid.water[i]) return true;
  }
  return false;
}

export function insideBuilding(grid: SiteGrid, x: number, y: number): string | null {
  const i = gridIndex(grid, x, y);
  if (i < 0) return null;
  const id = grid.buildingId[i];
  if (!id) return null;
  const gr = grid.ground[i];
  return gr === "wall" ? null : id;
}

const KIND_LABEL: Record<string, string> = { well: "Giếng nước", crate: "Thùng đồ", notice: "Bảng tin", sign: "Biển chỉ dẫn", lantern: "Đèn lồng", door: "Cửa", bench: "Ghế" };

function updateTarget(s: PlaySession, plan: ResolvedPlan) {
  let best: PlaySession["target"] = null;
  let bd = 1.55;
  for (const p of plan.props) {
    if (!p.interact) continue;
    const d = Math.hypot(p.x + 0.5 - s.x, p.y + 0.5 - s.y);
    if (d < bd) {
      bd = d;
      const used = p.interact.key ? s.used[p.interact.key] : false;
      const label = p.interact.kind === "crate" && used ? "Thùng đã lấy hết" : (p.interact.text || KIND_LABEL[p.interact.kind] || p.type);
      best = { id: p.id, label, kind: p.interact.kind, kindLabel: KIND_LABEL[p.interact.kind] || p.type };
    }
  }
  if (!best) {
    for (const b of plan.buildings) {
      const d = Math.hypot(b.door.x + 0.5 - s.x, b.door.y + 0.5 - s.y);
      if (d < 1.2) {
        best = { id: b.id, label: `${b.name} — ${s.inside === b.id ? "đang ở trong" : "cửa vào"}`, kind: "door", kindLabel: KIND_LABEL.door };
        break;
      }
    }
  }
  s.target = best;
}

export interface InteractResult { ok: boolean; message: string; openNotice?: boolean; sound?: "water" | "pickup" | "read" | "lamp" | "none" }

export function interact(s: PlaySession, plan: ResolvedPlan): InteractResult {
  const t = s.target;
  if (!t) return { ok: false, message: "Không có gì để dùng ở đây" };
  const p = plan.props.find((q) => q.id === t.id);
  if (!p || !p.interact) {
    if (t.kind === "door") return { ok: true, message: "Bước qua cửa để vào nhà — mái sẽ mờ đi khi bạn ở trong." };
    return { ok: false, message: "Không dùng được" };
  }
  const it = p.interact;
  switch (it.kind) {
    case "well": {
      s.counters.water++;
      burst(s, p.x + 0.5, p.y + 0.3, ["#bfeaff", "#ffffff", "#6ab0d8"], 12);
      return { ok: true, message: `Múc nước sạch +1 · tổng ${s.counters.water}`, sound: "water" };
    }
    case "crate": {
      if (it.key && s.used[it.key]) return { ok: false, message: "Thùng này đã lấy hết." };
      if (it.key) s.used[it.key] = true;
      s.counters.supplies++;
      burst(s, p.x + 0.5, p.y + 0.3, ["#ffe27a", "#c9935a", "#ffffff"], 10);
      return { ok: true, message: `Nhặt vật tư +1 · tổng ${s.counters.supplies} (muối, dây, đinh)`, sound: "pickup" };
    }
    case "notice": {
      s.counters.reads++;
      return { ok: true, message: "Đọc bảng tin làng Greywater", openNotice: true, sound: "read" };
    }
    case "sign": {
      s.counters.reads++;
      burst(s, p.x + 0.5, p.y + 0.2, ["#fff0c0", "#ffe27a"], 6);
      return { ok: true, message: "Biển chỉ dẫn: Đông → bến sông · Tây → rừng già · Bắc → hồ Greywater · Nam → đường mòn Elderwood", sound: "read" };
    }
    case "lantern": {
      const key = it.key || p.id;
      s.lamps[key] = !s.lamps[key];
      s.counters.lamps++;
      burst(s, p.x + 0.5, p.y + 0.2, ["#ffd070", "#ffb040", "#fff0b0"], 8);
      return { ok: true, message: s.lamps[key] ? "Thắp đèn lồng — quảng trường sáng hơn" : "Tắt đèn lồng", sound: "lamp" };
    }
    default:
      return { ok: false, message: "Không dùng được" };
  }
}

function burst(s: PlaySession, x: number, y: number, cols: string[], n: number) {
  for (let i = 0; i < n; i++) {
    if (s.particles.length > 120) break;
    const a = (i / n) * Math.PI * 2 + hash2(i, Math.round(x * 10), 3) * 0.6;
    const sp = 0.6 + hash2(i, Math.round(y * 10), 5) * 1.2;
    s.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.1, col: cols[i % cols.length], life: 0, max: 0.5 + hash2(i, 1, 7) * 0.5 });
  }
}

function updateParticles(s: PlaySession, dt: number) {
  for (let i = s.particles.length - 1; i >= 0; i--) {
    const p = s.particles[i];
    p.life += dt;
    if (p.life >= p.max) { s.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 3.2 * dt; p.vx *= 0.97;
  }
}

export function sessionSave(s: PlaySession) {
  return { water: s.counters.water, supplies: s.counters.supplies, reads: s.counters.reads, lamps: s.counters.lamps, used: s.used, lampsOn: s.lamps };
}

export function propAt(plan: ResolvedPlan, x: number, y: number): DetailProp | null {
  let best: DetailProp | null = null, bd = 0.9;
  for (const p of plan.props) {
    const d = Math.hypot(p.x + 0.5 - x, p.y + 0.5 - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export const NOTICE_TEXT = [
  "BẢNG TIN LÀNG GREYWATER",
  "— Mùa nước lớn: ghe từ Bến Bắc ghé cầu gỗ lúc chiều.",
  "— Nhà hội giữ muối và sổ đinh; ai lấy nhớ ghi tên.",
  "— Lò rèn nhận sửa lưỡi hái, đổi than lấy phôi sắt.",
  "— Đêm nay có đèn ở quảng trường; đi đường mòn Elderwood cẩn thận.",
  "",
  "(Bảng tin do POI Detail Layer đặt — nội dung là hư cấu, không phải canon.)",
].join("\n");
