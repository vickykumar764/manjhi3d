// Timeline of the Bridge Hindi short ("पुल जो एक गाने पर गिर गया"): the template's Bridge story
// retimed to the 8 Hindi voice segments (public/voice-bridge.wav, 72.36 s = 2171 frames; see
// voice-bridge/timing.json, bounds [0, 239, 474, 796, 1096, 1372, 1664, 1904, 2171]).
// The story physics (front, amp, snap, drop) still run on STORY time (seconds); each shot maps its Hindi
// frame range onto a story-time window, so the collapse (SNAP, story 34.62 s) lands at Hindi frame 1430 —
// two seconds into segment 6, on the words "फिर एक ज़ोरदार आवाज़ हुई". Shots 11 (golden sway) and 12
// (park swing, the resonance lesson) are dropped: the Hindi script explains resonance before the collapse
// and spends segment 8 on the break-step rule, so the film goes water -> bank -> golden march -> tourists.
// Camera keys, DOF entries and foreground ranges are remapped through each shot's own linear frame map.
export const FPS = 30;
export const TOTAL = 2171;
export const D0 = 6.0; // bank top + deck height (m)
export const HALF = 27; // towers at z = +-27, span 54 m
export const FILES = [-1.65, -0.55, 0.55, 1.65];
export const ROW_GAP = 1.3;
export const COUNT = 74;
export const PARK: V3 = [70, D0, -75]; // swing pivot base (x, ground y, z) — unused (shot 12 dropped)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- story physics (tau = story time in seconds) ----------------
export const front = (tau: number) => 26 - 1.6 * (tau - 4.4); // z of the front row, marching toward -z
export const marchPhase = (tau: number) => ((tau % 1) + 1) % 1; // 1 Hz cycle = 2 steps/s, footfalls at 0 and 0.5
export const SNAP = 34.62, DROP0 = 36.35, DROP1 = 36.95;
export const amp = (tau: number) =>
  lin([[14.85, 0], [17.8, 0.07], [21.4, 0.13], [27.4, 0.26], [33.0, 0.46], [SNAP, 0.55], [SNAP + 0.35, 0.0]], tau);
export const stomp = (tau: number) => lin([[21.4, 1.0], [27.4, 1.35], [33, 1.5]], tau); // "a little harder every step"
export const shapeZ = (z: number) => (Math.abs(z) < HALF ? Math.cos((Math.PI * z) / (2 * HALF)) : 0);
export const dropW = (z: number) => smooth((20 - z) / 26); // 1 on the near half, 0 at the far tower
export const dropU = (tau: number) => (tau < DROP0 ? 0 : Math.min(1, ((tau - DROP0) / (DROP1 - DROP0)) ** 2));
export const DROP_H = 6.6;

export type BridgeState = { bounce: number; drop: number; snap: number; collapsed: boolean };
export const deckY = (z: number, b: BridgeState) => D0 + b.bounce * shapeZ(z) - b.drop * DROP_H * dropW(z);

