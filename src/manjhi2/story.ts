// Timeline of the Manjhi short (adapted from the bridge template's story.ts): 8 shots timed to the 8 Hindi
// voice segments (shot lengths [209, 355, 354, 356, 318, 382, 413, 394] frames at 30 fps = 2781 frames,
// the AI Studio voice mix in public/voice2.wav, 92.68 s; see voice-ai/timing.json).
// One valley, one world: the village of Gehlaur at the foot of a rocky ridge; the road runs along x = 0 toward
// -z, the ridge crosses it at z = -60, and the notch Manjhi cuts widens with gapAt(frame).
export const FPS = 30;
export const TOTAL = 2781;
export const D0 = 0; // valley floor height (the bridge template's bank top; here the ground itself)
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

// ---------------- valley layout ----------------
export const RIDGE_Z = -60; // crest line of the mountain ridge
export const RIDGE_H = 30;
/** ridge surface height at z (the footpath over the mountain follows this profile); 0 off the ridge */
export const ridgeY = (z: number) =>
  lin([[-96, 0], [-84, 8], [-74, 17], [-67, 24.5], [-60, RIDGE_H], [-53, 24.5], [-46, 17], [-36, 8], [-24, 0]], z);
/** half-width of the cut through the ridge at frame f: nothing before the years shot, grows year by year
 *  during shot 6 (22 years in 234 frames, each year easing in), then stays at the finished road width */
export const gapAt = (f: number) => {
  if (f < 1592) return 0;
  if (f >= 1974) return 6.5;
  const yr = ((f - 1592) / (1974 - 1592)) * 22;
  const p = (Math.floor(yr) + smooth((yr % 1) * 1.5)) / 22;
  return 6.5 * clamp01(p);
};
/** 0 = solid ridge, 1 = fully cut at this x (smooth sloped sides on the pass) */
export const notchMask = (x: number, f: number) => {
  const g = gapAt(f);
  if (g <= 0) return 0;
  return 1 - smooth((Math.abs(x) - g) / 7);
};

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Scene = "hook" | "village" | "fall" | "decide" | "laugh" | "years" | "road" | "finale";
export type ShotDef = { id: number; a: number; b: number; light: Light; scene: Scene };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 209, light: "day", scene: "hook" },
  { id: 2, a: 209, b: 564, light: "day", scene: "village" },
  { id: 3, a: 564, b: 918, light: "day", scene: "fall" },
  { id: 4, a: 918, b: 1274, light: "day", scene: "decide" },
  { id: 5, a: 1274, b: 1592, light: "day", scene: "laugh" },
  { id: 6, a: 1592, b: 1974, light: "day", scene: "years" },
  { id: 7, a: 1974, b: 2387, light: "day", scene: "road" },
  { id: 8, a: 2387, b: 2781, light: "golden", scene: "finale" },
];
export const FLASH_AT = 205; // white flash at the end of the hook (as in the template)
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** one world, no place changes: always a single layer (the template crossfades only between places) */
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];
/** effective light: the years shot time-lapses, alternating day and golden every ~1.3 s */
export const lightAt = (id: number, f: number): Light => {
  if (id === 6) return ((f - 1592) % 78) < 39 ? "day" : "golden";
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

// shot 1 (hook): Manjhi CU at the ridge foot, mountain looming behind; punch on the first hammer strike
const S1a = (f: number) => dolly([4.6, 2.6, -6.0], [0.7, 1.5, -17], pushK(f, 0, 0.0022), { fov: 44 });
const S1b = (f: number) => dolly([3.1, 1.9, -9.5], [0.9, 1.35, -17.5], pushK(f, 75, 0.002, 0.006, 30), { fov: 40, roll: -0.03 });
// shot 2 (village aerial): high wide over Gehlaur, road running to the ridge and the far hospital
const S2a = (f: number) => zoom([64, 110, 165], [0, 0, -55], 46, pushK(f, 209, 0.0012));
const S2b = (f: number) => zoom([20, 38, 88], [0, 2, -35], 44, pushK(f, 390, 0.0016, 0.005, 32));
// shot 3 (the fall): side view of the steep path, then closer as she slips
const S3a = (f: number) => dolly([8.2, ridgeY(-44) + 3.6, -33], [0.2, ridgeY(-46) + 1.2, -47], pushK(f, 564, 0.0018), { fov: 42 });
const S3b = (f: number) => dolly([5.4, ridgeY(-48) + 2.8, -40.5], [0.2, ridgeY(-50) + 0.9, -50.5], pushK(f, 723, 0.0022), { fov: 40, roll: 0.03 });
// shot 4 (the decision): at home with the goats, push into Manjhi's face as he picks up the hammer
const S4a = (f: number) => dolly([2.6, 2.1, 14.6], [9.2, 1.1, 25.0], pushK(f, 918, 0.0018), { fov: 42 });
const S4b = (f: number) => dolly([5.6, 1.8, 18.6], [8.8, 1.35, 24.6], pushK(f, 1100, 0.0022, 0.005, 30), { fov: 38, roll: -0.03 });
// shot 5 (mocked): village street, the laughing group with Manjhi walking through
const S5a = (f: number) => dolly([-7.2, 2.2, 41], [0.6, 1.3, 29], pushK(f, 1274, 0.0018), { fov: 42 });
const S5b = (f: number) => dolly([-4.6, 1.9, 36.5], [0.9, 1.35, 28.6], pushK(f, 1440, 0.002), { fov: 40, roll: 0.03 });
// shot 6 (years): CU at the notch face, then a high wide as the cut grows through the ridge
const S6a = (f: number) => dolly([6.4, 2.8, -13], [0.5, 1.7, -33], pushK(f, 1592, 0.0018), { fov: 42 });
const S6b = (f: number) => zoom([30, 16, 14], [0, 9, -58], 44, pushK(f, 1780, 0.0015));
// shot 7 (the road): inside the finished cut looking through, then from the far side back at the village
const S7a = (f: number) => dolly([4.2, 2.4, -16], [0, 1.9, -72], pushK(f, 1974, 0.0016), { fov: 42 });
const S7b = (f: number) => dolly([-7.5, 3.4, -100], [0, 2.2, -48], pushK(f, 2170, 0.0018), { fov: 42, roll: -0.02 });
// shot 8 (finale): the crowd at the road mouth in golden light, slow push, then a wider crane-back
const S8a = (f: number) => dolly([9.5, 3.1, 0], [0.3, 1.6, -19], pushK(f, 2387, 0.0018), { fov: 42 });
const S8b = (f: number) => dolly([19, 8.5, 20], [0, 2.5, -38], pushK(f, 2615, 0.0012), { fov: 44 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 75, dur: 34, s: S1b }],
  2: [{ f: 209, s: S2a }, { f: 390, dur: 26, s: S2b }],
  3: [{ f: 564, s: S3a }, { f: 723, cut: true, s: S3b }],
  4: [{ f: 918, s: S4a }, { f: 1100, dur: 30, s: S4b }],
  5: [{ f: 1274, s: S5a }, { f: 1440, dur: 26, s: S5b }],
  6: [{ f: 1592, s: S6a }, { f: 1780, cut: true, s: S6b }],
  7: [{ f: 1974, s: S7a }, { f: 2170, cut: true, s: S7b }],
  8: [{ f: 2387, s: S8a }, { f: 2615, dur: 40, s: S8b }],
};
export const camAt = (id: number, f: number): Cam => run(CAMS[id], f);

