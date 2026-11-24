// Timeline of the Payeng short ("एक आदमी का जंगल"): 8 shots timed to the 8 Hindi voice segments
// (shot lengths [319, 293, 298, 280, 346, 373, 278, 253] frames at 30 fps = 2440 frames,
// the AI Studio voice mix in public/voice-payeng.wav, 81.32 s; see voice-payeng/timing.json.
// Segment 6 was re-recorded 2026-11-24 (animals only implied on screen, so the narration
// now describes birdsong + rustling bushes instead of deer/elephants/tiger); that added
// 88 frames, all inside shots 6-8.)
// One riverside world: the Brahmaputra, a sandbar island in it, and the forest that grows on the sandbar.
// The sandbar sits at z ~ -60 in the river (z -95..-25); the village is on the near bank (z > 0).
// Shot 1 is a flash-forward (old Payeng, mature forest, golden light); shots 2-3 are 1979 (barren sandbar);
// the forest grows with growthAt(f) during shots 4-5 and stands mature in shots 6-8.
export const FPS = 30;
export const TOTAL = 2440;
export const D0 = 0; // valley floor height (the riverbank ground itself)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- river + sandbar layout ----------------
export const RIVER_Z0 = -95, RIVER_Z1 = -25; // the river band (far side z < -25)
export const BAR_Z0 = -82, BAR_Z1 = -42; // the sandbar island inside the river
export const BAR_X0 = -85, BAR_X1 = 85;
/** forest growth on the sandbar: 1 = mature (flash-forward + finale), 0 = barren (1979) */
export const growthAt = (f: number) => {
  if (f < 319) return 1; // shot 1: old Payeng, mature forest (flash-forward)
  if (f < 910) return 0; // shots 2-3: the barren sandbar of 1979
  if (f < 1190) return 0.12; // shot 4: saplings
  if (f < 1536) return 0.12 + ((f - 1190) / (1536 - 1190)) * 0.5; // shot 5: time-lapse growth
  return 1; // shots 6-8: the mature Molai forest
};
/** bamboo grows faster than the trees (it covers 300+ hectares) */
export const bambooAt = (f: number) => {
  if (f < 319) return 1;
  if (f < 910) return 0;
  if (f < 1190) return 0.3;
  if (f < 1536) return 0.3 + ((f - 1190) / (1536 - 1190)) * 0.6;
  return 1;
};
/** the canoe crossing the river to the sandbar during the first half of shot 4 (frames 910-1050) */
export const canoeAt = (f: number): V3 => {
  const u = clamp01((f - 910) / 140);
  return [-15 + 20 * u, 0, -22 - 30 * u];
};

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Scene = "hook" | "aerial" | "decide" | "plant" | "years" | "forest" | "vast" | "finale";
export type ShotDef = { id: number; a: number; b: number; light: Light; scene: Scene };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 319, light: "golden", scene: "hook" },
  { id: 2, a: 319, b: 612, light: "day", scene: "aerial" },
  { id: 3, a: 612, b: 910, light: "day", scene: "decide" },
  { id: 4, a: 910, b: 1190, light: "day", scene: "plant" },
  { id: 5, a: 1190, b: 1536, light: "day", scene: "years" },
  { id: 6, a: 1536, b: 1909, light: "day", scene: "forest" },
  { id: 7, a: 1909, b: 2187, light: "day", scene: "vast" },
  { id: 8, a: 2187, b: 2440, light: "golden", scene: "finale" },
];
export const FLASH_AT = 315; // white flash at the end of the hook (as in the template)
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** one world, no place changes: always a single layer (the template crossfades only between places) */
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];
/** effective light: the years shot time-lapses, alternating day and golden every ~1.3 s */
export const lightAt = (id: number, f: number): Light => {
  if (id === 5) return ((f - 1190) % 78) < 39 ? "day" : "golden";
  return SHOTS[id - 1].light;
};

// ---------------- camera (same grammar as the template: smootherstep glides + push-ins) ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });

