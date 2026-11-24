// The cast as lit flat sprites in the 3D world — the bridge template's pool / actor / person machinery,
// with the staging rewritten for the Manjhi story: Manjhi (young + old), his wife, the villagers of
// Gehlaur, and his goats (drawn in the same ink style; the template has no animal, so the goat is a
// small Pen drawing on the same 600 x 1000 design canvas).
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, KID, fxBurst, fxPuff, fxStars, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS, SHOTS, V3, clamp01, smooth, lightAt, ridgeY } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool (template, unchanged) ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes (template, unchanged) ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
const ROOTS = new Set<THREE.Object3D>();

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements (template types) ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light (template) ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- blinks (template) ----------------
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number) => {
  const f = Math.round(t * FPS);
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

// ---------------- contact blobs (template) ----------------
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- the Manjhi cast ----------------
export const MANJHI: Outfit = { jacket: "#e8762c", pants: "#77603c", boots: "#4a3426", hat: "hair", hair: "#2a1c12", skin: "#c99067" };
export const MANJHI_OLD: Outfit = { jacket: "#cf7a3d", pants: "#77603c", boots: "#4a3426", hat: "hair", hair: "#d8d8d2", moustache: "#d8d8d2", skin: "#c99067" };
const WIFE: Outfit = townsfolk(1); // bonnet + dress
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const folk = (i: number): Who => ({ i: 100 + i, o: FOLK[i % 6], okey: `f${i % 6}` });

/** hammer cycle: raise (k 1 -> 0), strike (k -> 1), rest. Strike lands at phase 0.63 of every period. */
const hammerK = (t: number, period: number, off = 0) => {
  const p = (((t + off) % period) + period) % period / period;
  return p < 0.55 ? 1 - smooth(p / 0.55) : p < 0.63 ? (p - 0.55) / 0.08 : 1;
};
/** impact bursts + dust at the strike times of a hammer cycle */
const strikes = (out: Stage, t: number, period: number, off: number, x: number, y: number, z: number, size = 0.85) => {
  for (let n = -1; n < 3; n++) {
    const ts = (Math.floor((t + off) / period) + n) * period - off + 0.63 * period;
    const age = t - ts;
    if (age >= 0 && age < 0.4) {
      const u = q(age / 0.4, 24);
      out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u), x, y, z, w: size, h: size });
    }
    if (age >= 0.05 && age < 0.8) {
      const u = q((age - 0.05) / 0.75, 24);
      out.fx.push({ key: `puff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x: x + 0.15, y: y - 0.25, z, w: 0.62, h: 0.62, soft: true });
    }
  }
};

/** a goat in the cast's ink style on the same design canvas (head up = graze 0, head down eating = 1) */
const goatDraw = (graze: number) => (p: Pen) => {
  const ink = "#2a1c12", coat = "#efe6d8", patch = "#d9c6a6", dark = "#7a5c3e";
  for (const lx of [218, 252, 368, 402]) p.stroke([[lx, 690], [lx + (lx > 300 ? 6 : -4), 962]], 17, dark);
  p.stroke([[168, 585], [128, 495], [150, 470]], 15, dark); // tail up
  p.ell(300, 618, 168, 96, coat, 7);
  p.ell(352, 592, 62, 40, patch, 0);
  const hx = 478 + graze * 30, hy = 512 + graze * 138;
  p.stroke([[415, 590], [hx - 18, hy + 6]], 34, coat); // neck
  p.ell(hx, hy, 64, 47, coat, 7, 0, 360, -0.35);
  p.ell(hx - 34, hy - 30, 27, 12, "#e2d2ba", 5, 0, 360, 0.5); // ear
  p.arc(hx - 8, hy - 38, 30, 24, 195, 320, 9, "#8a6a48");    // horns
  p.arc(hx + 16, hy - 34, 22, 18, 200, 320, 8, "#8a6a48");
  p.poly([[hx + 26, hy + 34], [hx + 40, hy + 34], [hx + 33, hy + 58]], dark, 0); // beard
  p.dot(hx + 22, hy - 2, 6.5, ink);
  p.stroke([[hx + 52, hy + 14], [hx + 62, hy + 20]], 5, ink);
};
const goat = (out: Stage, i: number, x: number, z: number, mirror: boolean, graze: number, sc = 0.62) => {
  const g = q(graze, 6);
  out.places.push({ key: `goat|${g}`, draw: goatDraw(g), x, y: 0, z, scale: sc, mirror, size: [480, 800, 0.8] });
  blob(out, x, 0, z, sc);
};

// ---------------- staging per shot ----------------
const stand = (cam: CamInfo, out: Stage, t: number, who: Who, x: number, y: number, z: number, fo: FrontOpts, sc = 1) => {
  out.places.push(person(cam, who, x, y, z, { side: false, mirror: false }, { mode: "stand", blink: lidAt(t, who.i), ...fo }, {}, sc));
  blob(out, x, y, z, sc);
};

export const stage = (id: number, f: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], lt = t - s.a / FPS, u = clamp01((f - s.a) / (s.b - s.a));
  LNAME = lightAt(id, f);
  findSun(cam, SUN);
  const M: Who = { i: 1, o: MANJHI, okey: "manjhi" };
  const MO: Who = { i: 2, o: MANJHI_OLD, okey: "manjhiOld" };
  const W: Who = { i: 3, o: WIFE, okey: "wife" };

  if (s.scene === "hook") {
    // Manjhi alone before the mountain, hammer falling on the boulder in front of him
    const k = hammerK(t, 1.1, 0.5);
    out.places.push(person(cam, M, 1.2, 0, -16.5, { side: false, mirror: false },
      { mode: "stand", expr: "stern", prop: ["hammer", q(k, 30)], blink: lidAt(t, 1) }, {}, 1.15));
    blob(out, 1.2, 0, -16.5, 1.15);
    strikes(out, t, 1.1, 0.5, 0.1, 0.85, -18.4, 0.9);
  }

  if (s.scene === "village") {
    // Gehlaur from the air: folk in the streets, two walkers, and the couple setting out on the road
    const spots: [number, number][] = [[-14, 26], [-9, 38], [6, 22], [12, 44], [-20, 52], [18, 58], [3, 64], [-6, 70], [24, 30], [-26, 34], [9, 80], [-16, 84]];
    spots.forEach(([x, z], i) => stand(cam, out, t, folk(i), x, 0, z, { expr: i % 3 ? "neutral" : "smile", wave: i % 4 === 1 ? q(Math.sin(t * 2 + i), 30) : undefined }));
    for (let i = 0; i < 2; i++) {
      const x = -26 + ((t * 1.05 + i * 21) % 52), z = 31 + i * 9;
      const view = viewOf(cam, x, z, 1, 0);
      out.places.push(person(cam, folk(i + 3), x, 0, z, view, { mode: "stand", expr: "neutral" },
        { mode: "march", phase: q((t * 1.35 + i * 0.4) % 1, 60), expr: "neutral", blink: lidAt(t, i + 30), stride: view.fs }));
      blob(out, x, 0, z);
    }
    const cz = 8 - (f - s.a) * 0.05;
    const view = viewOf(cam, 1.0, cz, 0, -1);
    out.places.push(person(cam, W, 0.2, 0, cz, view, { mode: "stand", expr: "smile" }, { mode: "march", phase: q((t * 1.3) % 1, 60), expr: "smile", stride: view.fs }));
    out.places.push(person(cam, M, 1.6, 0, cz + 1.5, view, { mode: "stand", expr: "neutral" }, { mode: "march", phase: q((t * 1.3 + 0.5) % 1, 60), expr: "neutral", stride: view.fs }));
  }

  if (s.scene === "fall") {
    // the steep path over the ridge: they climb, she slips, he reaches her and sits with her
    const climb = smooth(u / 0.45);
    const wz = -40 - 9.5 * climb, wy = ridgeY(wz);
    if (u < 0.45) {
      const view = viewOf(cam, 0.3, wz, 0, -1);
      out.places.push(person(cam, W, 0.3, wy, wz, view, { mode: "stand", expr: "neutral" },
        { mode: "march", phase: q((t * 1.25) % 1, 60), expr: "neutral", blink: lidAt(t, 3), stride: view.fs }));
      const mz = wz + 1.8;
      const view2 = viewOf(cam, 0.9, mz, 0, -1);
      out.places.push(person(cam, M, 0.9, ridgeY(mz), mz, view2, { mode: "stand", expr: "neutral" },
        { mode: "march", phase: q((t * 1.25 + 0.5) % 1, 60), expr: "neutral", blink: lidAt(t, 1), stride: view2.fs }));
    } else if (u < 0.58) {
      const k = (u - 0.45) / 0.13, fz = wz - 0.8 * k, fy = ridgeY(fz);
      out.places.push(person(cam, W, 0.3, fy, fz, { side: false, mirror: false },
        { mode: "fall", expr: "shock", tilt: 42 * smooth(k), blink: 0 }, {}));
      const mz = wz + 1.8 - 1.1 * k;
      out.places.push(person(cam, M, 0.9, ridgeY(mz), mz, { side: false, mirror: false },
        { mode: "stand", expr: "shock", blink: lidAt(t, 1) }, {}));
      if (k > 0.5) {
        const uu = q((k - 0.5) * 2, 24);
        out.fx.push({ key: `puff${uu}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, uu), x: 0.3, y: fy + 0.3, z: fz, w: 1.1, h: 1.1, soft: true });
      }
    } else {
      const fz = wz - 0.8, fy = ridgeY(fz);
      out.places.push(person(cam, W, 0.3, fy, fz, { side: false, mirror: false },
        { mode: "sit", expr: "pained", blink: lidAt(t, 3) }, {}));
      const uu = (t * 0.8) % 1;
      out.fx.push({ key: `stars${q(uu, 30)}`, cw: 420, ch: 210, draw: (p) => fxStars(p, q(uu, 30)), x: 0.3, y: fy + 1.45, z: fz, w: 0.8, h: 0.4 });
      if (u < 0.78) {
        out.places.push(person(cam, M, 1.5, ridgeY(fz + 0.6), fz + 0.6, { side: false, mirror: false },
          { mode: "stand", expr: "nervous", blink: lidAt(t, 1) }, {}));
      } else {
        out.places.push(person(cam, M, 1.6, ridgeY(fz + 0.4), fz + 0.4, { side: false, mirror: false },
          { mode: "sit", expr: "nervous", blink: lidAt(t, 1) }, {}));
      }
    }
  }

  if (s.scene === "decide") {
    // home: the goats graze; Manjhi thinks, then picks up the hammer with a set face
    goat(out, 1, 11.6, 27.6, false, 0.5 + 0.5 * Math.sin(t * 0.7));
    goat(out, 2, 13.4, 25.6, true, 0.5 + 0.5 * Math.sin(t * 0.55 + 2));
    goat(out, 3, 10.9, 29.6, false, 0.5 + 0.5 * Math.sin(t * 0.8 + 4));
    stand(cam, out, t, folk(3), 5.2, 0, 28.4, { expr: "neutral" });
    const expr: Expr = u < 0.45 ? "neutral" : "stern";
    const fo: FrontOpts = { expr, headTilt: u < 0.45 ? 0.05 : 0, blink: lidAt(t, 1) };
    if (u >= 0.6) fo.prop = ["hammer", 0.12];
    out.places.push(person(cam, M, 8.8, 0, 24.6, { side: false, mirror: false }, fo, {}, 1.05));
    blob(out, 8.8, 0, 24.6, 1.05);
  }

  if (s.scene === "laugh") {
    // the street laughs; Manjhi walks through it, unbothered, hammer on his way to the mountain
    const arc: [number, number][] = [[-4.6, 28.6], [-2.8, 29.8], [-1.0, 28.4], [2.7, 28.6], [4.5, 29.8], [6.3, 28.4]];
    arc.forEach(([x, z], i) => stand(cam, out, t, folk(i + 1), x, 0, z,
      { expr: i % 2 ? "laugh" : "grin", wave: i % 3 === 0 ? q(Math.sin(t * 3.2 + i * 1.4), 30) : undefined }));
    const kid: Who = { i: 140, o: KID, okey: "kid" };
    out.places.push(person(cam, kid, -3.7, Math.abs(Math.sin(t * 5)) * 0.14, 30.6, { side: false, mirror: false },
      { mode: "stand", expr: "laugh", blink: lidAt(t, 40) }, {}, 0.72));
    const mz = 40 - lt * 3.1;
    const view = viewOf(cam, 0.9, mz, 0, -1);
    out.places.push(person(cam, M, 0.9, 0, mz, view, { mode: "stand", expr: "stern" },
      { mode: "march", phase: q((t * 1.3) % 1, 60), expr: "stern", blink: lidAt(t, 1), stride: view.fs }, 1.05));
    blob(out, 0.9, 0, mz, 1.05);
  }

  if (s.scene === "years") {
    // at the notch mouth, chipping year after year; the hair greys late in the shot
    const who = u < 0.62 ? M : MO;
    const k = hammerK(t, 0.8, 0.2);
    out.places.push(person(cam, who, 1.2, 0, -29, { side: false, mirror: false },
      { mode: "stand", expr: "stern", prop: ["hammer", q(k, 30)], blink: lidAt(t, 1) }, {}, 1.05));
    blob(out, 1.2, 0, -29, 1.05);
    strikes(out, t, 0.8, 0.2, 0.0, 0.9, -31.4, 0.75);
    if (f >= 1780) {
      stand(cam, out, t, folk(2), 10.5, 0, -13, { expr: "neutral" });
      stand(cam, out, t, folk(4), -9.5, 0, -11, { expr: "smile" });
    }
  }

  if (s.scene === "road") {
    // the finished cut: folk stroll through it both ways; old Manjhi waves them through
    for (let i = 0; i < 7; i++) {
      const north = i % 2 === 0, sp = 1.15 + hh(i, 5) * 0.5;
      const z = north ? -118 + ((t * sp + i * 23) % 155) : 35 - ((t * sp + i * 31) % 155);
      if (z < -118 || z > 35) continue;
      const x = north ? -1.25 : 1.25;
      const view = viewOf(cam, x, z, 0, north ? 1 : -1);
      out.places.push(person(cam, folk(i), x, 0, z, view, { mode: "stand", expr: "smile" },
        { mode: "march", phase: q((t * sp * 1.25 + i * 0.3) % 1, 60), expr: "smile", blink: lidAt(t, i + 50), stride: view.fs }));
      blob(out, x, 0, z);
    }
    stand(cam, out, t, MO, 2.9, 0, -31, { expr: "relief_open", wave: q(Math.sin(t * 2.1), 30) }, 1.05);
  }

  if (s.scene === "finale") {
    // golden hour at the road mouth: the village honours old Manjhi
    const ring: [number, number][] = [[-7.5, -13], [-5.2, -19.5], [-3.4, -12.4], [-1.6, -21], [2.8, -20.5], [4.6, -12.6], [6.4, -18.5], [8.2, -13.5],
      [-6.3, -24.5], [5.6, -25], [-8.6, -19], [7.8, -22.5], [0.6, -25.5]];
    ring.forEach(([x, z], i) => stand(cam, out, t, folk(i), x, 0, z,
      { expr: (["smile", "grin", "laugh", "relief_open"] as Expr[])[i % 4], wave: i % 2 ? q(Math.sin(t * 2.6 + i * 1.1), 30) : undefined }));
    for (let i = 0; i < 2; i++) {
      const kid: Who = { i: 150 + i, o: KID, okey: "kid" };
      out.places.push(person(cam, kid, -2.6 + i * 5.4, Math.abs(Math.sin(t * 4.6 + i * 2)) * 0.16, -14.5 - i, { side: false, mirror: false },
        { mode: "stand", expr: "laugh", blink: lidAt(t, 60 + i) }, {}, 0.72));
    }
    stand(cam, out, t, MO, 0.4, 0, -17.5, { expr: "relief_open", wave: q(Math.sin(t * 1.8), 30) }, 1.12);
  }

  return out;
};
export { FPS };