// ---------------- shots ----------------
// tau(t): Hindi composition seconds -> story seconds, linear per shot over its story-time window.
// Shot 1 is the flash-forward (story 29.5-33.83, just before the snap); shot 13 replays the march in
// golden light (story 23-26.83, as in the template). Shots 11/12 are placeholders (zero length) so that
// SHOTS[id - 1] indexing still holds for ids 13-15.
export type Light = "day" | "golden";
export type Crowd = "march" | "fall" | "water" | "bank" | "tourists" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; tau: (t: number) => number; towns?: boolean };
const win = (a: number, b: number, t0: number, t1: number) => (t: number) => t0 + ((t - a / FPS) / ((b - a) / FPS)) * (t1 - t0);
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 239, light: "day", crowd: "march", tau: win(0, 239, 29.5, 33.833) },
  { id: 2, a: 239, b: 474, light: "day", crowd: "march", tau: win(239, 474, 4.333, 9.433), towns: true },
  { id: 3, a: 474, b: 640, light: "day", crowd: "march", tau: win(474, 640, 9.433, 14.8) },
  { id: 4, a: 640, b: 730, light: "day", crowd: "march", tau: win(640, 730, 14.8, 17.8) },
  { id: 5, a: 730, b: 850, light: "day", crowd: "march", tau: win(730, 850, 17.8, 21.433) },
  { id: 6, a: 850, b: 1096, light: "day", crowd: "march", tau: win(850, 1096, 21.433, 27.433) },
  { id: 7, a: 1096, b: 1304, light: "day", crowd: "march", tau: win(1096, 1304, 27.433, 32.9) },
  { id: 8, a: 1304, b: 1664, light: "day", crowd: "fall", tau: win(1304, 1664, 32.9, 37.8) },
  { id: 9, a: 1664, b: 1740, light: "day", crowd: "water", tau: win(1664, 1740, 37.8, 40.4) },
  { id: 10, a: 1740, b: 1820, light: "day", crowd: "water", tau: win(1740, 1820, 40.4, 43.433) },
  { id: 11, a: 0, b: 0, light: "golden", crowd: "none", tau: (t) => t }, // dropped (resonance lesson)
  { id: 12, a: 0, b: 0, light: "golden", crowd: "none", tau: (t) => t }, // dropped (park swing)
  { id: 13, a: 1904, b: 2050, light: "golden", crowd: "march", tau: win(1904, 2050, 23, 26.833) },
  { id: 14, a: 1820, b: 1904, light: "day", crowd: "bank", tau: win(1820, 1904, 57.833, 62.1) },
  { id: 15, a: 2050, b: TOTAL, light: "day", crowd: "tourists", tau: win(2050, TOTAL, 62.1, 67.5), towns: true },
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 9: 6, 13: 8, 14: 8, 15: 8 };
export const FLASH_AT = 239;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade.
 *  The base is the previous NON-EMPTY shot in time (shots 11/12 are placeholders; shot 13 follows shot 14). */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && s.b > s.a && f >= s.a - x / 2 && f < s.a + x / 2) {
      const prev = SHOTS.filter((p) => p.b > p.a && p.b <= s.a).sort((p, q) => q.b - p.b)[0];
      return [{ id: prev.id, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
    }
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

export const bridgeState = (id: number, t: number): BridgeState => {
  const s = SHOTS[id - 1];
  const tau = s.tau(t);
  if (id === 9 || id === 10 || id === 14) return { bounce: 0, drop: 1, snap: 1, collapsed: true };
  if (id === 12 || id === 15) return { bounce: 0, drop: 0, snap: 0, collapsed: false };
  const bounce = -amp(tau) * Math.cos(4 * Math.PI * marchPhase(tau));
  if (id === 8) return { bounce, drop: dropU(tau), snap: clamp01((tau - SNAP) / 0.7), collapsed: tau >= DROP1 };
  return { bounce, drop: 0, snap: 0, collapsed: false };
};

// ---------------- camera ----------------
// Grammar (motion.md): every move is a symmetric smootherstep glide of 18-40 f (peak speed = 1.875 x distance / dur,
// so dur >= 0.075 x the move in 720p px keeps the peak near the reference 14-25 px/f); a reframe bigger than about
// half a frame width or 40 % zoom is a hard cut on its key frame. Glides are centred on the old key frame (the
// whoosh in the sound mix peaks there), so a glide key starts dur/2 earlier. Holds push in (dolly toward the look
// point or a fov zoom near walls/towers): 0.15-0.35 %/f, ~0.6 %/f for ~35 f on the punch words. Rolls of 4-8 deg
// over >= 18 f on emphasis beats, held tilt <= 0.07 rad.
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
/** reference camera ease: symmetric smootherstep (attack = release, ~10 f each on a 23 f move) */
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
const T = (f: number) => f / FPS;
const Fz = (id: number, f: number) => front(SHOTS[id - 1].tau(T(f)));
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (with 8 f soft edges) for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** dolly push: camera slides toward the look point by factor k */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** zoom push (camera stays put, for lenses next to towers / houses): tan(fov/2) shrinks by k */
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
/** a roll-only move on top of an existing framing */
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

// near-left anchorage where the bolt lives, and the free end of the snapped backstay
export const ANCHOR: V3 = [-2.7, D0 + 0.62, -37];
export const snapEnd = (snap: number): V3 => {
  const u = easeOut(snap);
  return [ANCHOR[0] - 0.6 * u, ANCHOR[1] + 5.5 * u - 2.0 * u * u, ANCHOR[2] + 4.5 * u];
};

// ---- framings (f -> camera); each pushes in from the frame its key starts ----
// shot 1 (hook, flash-forward): wide 3/4 front -> eye-level MS of the front row -> boot level
const S1a = (f: number) => { const F = Fz(1, f); return dolly([7.5, D0 + 2.6, F - 13], [0, D0 + 2.4, F + 5], pushK(f, 0, 0.0025), { fov: 44 }); };
const S1b = (f: number) => { const F = Fz(1, f); return dolly([1.4, D0 + 1.4, F - 7.2], [0, D0 + 1.7, F + 1.5], pushK(f, 55, 0.002), { fov: 40, roll: -0.04 }); };
const S1c = (f: number) => { const F = Fz(1, f); return dolly([-0.9, D0 + 0.4, F - 4.2], [0, D0 + 0.55, F + 0.8], pushK(f, 132, 0.003), { fov: 38, roll: 0.04 }); };
// shot 2 (town aerial): zoom pushes (the last framing sits just behind the near tower)
const S2a = (f: number) => zoom([17, 13, -52], [0, 9, 4], 44, pushK(f, 233, 0.002));
const S2b = (f: number) => zoom([10, 10.5, -42], [0, 8, 8], 42, pushK(f, 317, 0.002));
const S2c = (f: number) => zoom([5, 10, -31], [0, 8.6, 30], 40, pushK(f, 403, 0.0015, 0.006, 35));
// shot 3: low front of the column -> boots CU
const S3a = (f: number) => { const F = Fz(3, f); return dolly([1.1, D0 + 1.45, F - 6.2], [0, D0 + 1.3, F + 0.6], pushK(f, 474, 0.0025)); };
const S3b = (f: number) => { const F = Fz(3, f); return dolly([0.5, D0 + 0.36, F - 3.5], [0, D0 + 0.3, F + 0.4], pushK(f, 526, 0.0018), { fov: 36 }); };
// shot 4: side view, then lower and closer on "bouncing" (punch push + roll)
const S4a = (f: number) => { const F = Fz(4, f); return dolly([13, D0 + 2.4, F + 7], [0, D0 + 1.2, F + 7], pushK(f, 640, 0.002)); };
const S4b = (f: number) => { const F = Fz(4, f); return dolly([9.5, D0 + 1.2, F + 5.5], [0, D0 + 0.95, F + 5.5], pushK(f, 693, 0.0015, 0.006, 30), { fov: 38, roll: -0.035 }); };
// shot 5: MS of the front row faces, closer on the laughing beat (roll)
const S5a = (f: number) => { const F = Fz(5, f); return dolly([0.3, D0 + 1.8, F - 4.7], [0, D0 + 1.55, F + 1.2], pushK(f, 730, 0.0025), { fov: 38 }); };
const S5b = (f: number) => { const F = Fz(5, f); return dolly([-0.5, D0 + 1.7, F - 3.5], [0, D0 + 1.6, F + 0.6], pushK(f, 776, 0.002), { fov: 36, roll: 0.04 }); };
// shot 6: whistler CU -> high wide over the column -> low 3/4 front ("a little harder every step")
const S6a = (f: number) => { const F = Fz(6, f); return dolly([0.8, D0 + 1.95, F - 2.5], [0.55, D0 + 1.85, F], pushK(f, 850, 0.003), { fov: 34 }); };
const S6b = (f: number) => { const F = Fz(6, f); return dolly([5.5, D0 + 5.5, F - 9], [0, D0 + 0.8, F + 7], pushK(f, 951, 0.002), { fov: 44, roll: -0.03 }); };
const S6c = (f: number) => { const F = Fz(6, f); return zoom([3, D0 + 1.1, F - 6.2], [0, D0 + 0.8, F + 2], 40, pushK(f, 1002, 0.003), { roll: 0.04 }); }; // zoom: the lens rides 0.38 m outside the hangers
// shot 7: wide ahead of the column -> chain close-up -> MS of the nervous front row
const S7a = (f: number) => { const F = Fz(7, f); return zoom([-3.0, D0 + 1.4, F - 11], [0, D0 + 1.7, F + 3], 46, pushK(f, 1096, 0.002), { roll: -0.03 }); }; // zoom: outside the hangers
const S7b = (f: number) => { const F = Fz(7, f); return dolly([-5.4, D0 + 4.6, F - 2.0], [-2.7, D0 + 3.4, F + 2.5], pushK(f, 1157, 0.003), { fov: 40, roll: 0.02 }); };
const S7c = (f: number) => { const F = Fz(7, f); return dolly([0, D0 + 1.8, F - 3.7], [0, D0 + 1.75, F + 0.3], pushK(f, 1225, 0.0025), { fov: 36 }); };
// shot 8: anchor insert (punch on "a single bolt"), snap follow, aerial, down at the water
const S8a = (f: number) => dolly([-2.35, D0 + 1.25, -38.9], [ANCHOR[0], ANCHOR[1] + 0.3, ANCHOR[2]], pushK(f, 1304, 0.0025, 0.006, 35), { fov: 34 });
const S8b = (f: number) => { const u = glide((f - 1431) / 54); return { pos: [0.9, D0 + 2.2 + 0.3 * u, -41.2 - 0.4 * u] as V3, look: [-2.9 - 0.2 * u, ANCHOR[1] + 1.6 + 1.0 * u, -35 + 1.2 * u] as V3, fov: 38, roll: 0.04 }; };
const S8c = (f: number) => dolly([4.5, 15, -45], [0, 3.2, -14], pushK(f, 1488, 0.0025), { fov: 42 });
const S8d = (f: number) => dolly([7.5, 2.4, -25], [0, 2.0, -17.5], pushK(f, 1578, 0.002), { fov: 44, roll: -0.04 });
// shots 9-10 share one camera (no visible cut at 1740): sitters in the river, closer on the "shallow" beat (roll)
const S9a = (f: number) => dolly([1.5, 0.55, -24.6], [0, 0.62, -18], pushK(f, 1658, 0.0018), { fov: 40, roll: -0.03 }); // lens at face height, 3 m from the first row
const S10a = (f: number) => dolly([0.9, 0.5, -24.2], [0, 0.65, -19], pushK(f, 1736, 0.0018), { fov: 37, roll: 0.04 });
// shot 13: golden march side view, lens ~2.45 m over the deck and 3-4 m outside the rail
const S13a = (f: number) => { const F = Fz(13, f); return dolly([5.75, D0 + 2.45, F + 3.1], [0, D0 + 1.5, F + 6.5], pushK(f, 1896, 0.002), { fov: 44 }); }; // 3/4 from ahead: files spread, no hat totem
const S13b = (f: number) => { const F = Fz(13, f); return dolly([4.8, D0 + 2.45, F + 4], [0, D0 + 1.3, F + 4], pushK(f, 1987, 0.0025), { fov: 40 }); };
// shot 14: dazed soldiers on the bank, then the officer at the sign (kicks on the hammer blows)
const S14a = (f: number) => dolly([-4.7, D0 + 1.5, -40.4], [-4.6, D0 + 0.85, -33], pushK(f, 1816, 0.002), { fov: 42 });
const S14b = (f: number) => zoom([1.3, D0 + 1.6, -36.6], [2.9, D0 + 1.3, -31.2], 42, pushK(f, 1843, 0.0025, 0.004, 24)); // 0.4 %/f push eased (8 f) into a 0.25 %/f creep by the first blow
// shot 15: tourists on the rebuilt bridge, punch on "the best drilled soldiers", crane out to the end
const S15a = (f: number) => dolly([1.7, D0 + 1.75, -15.5], [0, D0 + 1.5, -9], pushK(f, 2046, 0.0025), { fov: 40 });
const S15b = (f: number) => dolly([-1.3, D0 + 1.6, -13], [0, D0 + 1.5, -7.5], pushK(f, 2070, 0.0015, 0.006, 32), { fov: 38 });
/** crane out: a curved path (quadratic Bezier over the near chain, 1.2 m above it) so the lens never threads the hangers */
const CRANE: V3[] = [[0, 18, -16], [17, 15, -44], [0, 7, 2]];
const S15c = (f: number): Shot => {
  const a = S15b(2102), s = glide((f - 2102) / 69), r = 1 - s, [C, B, L] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * B[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 40) + (44 - (a.fov ?? 40)) * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 55, dur: 68, s: S1b },
    { f: 132, dur: 59, s: S1c },
  ],
  2: [
    { f: 233, s: S2a },
    { f: 317, dur: 28, s: S2b },
    { f: 403, dur: 28, s: S2c },
  ],
  3: [
    { f: 474, s: S3a },
    { f: 526, dur: 41, s: S3b },
  ],
  4: [
    { f: 640, s: S4a },
    { f: 693, cut: true, s: S4b },
    { f: 693, dur: 20, s: rolled(S4b, 0.035) },
  ],
  5: [
    { f: 730, s: S5a },
    { f: 776, dur: 20, s: S5b },
    { f: 803, dur: 22, s: rolled(S5b, -0.035) },
  ],
  6: [
    { f: 850, s: S6a },
    { f: 951, cut: true, s: S6b },
    { f: 1002, dur: 40, s: S6c },
  ],
  7: [
    { f: 1096, s: S7a },
    { f: 1157, cut: true, s: S7b },
    { f: 1225, cut: true, s: S7c },
  ],
  8: [
    { f: 1304, s: S8a },
    { f: 1431, cut: true, s: S8b }, // cut on the snap (story 34.62 s = Hindi frame 1430)
    { f: 1488, cut: true, s: S8c },
    { f: 1578, cut: true, s: S8d },
  ],
  9: [
    { f: 1658, s: S9a },
    { f: 1736, dur: 18, s: S10a }, // runs across the invisible 9 -> 10 change
  ],
  13: [
    { f: 1896, s: S13a },
    { f: 1987, cut: true, s: S13b },
  ],
  14: [
    { f: 1816, s: S14a },
    { f: 1843, cut: true, s: S14b }, // cut to the officer
  ],
  15: [
    { f: 2046, s: S15a },
    { f: 2070, dur: 22, s: S15b },
    { f: 2102, cut: true, s: S15c }, // crane pull-out on its own curved path
  ],
};
CAMS[10] = CAMS[9];
// shots 11-12 are zero-length placeholders (dropped from the Hindi cut) but world.ts sightLines()
// still iterates every SHOTS entry, so they need a valid camera table too; they are never displayed.
CAMS[11] = CAMS[10];
CAMS[12] = CAMS[10];