// shot 1 (hook): old Payeng CU holding a sapling, mature forest soft behind; punch as he lifts the sapling
const S1a = (f: number) => dolly([3.4, 2.2, -50], [0.2, 1.4, -60], pushK(f, 0, 0.0022), { fov: 44 });
const S1b = (f: number) => dolly([2.2, 1.9, -53.5], [0.3, 1.35, -60.5], pushK(f, 120, 0.002, 0.006, 30), { fov: 40, roll: -0.03 });
// shot 2 (aerial, 1979): high wide over the river + barren sandbar, the lone boy among the dead snakes
const S2a = (f: number) => zoom([70, 115, 130], [0, 0, -60], 46, pushK(f, 319, 0.0012));
const S2b = (f: number) => zoom([24, 42, 60], [0, 1, -58], 44, pushK(f, 470, 0.0016, 0.005, 32));
// shot 3 (the decision): the boy's tearful face, empty sandbar and river behind; push in as he decides
const S3a = (f: number) => dolly([3.0, 2.0, -50.5], [0.2, 1.4, -59], pushK(f, 612, 0.0018), { fov: 42 });
const S3b = (f: number) => dolly([1.9, 1.75, -53.8], [0.3, 1.35, -59.5], pushK(f, 770, 0.0022), { fov: 38, roll: 0.03 });
// shot 4 (planting): the canoe crossing, then watering the saplings close-up
const S4a = (f: number) => { const [cx, , cz] = canoeAt(f); return dolly([cx + 9, 3.2, cz + 14], [cx, 0.8, cz], pushK(f, 910, 0.0016), { fov: 42 }); };
const S4b = (f: number) => dolly([3.6, 2.0, -52], [0.2, 0.9, -60], pushK(f, 1050, 0.0022, 0.005, 30), { fov: 40 });
// shot 5 (years): wide of the sandbar as the forest grows through the seasons, Payeng planting in front
const S5a = (f: number) => zoom([34, 22, 30], [0, 2, -58], 44, pushK(f, 1190, 0.0014));
const S5b = (f: number) => zoom([18, 12, 8], [0, 2, -58], 42, pushK(f, 1370, 0.0016));
// shot 6 (the forest alive): inside the mature forest, birds overhead, bushes rustling
const S6a = (f: number) => dolly([-14, 2.6, -44], [2, 1.8, -66], pushK(f, 1536, 0.0016), { fov: 42 });
const S6b = (f: number) => dolly([-6, 2.2, -52], [4, 1.6, -68], pushK(f, 1680, 0.002), { fov: 40, roll: -0.02 });
// shot 7 (vast): drone-style aerial over the whole Molai forest, village and fields at the edge
const S7a = (f: number) => zoom([90, 130, 170], [0, 0, -60], 46, pushK(f, 1909, 0.0012));
const S7b = (f: number) => zoom([30, 48, 95], [0, 2, -58], 44, pushK(f, 2057, 0.0015));
// shot 8 (finale): golden hour at the forest edge, Payeng planting with children and villagers behind
const S8a = (f: number) => dolly([10, 3.2, -38], [0, 1.6, -58], pushK(f, 2187, 0.0018), { fov: 42 });
const S8b = (f: number) => dolly([20, 9, -18], [0, 2.5, -58], pushK(f, 2327, 0.0012), { fov: 44 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 120, dur: 34, s: S1b }],
  2: [{ f: 319, s: S2a }, { f: 470, dur: 26, s: S2b }],
  3: [{ f: 612, s: S3a }, { f: 770, cut: true, s: S3b }],
  4: [{ f: 910, s: S4a }, { f: 1050, cut: true, s: S4b }],
  5: [{ f: 1190, s: S5a }, { f: 1370, dur: 26, s: S5b }],
  6: [{ f: 1536, s: S6a }, { f: 1680, cut: true, s: S6b }],
  7: [{ f: 1909, s: S7a }, { f: 2057, dur: 30, s: S7b }],
  8: [{ f: 2187, s: S8a }, { f: 2327, dur: 40, s: S8b }],
};
export const camAt = (id: number, f: number): Cam => run(CAMS[id], f);

// ---------------- lens: depth of field (same table pattern as the template) ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 14, focus: () => [0.3, 1.4, -60] },        // hook CU: old Payeng sharp, forest soft
  { f: 319, cInf: 0 },                                      // aerial: all readable
  { f: 612, cInf: 12, focus: () => [0.3, 1.4, -59.5] },     // decision CU
  { f: 910, cInf: 6, focus: () => [0, 0.8, -40] },          // canoe on the river
  { f: 1050, cInf: 10, focus: () => [0.2, 0.9, -60] },      // watering the saplings
  { f: 1190, cInf: 0 },                                     // years wide
  { f: 1536, cInf: 8, focus: () => [2, 1.8, -66] },         // inside the forest
  { f: 1909, cInf: 0 },                                     // vast aerial
  { f: 2187, cInf: 6, focus: () => [0, 1.6, -58] },         // finale crowd
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};

/** near framing objects (kit GLB names for build.ts prop/kitClone), visible while a <= f < b in their own shot */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  { a: 0, b: 319, kit: "plant_bushDetailed", pos: [4.6, 0, -53.0], s: 1.15, yaw: 0.4 },   // hook: bush bottom-right of lens
  { a: 612, b: 910, kit: "plant_bush", pos: [3.8, 0, -52.6], s: 1.0, yaw: 1.2 },           // decision: bush bottom-left
  { a: 1536, b: 1909, kit: "plant_bushLarge", pos: [-8.5, 0, -50.0], s: 1.4, yaw: 0.9 },    // forest: big bush framing the walk
  { a: 2187, b: 2440, kit: "plant_bushDetailed", pos: [9.2, 0, -46.0], s: 1.35, yaw: 0.9 },  // finale: bush bottom-right
];
