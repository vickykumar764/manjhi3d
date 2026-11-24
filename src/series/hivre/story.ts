// Timeline of the Hivre Bazar short ("वह गाँव जो खुद को बदल डाला"): 8 shots timed to the 8 Hindi
// voice segments (shot lengths [274, 335, 306, 262, 308, 235, 270, 282] frames at 30 fps = 2272 frames,
// the AI Studio voice mix in public/voice-hivre.wav, 75.72 s; see voice-hivre/timing.json).
// One village world (the Manjhi valley's Gehlaur layout): the village at the foot of the ridge, the road
// along x = 0 toward -z, the fields beyond the houses at z > 100. The arc is dry -> green: dry-field
// overlays cover the fields in shots 1-3, the wells refill through shots 4-6, and green fields and
// returning families close the film. Shot 8 is golden hour.
export const FPS = 30;
export const TOTAL = 2272;
export const D0 = 0; // valley floor height
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

// ---------------- village layout ----------------
export const RIDGE_Z = -60; // crest line of the ridge behind the village
export const RIDGE_H = 30;
/** ridge surface height at z (the check dams sit on the gully at its foot) */
export const ridgeY = (z: number) =>
  lin([[-96, 0], [-84, 8], [-74, 17], [-67, 24.5], [-60, RIDGE_H], [-53, 24.5], [-46, 17], [-36, 8], [-24, 0]], z);
/** the two wells by the chowk, and the fields beyond the houses */
export const WELLS: [number, number][] = [[-8, 40], [12, 55]];
export const FIELDS = { x0: -60, x1: 60, z0: 100, z1: 165 };
/** the check dams across the gully at the ridge foot, and the trenches along the slope */
export const DAMS: [number, number][] = [[-32, -12], [-24, -8], [-16, -4]];
export const TRENCHES: [number, number][] = [[-38, -22], [-28, -18], [-18, -14]];
/** well water level by frame: dry and deep at first, rising as the work succeeds */
export const waterAt = (f: number) =>
  lin([[0, -1.2], [609, -1.2], [915, -1.0], [1177, -0.75], [1485, -0.45], [1720, -0.25], [2272, -0.15]], f);

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Scene = "hook" | "aerial" | "meeting" | "chowk" | "dams" | "well" | "return" | "finale";
export type ShotDef = { id: number; a: number; b: number; light: Light; scene: Scene };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 274, light: "day", scene: "hook" },
  { id: 2, a: 274, b: 609, light: "day", scene: "aerial" },
  { id: 3, a: 609, b: 915, light: "day", scene: "meeting" },
  { id: 4, a: 915, b: 1177, light: "day", scene: "chowk" },
  { id: 5, a: 1177, b: 1485, light: "day", scene: "dams" },
  { id: 6, a: 1485, b: 1720, light: "day", scene: "well" },
  { id: 7, a: 1720, b: 1990, light: "day", scene: "return" },
  { id: 8, a: 1990, b: 2272, light: "golden", scene: "finale" },
];
export const FLASH_AT = 270; // white flash at the end of the hook (as in the template)
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** one world, no place changes: always a single layer (the template crossfades only between places) */
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];
export const lightAt = (id: number, f: number): Light => SHOTS[id - 1].light;

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

