// Timeline of the Jaswant short ("वो सिपाही जो आज भी ड्यूटी पर है"): 8 shots timed to the 8 Hindi
// voice segments (shot lengths [294, 318, 263, 271, 337, 280, 228, 260] frames at 30 fps = 2251 frames,
// the AI Studio voice mix in public/voice-jaswant.wav, 75.04 s; see voice-jaswant/timing.json).
// One mountain world: the Nuranang outpost on a snowy ridge (the ridge crosses the road at z = -60, as in
// the Manjhi valley), three bunkers on its slope, the Monpa village below, and the Jaswant Garh memorial
// at the road's foot. The enemy column approaches from the far valley (z < -100).
// Shot 5 time-lapses the 72 hours (day/golden cycling); shots 7-8 are the golden memorial.
export const FPS = 30;
export const TOTAL = 2251;
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

// ---------------- mountain layout ----------------
export const RIDGE_Z = -60; // crest line of the ridge (the outpost sits on its near slope)
export const RIDGE_H = 30;
/** ridge surface height at z (the bunkers sit on this profile); 0 off the ridge */
export const ridgeY = (z: number) =>
  lin([[-96, 0], [-84, 8], [-74, 17], [-67, 24.5], [-60, RIDGE_H], [-53, 24.5], [-46, 17], [-36, 8], [-24, 0]], z);
/** the three bunkers Jaswant runs between: [x, z] (y = ridgeY(z) + 0.4) */
export const BUNKERS: [number, number][] = [[-12, -48], [0, -58], [12, -68]];
/** the memorial (Jaswant Garh) at the road's foot, and the post flag above bunker 2 */
export const MEMORIAL: V3 = [0, 0, -18];
export const POST_FLAG: V3 = [0.5, 0, -58];
/** the enemy column's approach line in the far valley */
export const enemyZ = (t: number) => -128 + Math.min(18, t * 0.35);