// impact kicks (Hindi frame times): the snap at 47.68 s, the drop at 53.39 s, the officer's hammer
// blows at 61.95 / 62.31 / 63.20 s. The image offset flips sign every frame, decays to 0 in 7 f.
const KICKS: [number, number][] = [[47.68, 1], [53.39, 1.6], [61.95, 0.5], [62.31, 0.5], [63.2, 0.7]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a; // metres at the look distance for 3 px x a
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** frame at which the current key's move has finished (for picking billboard views per key, not per frame) */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
/** Lens blur per shot (thin lens). cInf = blur-disc radius in px at 1080x1920 for things at infinity; 0 = all sharp.
 *  Entries switch on cuts (no dur) or ramp with the camera glide they share f/dur with. focus = world point (else the
 *  camera look point). Remapped to Hindi frames from the template's table. */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const eyes = (id: number) => (f: number): V3 => [0, D0 + 1.6, Fz(id, f)];
const boots = (id: number) => (f: number): V3 => [0, D0 + 0.3, Fz(id, f)];
export const DOF: Dof[] = [
  { f: 0, cInf: 15, focus: eyes(1) }, // hook wide: front row sharp, town soft
  { f: 55, dur: 68, cInf: 15, focus: eyes(1) }, // eye-level MS of the front row
  { f: 132, dur: 59, cInf: 15, focus: boots(1) }, // boot level
  { f: 239, cInf: 0 }, // town aerial (establishing, under the flash)
  { f: 526, dur: 41, cInf: 14, focus: boots(3) }, // boots CU (ramps with the glide down)
  { f: 640, cInf: 0 }, // side views
  { f: 730, cInf: 10, focus: eyes(5) }, // MS faces
  { f: 776, dur: 20, cInf: 12, focus: eyes(5) }, // closer MS, laughing beat
  { f: 850, cInf: 14 }, // whistler CU, focus = look (his face)
  { f: 951, cInf: 0 }, // high wide, low 3/4, wide ahead, chain close-up
  { f: 1225, cInf: 12, focus: eyes(7) }, // MS, nervous front row
  { f: 1304, cInf: 14 }, // anchor insert, focus = look (the bolt)
  { f: 1431, cInf: 10 }, // snap insert
  { f: 1488, cInf: 0 }, // aerial + water-level drop: kept readable
  { f: 1664, cInf: 16, focus: () => [0.6, 0.6, -21.6] }, // river sitters (shots 9-10): first-row faces sharp, quay ~13 px
  { f: 1820, cInf: 8 }, // bank, dazed soldiers behind a foreground cart, focus = look
  { f: 1843, cInf: 12, focus: () => [3.35, D0 + 1.6, -31.55] }, // officer MS at the sign (his eyes), bush in front
  { f: 1904, cInf: 0 }, // golden march (riding with the column)
  { f: 2050, cInf: 0 }, // tourists (busy crowd beat, kept sharp), crane out
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
/** what the lens focuses on (DOF): the DOF table's focus point, else the camera look point */
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

/** near framing objects: visible while a <= f < b; kit = a GLB name accepted by build.ts prop() */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  // bank, dazed soldiers (S14a, focus ~7.4 m): a cart in the bottom-left corner at ~2.6 m
  { a: 1820, b: 1843, kit: "cart", pos: [-3.8, D0, -38.0], s: 0.85, yaw: 0.6 },
];