// shot 1 (hook): a farmer in the cracked dry field, the thirsty village behind
const S1a = (f: number) => dolly([4.5, 2.4, 128], [0, 1.5, 122], pushK(f, 0, 0.0022), { fov: 44 });
const S1b = (f: number) => dolly([3.0, 2.0, 126], [0, 1.4, 122], pushK(f, 100, 0.002, 0.006, 30), { fov: 40, roll: -0.03 });
// shot 2 (aerial): the dry village, families leaving down the road with the cart
const S2a = (f: number) => zoom([70, 115, 140], [0, 5, 60], 46, pushK(f, 274, 0.0012));
const S2b = (f: number) => zoom([26, 44, 70], [0, 4, 55], 44, pushK(f, 440, 0.0016, 0.005, 32));
// shot 3 (the meeting): Popatrao standing before the seated gram sabha at the chowk
const S3a = (f: number) => dolly([7, 2.6, 42], [0, 1.5, 32], pushK(f, 609, 0.0018), { fov: 42 });
const S3b = (f: number) => dolly([4, 2.0, 38], [0, 1.4, 32], pushK(f, 760, 0.0022), { fov: 38, roll: 0.03 });
// shot 4 (the chowk): the circle agreeing the rules — the rain gauge, the milk cans, the wells
const S4a = (f: number) => dolly([9, 2.8, 30], [0, 1.5, 40], pushK(f, 915, 0.0016), { fov: 42 });
const S4b = (f: number) => dolly([-8, 2.4, 34], [0, 1.5, 42], pushK(f, 1050, 0.0018), { fov: 42, roll: -0.02 });
// shot 5 (the dams): the village building check dams and trenches on the slope
const S5a = (f: number) => dolly([4, 4.5, 12], [-24, 1.5, -8], pushK(f, 1177, 0.0016), { fov: 42 });
const S5b = (f: number) => dolly([-8, 3.5, 6], [-26, 1.5, -10], pushK(f, 1330, 0.0018), { fov: 42, roll: 0.02 });
// shot 6 (the well): a woman drawing water, green fields behind
const S6a = (f: number) => dolly([4.5, 2.4, 46], [-8, 1.4, 40], pushK(f, 1485, 0.0018), { fov: 42 });
const S6b = (f: number) => dolly([2.8, 2.0, 44], [-8, 1.3, 40], pushK(f, 1600, 0.0022), { fov: 38, roll: -0.02 });
// shot 7 (the return): families coming back along the road, the cart rolling in, villagers waving
const S7a = (f: number) => dolly([8, 3.0, 70], [0, 1.6, 55], pushK(f, 1720, 0.0018), { fov: 42 });
const S7b = (f: number) => dolly([-7, 2.6, 62], [0, 1.5, 52], pushK(f, 1860, 0.002), { fov: 40, roll: 0.02 });
// shot 8 (finale): golden hour over the green village, the whole village together at the chowk
const S8a = (f: number) => dolly([11, 3.4, 46], [0, 1.6, 34], pushK(f, 1990, 0.0018), { fov: 42 });
const S8b = (f: number) => dolly([22, 9, 60], [0, 2.5, 45], pushK(f, 2140, 0.0012), { fov: 44 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 100, dur: 34, s: S1b }],
  2: [{ f: 274, s: S2a }, { f: 440, dur: 26, s: S2b }],
  3: [{ f: 609, s: S3a }, { f: 760, cut: true, s: S3b }],
  4: [{ f: 915, s: S4a }, { f: 1050, cut: true, s: S4b }],
  5: [{ f: 1177, s: S5a }, { f: 1330, cut: true, s: S5b }],
  6: [{ f: 1485, s: S6a }, { f: 1600, dur: 30, s: S6b }],
  7: [{ f: 1720, s: S7a }, { f: 1860, cut: true, s: S7b }],
  8: [{ f: 1990, s: S8a }, { f: 2140, dur: 40, s: S8b }],
};
export const camAt = (id: number, f: number): Cam => run(CAMS[id], f);

// ---------------- lens: depth of field (same table pattern as the template) ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 14, focus: () => [0, 1.5, 122] },   // hook CU: the farmer sharp, the village soft
  { f: 274, cInf: 0 },                              // aerial: all readable
  { f: 609, cInf: 12, focus: () => [0, 1.5, 32] },  // the meeting
  { f: 915, cInf: 9, focus: () => [0, 1.5, 40] },   // the chowk
  { f: 1177, cInf: 9, focus: () => [-24, 1.5, -8] },// the dams
  { f: 1485, cInf: 4, focus: () => [-8, 1.4, 40] }, // the well
  { f: 1720, cInf: 8, focus: () => [0, 1.6, 55] },  // the return
  { f: 1990, cInf: 6, focus: () => [0, 1.6, 34] },  // finale
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
  { a: 0, b: 274, kit: "plant_bushDetailed", pos: [4.4, 0, 128.0], s: 1.15, yaw: 0.4 }, // hook: bush bottom-right
  { a: 609, b: 1177, kit: "plant_bush", pos: [5.2, 0, 36.0], s: 1.0, yaw: 1.2 },        // meeting: bush bottom-left
  { a: 1990, b: 2272, kit: "plant_bushDetailed", pos: [7.8, 0, 42.0], s: 1.35, yaw: 0.9 }, // finale: bush bottom-right
];