/** where Jaswant is during the bunker run (shot 4): he sprints bunker to bunker, firing at each */
export const runAt = (f: number): V3 => {
  const s = SHOTS[3], u = clamp01((f - s.a) / (s.b - s.a));
  const stops = [...BUNKERS, BUNKERS[0]];
  const seg = Math.min(2, Math.floor(u * 3)), su = smooth((u * 3) % 1);
  const [x0, z0] = stops[seg], [x1, z1] = stops[seg + 1];
  const x = x0 + (x1 - x0) * su, z = z0 + (z1 - z0) * su;
  return [x, ridgeY(z) + 0.4, z];
};
/** firing cycle during the run: a shot every ~0.9 s from whichever bunker he is at */
export const fireK = (t: number) => {
  const p = (((t % 0.9) + 0.9) % 0.9) / 0.9;
  return p < 0.12 ? 1 - p / 0.12 : 0;
};

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Scene = "hook" | "aerial" | "refuse" | "run" | "ammo" | "quiet" | "memorial" | "finale";
export type ShotDef = { id: number; a: number; b: number; light: Light; scene: Scene };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 294, light: "day", scene: "hook" },
  { id: 2, a: 294, b: 612, light: "day", scene: "aerial" },
  { id: 3, a: 612, b: 875, light: "day", scene: "refuse" },
  { id: 4, a: 875, b: 1146, light: "day", scene: "run" },
  { id: 5, a: 1146, b: 1483, light: "day", scene: "ammo" },
  { id: 6, a: 1483, b: 1763, light: "day", scene: "quiet" },
  { id: 7, a: 1763, b: 1991, light: "golden", scene: "memorial" },
  { id: 8, a: 1991, b: 2251, light: "golden", scene: "finale" },
];
export const FLASH_AT = 290; // white flash at the end of the hook (as in the template)
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** one world, no place changes: always a single layer (the template crossfades only between places) */
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];
/** effective light: the 72-hour shot time-lapses, alternating day and golden every ~1.3 s */
export const lightAt = (id: number, f: number): Light => {
  if (id === 5) return ((f - 1146) % 78) < 39 ? "day" : "golden";
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

// shot 1 (hook): Jaswant CU at bunker 2, snowy ridge and the post behind; punch on his set face
const S1a = (f: number) => dolly([3.8, ridgeY(-58) + 2.6, -48], [0, ridgeY(-58) + 1.5, -58], pushK(f, 0, 0.0022), { fov: 44 });
const S1b = (f: number) => dolly([2.4, ridgeY(-58) + 2.0, -51.5], [0, ridgeY(-58) + 1.4, -58], pushK(f, 110, 0.002, 0.006, 30), { fov: 40, roll: -0.03 });
// shot 2 (aerial): the post on the ridge, the valley, the enemy column far below
const S2a = (f: number) => zoom([70, 115, 140], [0, 8, -60], 46, pushK(f, 294, 0.0012));
const S2b = (f: number) => zoom([26, 44, 70], [0, 6, -58], 44, pushK(f, 460, 0.0016, 0.005, 32));
// shot 3 (the refusal): Jaswant stands at the post with Sela and Nura as the company files away
const S3a = (f: number) => dolly([6.5, ridgeY(-52) + 2.4, -38], [0, ridgeY(-54) + 1.4, -54], pushK(f, 612, 0.0018), { fov: 42 });
const S3b = (f: number) => dolly([3.8, ridgeY(-54) + 2.0, -44], [0, ridgeY(-56) + 1.35, -56], pushK(f, 750, 0.0022), { fov: 38, roll: 0.03 });
// shot 4 (the run): fast moves tracking Jaswant bunker to bunker, muzzle flashes
const S4a = (f: number) => { const [rx, ry, rz] = runAt(f); return dolly([rx + 7, ry + 2.4, rz + 9], [rx, ry + 1.2, rz], pushK(f, 875, 0.0016), { fov: 42 }); };
const S4b = (f: number) => { const [rx, ry, rz] = runAt(f); return dolly([rx - 6, ry + 2.0, rz + 8], [rx, ry + 1.2, rz], pushK(f, 1010, 0.002), { fov: 40, roll: -0.03 }); };
// shot 5 (ammo): the girls ferrying crates between the bunkers, day and night cycling
const S5a = (f: number) => dolly([10, ridgeY(-52) + 3.2, -36], [0, ridgeY(-56) + 1.6, -56], pushK(f, 1146, 0.0016), { fov: 42 });
const S5b = (f: number) => dolly([-9, ridgeY(-60) + 3.0, -44], [0, ridgeY(-58) + 1.5, -58], pushK(f, 1320, 0.0018), { fov: 42, roll: 0.02 });
// shot 6 (quiet): the empty post, the flag still waving, the rifle leaning on the bunker
const S6a = (f: number) => zoom([28, 20, 10], [0, ridgeY(-58) + 2, -58], 44, pushK(f, 1483, 0.0014));
const S6b = (f: number) => dolly([6, ridgeY(-58) + 2.2, -46], [0, ridgeY(-58) + 1.6, -58], pushK(f, 1630, 0.002), { fov: 40 });
// shot 7 (memorial): the memorial wide in golden light, a soldier saluting
const S7a = (f: number) => dolly([9, 3.2, -6], [0, 1.6, -18], pushK(f, 1763, 0.0018), { fov: 42 });
const S7b = (f: number) => dolly([5, 2.2, -10], [0, 1.5, -18], pushK(f, 1890, 0.0022), { fov: 38, roll: -0.02 });
// shot 8 (finale): golden hour at the memorial, the guard on duty, the bed and boots kept ready
const S8a = (f: number) => dolly([11, 3.4, -2], [0, 1.6, -18], pushK(f, 1991, 0.0018), { fov: 42 });
const S8b = (f: number) => dolly([22, 9, 18], [0, 2.5, -30], pushK(f, 2140, 0.0012), { fov: 44 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 110, dur: 34, s: S1b }],
  2: [{ f: 294, s: S2a }, { f: 460, dur: 26, s: S2b }],
  3: [{ f: 612, s: S3a }, { f: 750, cut: true, s: S3b }],
  4: [{ f: 875, s: S4a }, { f: 1010, cut: true, s: S4b }],
  5: [{ f: 1146, s: S5a }, { f: 1320, cut: true, s: S5b }],
  6: [{ f: 1483, s: S6a }, { f: 1630, cut: true, s: S6b }],
  7: [{ f: 1763, s: S7a }, { f: 1890, dur: 30, s: S7b }],
  8: [{ f: 1991, s: S8a }, { f: 2140, dur: 40, s: S8b }],
};
export const camAt = (id: number, f: number): Cam => run(CAMS[id], f);

// ---------------- lens: depth of field (same table pattern as the template) ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 14, focus: () => [0, ridgeY(-58) + 1.5, -58] },   // hook CU: Jaswant sharp, ridge soft
  { f: 294, cInf: 0 },                                            // aerial: all readable
  { f: 612, cInf: 12, focus: () => [0, ridgeY(-56) + 1.4, -56] }, // the refusal group
  { f: 875, cInf: 8, focus: () => [0, ridgeY(-58) + 1.4, -58] },  // the run
  { f: 1146, cInf: 9, focus: () => [0, ridgeY(-56) + 1.5, -56] }, // ammo run
  { f: 1483, cInf: 4, focus: () => [0, ridgeY(-58) + 2, -58] },   // the quiet post
  { f: 1763, cInf: 6, focus: () => [0, 1.6, -18] },               // memorial
  { f: 1991, cInf: 6, focus: () => [0, 1.6, -18] },               // finale
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
  { a: 0, b: 294, kit: "plant_bushDetailed", pos: [4.4, ridgeY(-50), -48.0], s: 1.15, yaw: 0.4 }, // hook: bush bottom-right
  { a: 612, b: 875, kit: "plant_bush", pos: [5.2, ridgeY(-46), -42.0], s: 1.0, yaw: 1.2 },         // refusal: bush bottom-left
  { a: 1763, b: 2251, kit: "plant_bushDetailed", pos: [7.8, 0, -10.0], s: 1.35, yaw: 0.9 },         // memorial: bush bottom-right
];