// ---------------- lens: depth of field (same table pattern as the template) ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 14, focus: () => [1.0, 1.5, -16.8] },        // hook CU: Manjhi sharp, ridge soft
  { f: 209, cInf: 0 },                                        // aerial: all readable
  { f: 564, cInf: 9, focus: () => [0.2, ridgeY(-48) + 1.2, -48] }, // the path pair
  { f: 918, cInf: 12, focus: () => [8.9, 1.4, 24.8] },        // decision CU
  { f: 1274, cInf: 9, focus: () => [0.6, 1.4, 29.5] },        // street group
  { f: 1592, cInf: 10, focus: () => [1.0, 1.6, -30] },        // at the notch face
  { f: 1780, cInf: 0 },                                       // years wide
  { f: 1974, cInf: 4, focus: () => [2.6, 1.6, -30] },         // through the cut, old Manjhi near
  { f: 2387, cInf: 6, focus: () => [0.4, 1.6, -17] },         // finale crowd
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
  { a: 0, b: 209, kit: "plant_bushDetailed", pos: [5.4, 0, -11.0], s: 1.15, yaw: 0.4 },   // hook: bush bottom-right of lens
  { a: 918, b: 1274, kit: "plant_bush", pos: [3.4, 0, 17.6], s: 1.0, yaw: 1.2 },           // decision: bush bottom-left
  { a: 2387, b: 2781, kit: "plant_bushDetailed", pos: [8.8, 0, -8.5], s: 1.35, yaw: 0.9 }, // finale: bush bottom-right
];
