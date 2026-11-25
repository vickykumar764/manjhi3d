// Timeline of the Bridge FAST short ("पुल जो एक गाने पर गिर गया", fast-cut version): the Bridge Hindi timeline
// with the camera re-cut for fast-short pacing — same story physics, same shots, same staging, same narration
// (public/voice-bridge.wav), but every narration segment is subdivided into 60-90 f sub-shots with hard cuts
// and punchy push-ins. The template's Bridge story
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
// FAST grammar: sub-shots are 60-90 f; joins are hard cuts (one 14 f reframe in shot 4). Each sub-shot
// pushes in at 0.3-0.5 %/f (punch 0.6-0.7 %/f for ~30 f on emphasis beats) — the subject visibly grows
// inside every sub-shot, so the picture never sits still. Rolls of 2-4 deg on emphasis beats.
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

// ---- framings (f -> camera); FAST-CUT version: hard cuts every ~60-90 f (2-3 s), each sub-shot a clearly
// different framing of the same story beat, with a short punchy push-in (pushK rate 0.003-0.005, punch to
// 0.006-0.007 on emphasis beats) instead of the template's long slow glides. One exception: shot 4 reframes
// with a fast 14 f glide (side wide -> low punch inside one breath). ----
// shot 1 (hook, flash-forward): wide 3/4 front -> eye-level MS from the left -> boot level
const F1a = (f: number) => { const F = Fz(1, f); return dolly([7.5, D0 + 2.6, F - 13], [0, D0 + 2.4, F + 5], pushK(f, 0, 0.004), { fov: 44 }); };
const F1b = (f: number) => { const F = Fz(1, f); return dolly([-1.6, D0 + 1.5, F - 6.8], [0, D0 + 1.7, F + 1.5], pushK(f, 80, 0.004), { fov: 40, roll: 0.03 }); };
const F1c = (f: number) => { const F = Fz(1, f); return dolly([-0.9, D0 + 0.4, F - 4.2], [0, D0 + 0.55, F + 0.8], pushK(f, 160, 0.005), { fov: 38, roll: -0.04 }); };
// shot 2 (town aerial): wide from the right -> wide from the left, lower -> just behind the near tower
const F2a = (f: number) => zoom([17, 13, -52], [0, 9, 4], 44, pushK(f, 239, 0.003));
const F2b = (f: number) => zoom([-13, 11, -46], [0, 8.5, 6], 42, pushK(f, 318, 0.003));
const F2c = (f: number) => zoom([5, 10, -31], [0, 8.6, 30], 40, pushK(f, 397, 0.003, 0.007, 30));
// shot 3: low front of the column -> boots CU
const F3a = (f: number) => { const F = Fz(3, f); return dolly([1.1, D0 + 1.45, F - 6.2], [0, D0 + 1.3, F + 0.6], pushK(f, 474, 0.004)); };
const F3b = (f: number) => { const F = Fz(3, f); return dolly([0.5, D0 + 0.36, F - 3.5], [0, D0 + 0.3, F + 0.4], pushK(f, 557, 0.004), { fov: 36 }); };
// shot 4: side wide -> low side punch on "bouncing" (punch push + roll)
const F4a = (f: number) => { const F = Fz(4, f); return dolly([13, D0 + 2.4, F + 7], [0, D0 + 1.2, F + 7], pushK(f, 640, 0.004)); };
const F4b = (f: number) => { const F = Fz(4, f); return dolly([9.5, D0 + 1.2, F + 5.5], [0, D0 + 0.95, F + 5.5], pushK(f, 685, 0.003, 0.007, 28), { fov: 38, roll: -0.035 }); };
// shot 5: MS of the front row faces -> closer from the other side (laughing beat, roll)
const F5a = (f: number) => { const F = Fz(5, f); return dolly([0.3, D0 + 1.8, F - 4.7], [0, D0 + 1.55, F + 1.2], pushK(f, 730, 0.004), { fov: 38 }); };
const F5b = (f: number) => { const F = Fz(5, f); return dolly([-0.5, D0 + 1.7, F - 3.5], [0, D0 + 1.6, F + 0.6], pushK(f, 790, 0.004), { fov: 36, roll: 0.04 }); };
// shot 6: whistler CU -> high wide over the column -> low 3/4 front
const F6a = (f: number) => { const F = Fz(6, f); return dolly([0.8, D0 + 1.95, F - 2.5], [0.55, D0 + 1.85, F], pushK(f, 850, 0.005), { fov: 34 }); };
const F6b = (f: number) => { const F = Fz(6, f); return dolly([5.5, D0 + 5.5, F - 9], [0, D0 + 0.8, F + 7], pushK(f, 932, 0.0035), { fov: 44, roll: -0.03 }); };
const F6c = (f: number) => { const F = Fz(6, f); return zoom([3, D0 + 1.1, F - 6.2], [0, D0 + 0.8, F + 2], 40, pushK(f, 1014, 0.0045), { roll: 0.04 }); }; // zoom: the lens rides outside the hangers
// shot 7: wide ahead of the column -> chain close-up -> from behind the column, over the backs
const F7a = (f: number) => { const F = Fz(7, f); return zoom([-3.0, D0 + 1.4, F - 11], [0, D0 + 1.7, F + 3], 46, pushK(f, 1096, 0.0035), { roll: -0.03 }); }; // zoom: outside the hangers
const F7b = (f: number) => { const F = Fz(7, f); return dolly([-5.4, D0 + 4.6, F - 2.0], [-2.7, D0 + 3.4, F + 2.5], pushK(f, 1165, 0.0045), { fov: 40, roll: 0.02 }); };
const F7c = (f: number) => { const F = Fz(7, f); return dolly([2.2, D0 + 2.3, F + 29], [0, D0 + 1.2, F + 4], pushK(f, 1235, 0.004), { fov: 42 }); };
// shot 8: anchor insert -> side view of the swaying deck -> snap follow -> aerial -> low river-side (the drop) -> down at the water
const F8a = (f: number) => dolly([-2.35, D0 + 1.25, -38.9], [ANCHOR[0], ANCHOR[1] + 0.3, ANCHOR[2]], pushK(f, 1304, 0.004, 0.007, 30), { fov: 34 });
const F8b = (f: number) => dolly([10.5, D0 + 2.0, -19], [0, D0 + 1.0, -9], pushK(f, 1372, 0.0035), { fov: 42, roll: 0.03 });
const F8c = (f: number) => { const u = glide((f - 1431) / 54); return { pos: [0.9, D0 + 2.2 + 0.3 * u, -41.2 - 0.4 * u] as V3, look: [-2.9 - 0.2 * u, ANCHOR[1] + 1.6 + 1.0 * u, -35 + 1.2 * u] as V3, fov: 38, roll: 0.04 }; };
const F8d = (f: number) => dolly([4.5, 15, -45], [0, 3.2, -14], pushK(f, 1488, 0.004), { fov: 42 });
const F8e = (f: number) => dolly([-7.5, 1.6, -31], [0, 4.2, -15], pushK(f, 1550, 0.0035), { fov: 44, roll: -0.03 });
const F8f = (f: number) => dolly([7.5, 2.4, -25], [0, 2.0, -17.5], pushK(f, 1612, 0.0035), { fov: 44, roll: -0.04 });
// shots 9-10: sitters in the river; the fast cut replaces the old invisible join with a real cut at 1740
const F9a = (f: number) => dolly([1.5, 0.55, -24.6], [0, 0.62, -18], pushK(f, 1664, 0.003), { fov: 40, roll: -0.03 }); // lens at face height, 3 m from the first row
const F10a = (f: number) => dolly([0.9, 0.5, -24.2], [0, 0.65, -19], pushK(f, 1740, 0.003), { fov: 37, roll: 0.04 });
// shot 14: dazed soldiers on the bank -> hard cut to the officer at the sign, on the first hammer blow (frame ~1858)
const F14a = (f: number) => dolly([-4.7, D0 + 1.5, -40.4], [-4.6, D0 + 0.85, -33], pushK(f, 1820, 0.0035), { fov: 42 });
const F14b = (f: number) => zoom([1.3, D0 + 1.6, -36.6], [2.9, D0 + 1.3, -31.2], 42, pushK(f, 1860, 0.004, 0.006, 24));
// shot 13: golden march, side view -> front 3/4 in golden light
const F13a = (f: number) => { const F = Fz(13, f); return dolly([5.75, D0 + 2.45, F + 3.1], [0, D0 + 1.5, F + 6.5], pushK(f, 1904, 0.004), { fov: 44 }); }; // 3/4 from ahead: files spread, no hat totem
const F13b = (f: number) => { const F = Fz(13, f); return dolly([-4.6, D0 + 2.0, F - 6.5], [0, D0 + 1.4, F + 2], pushK(f, 1977, 0.004), { fov: 40, roll: 0.03 }); };
// shot 15: tourists on the rebuilt bridge, punch-in -> crane out to the end
const F15a = (f: number) => dolly([1.7, D0 + 1.75, -15.5], [0, D0 + 1.5, -9], pushK(f, 2050, 0.003, 0.007, 30), { fov: 40 });
/** crane out: a curved path (quadratic Bezier over the near chain, 1.2 m above it) so the lens never threads the hangers */
const CRANE: V3[] = [[0, 18, -16], [17, 15, -44], [0, 7, 2]];
const F15c = (f: number): Shot => {
  const a = F15a(2110), s = glide((f - 2110) / 61), r = 1 - s, [C, B, L] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * B[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 40) + (44 - (a.fov ?? 40)) * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: F1a },
    { f: 80, cut: true, s: F1b },
    { f: 160, cut: true, s: F1c },
  ],
  2: [
    { f: 239, s: F2a },
    { f: 318, cut: true, s: F2b },
    { f: 397, cut: true, s: F2c },
  ],
  3: [
    { f: 474, s: F3a },
    { f: 557, cut: true, s: F3b },
  ],
  4: [
    { f: 640, s: F4a },
    { f: 685, dur: 14, s: F4b }, // fast reframe inside the breath: side wide -> low punch
  ],
  5: [
    { f: 730, s: F5a },
    { f: 790, cut: true, s: F5b },
  ],
  6: [
    { f: 850, s: F6a },
    { f: 932, cut: true, s: F6b },
    { f: 1014, cut: true, s: F6c },
  ],
  7: [
    { f: 1096, s: F7a },
    { f: 1165, cut: true, s: F7b },
    { f: 1235, cut: true, s: F7c },
  ],
  8: [
    { f: 1304, s: F8a },
    { f: 1372, cut: true, s: F8b },
    { f: 1430, cut: true, s: F8c }, // cut on the snap (story 34.62 s = Hindi frame 1430)
    { f: 1488, cut: true, s: F8d },
    { f: 1550, cut: true, s: F8e }, // the deck drops (story 36.35 s) ~8 f into this low angle
    { f: 1612, cut: true, s: F8f },
  ],
  9: [{ f: 1664, s: F9a }],
  10: [{ f: 1740, s: F10a }],
  13: [
    { f: 1904, s: F13a },
    { f: 1977, cut: true, s: F13b },
  ],
  14: [
    { f: 1820, s: F14a },
    { f: 1860, cut: true, s: F14b }, // cut to the officer on the hammer blows
  ],
  15: [
    { f: 2050, s: F15a },
    { f: 2110, cut: true, s: F15c }, // crane pull-out on its own curved path
  ],
};
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
  { f: 80, cInf: 15, focus: eyes(1) }, // eye-level MS from the left
  { f: 160, cInf: 15, focus: boots(1) }, // boot level
  { f: 239, cInf: 0 }, // town aerials (establishing, under the flash)
  { f: 474, cInf: 0 }, // low front of the column
  { f: 557, cInf: 14, focus: boots(3) }, // boots CU
  { f: 640, cInf: 0 }, // side wide
  { f: 685, cInf: 8, focus: eyes(4) }, // low side punch
  { f: 730, cInf: 10, focus: eyes(5) }, // MS faces
  { f: 790, cInf: 12, focus: eyes(5) }, // closer MS, laughing beat
  { f: 850, cInf: 14 }, // whistler CU, focus = look (his face)
  { f: 932, cInf: 0 }, // high wide, low 3/4, wide ahead, chain CU, behind the column: kept sharp
  { f: 1304, cInf: 14 }, // anchor insert, focus = look (the bolt)
  { f: 1372, cInf: 0 }, // side view of the swaying deck
  { f: 1430, cInf: 10 }, // snap insert
  { f: 1488, cInf: 0 }, // aerial + low drop angle + water-level: kept readable
  { f: 1664, cInf: 16, focus: () => [0.6, 0.6, -21.6] }, // river sitters (shots 9-10): first-row faces sharp
  { f: 1740, cInf: 16, focus: () => [0.6, 0.6, -21.6] }, // closer on the "shallow" beat, same focus point
  { f: 1820, cInf: 8 }, // bank, dazed soldiers behind a foreground cart, focus = look
  { f: 1860, cInf: 12, focus: () => [3.35, D0 + 1.6, -31.55] }, // officer MS at the sign (his eyes), bush in front
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
