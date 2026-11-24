// The cast as lit flat sprites in the 3D world — the bridge template's pool / actor / person machinery,
// with the staging rewritten for the Hivre Bazar story: Popatrao Pawar (the white-haired sarpanch) and
// the villagers of Hivre Bazar, from the dry fields and the leaving families to the water meetings, the
// dam building and the golden return.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, KID, INK, fxBurst, fxPuff, fxStars, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS, SHOTS, V3, clamp01, smooth, lightAt, ridgeY, WELLS, DAMS } from "./story";
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

// ---------------- the Hivre cast ----------------
export const POPATRAO: Outfit = {
  jacket: "#e8e0d0", pants: "#6a5a48", boots: INK, hat: "hair", hair: "#e8e8e2", moustache: "#e8e8e2", skin: "#d8a97e",
};
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const folk = (i: number): Who => ({ i: 100 + i, o: FOLK[i % 6], okey: `f${i % 6}` });
const WOMEN = [townsfolk(1), townsfolk(4), townsfolk(2)];

// ---------------- staging per shot ----------------
const stand = (cam: CamInfo, out: Stage, t: number, who: Who, x: number, y: number, z: number, fo: FrontOpts, sc = 1) => {
  out.places.push(person(cam, who, x, y, z, { side: false, mirror: false }, { mode: "stand", blink: lidAt(t, who.i), ...fo }, {}, sc));
  blob(out, x, y, z, sc);
};
/** a villager walking with the march cycle (the leaving / returning families) */
const walker = (cam: CamInfo, out: Stage, t: number, who: Who, x: number, z: number, dz: 1 | -1) => {
  const view = viewOf(cam, x, z, 0, dz);
  out.places.push(person(cam, who, x, 0, z, view, { mode: "stand", expr: "neutral" },
    { mode: "march", phase: q((t * 1.2 + who.i * 0.31) % 1, 60), expr: "neutral", blink: lidAt(t, who.i), stride: view.fs }));
  blob(out, x, 0, z);
};

export const stage = (id: number, f: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], lt = t - s.a / FPS, u = clamp01((f - s.a) / (s.b - s.a));
  LNAME = lightAt(id, f);
  findSun(cam, SUN);
  const P: Who = { i: 1, o: POPATRAO, okey: "popatrao" };

  if (s.scene === "hook") {
    // a farmer alone in the cracked field, looking at the dry earth; two neighbours behind
    stand(cam, out, t, folk(0), 0, 0, 122, { expr: "neutral", headTilt: 0.06 }, 1.1);
    stand(cam, out, t, folk(1), -6, 0, 128, { expr: "nervous" });
    stand(cam, out, t, folk(3), 6.5, 0, 130, { expr: "nervous" });
  }

  if (s.scene === "aerial") {
    // the dry village from above: families leaving down the road with the cart
    stand(cam, out, t, P, 0, 0, 34, { expr: "neutral" }, 1.05);
    for (let i = 0; i < 6; i++) {
      const z = 60 + lt * 2.0 + i * 8;
      if (z > 150) continue;
      walker(cam, out, t, folk(i), -2 + (i % 3) * 2.5, z, 1);
    }
  }

  if (s.scene === "meeting") {
    // the gram sabha: Popatrao standing, the village seated in a circle around him
    stand(cam, out, t, P, 0, 0, 32, { expr: "stern" }, 1.08);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * 4.5, z = 32 + Math.sin(a) * 3.5;
      out.places.push(person(cam, folk(i), x, 0, z, { side: false, mirror: false },
        { mode: "sit", expr: i % 3 === 0 ? "nervous" : "neutral", blink: lidAt(t, 100 + i) }, {}, 1));
      blob(out, x, 0, z);
    }
  }

  if (s.scene === "chowk") {
    // the circle agreeing the rules: the rain gauge at their side, the milk cans, the wells
    stand(cam, out, t, P, 0, 0, 38, { expr: "stern" }, 1.06);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const x = Math.cos(a) * 3.6, z = 40 + Math.sin(a) * 2.8;
      stand(cam, out, t, folk(i + 2), x, 0, z, { expr: i === 1 ? "smile" : "neutral" });
    }
    stand(cam, out, t, { i: 5, o: WOMEN[0], okey: "w1" }, -5.5, 0, 44, { expr: "smile" });
  }

  if (s.scene === "dams") {
    // the whole village at work on the slope: stones, trenches, check dams
    for (let i = 0; i < 3; i++) {
      const [dx, dz] = DAMS[i];
      stand(cam, out, t, folk(i), dx + 1.5, ridgeY(dz) + 0.3, dz, { expr: "neutral", headTilt: 0.08 });
      stand(cam, out, t, folk(i + 3), dx - 1.5, ridgeY(dz) + 0.3, dz, { expr: "neutral", headTilt: 0.08 });
    }
    stand(cam, out, t, P, -24, ridgeY(-8) + 0.3, -8, { expr: "stern" }, 1.05);
    const kid = KID(1, 0, { jacket: "#c0353a", shorts: "#3d4440", hat: "hair", hair: "#3a2c1e" });
    stand(cam, out, t, { i: 9, o: kid, okey: "kid1" }, -20, ridgeY(-6) + 0.3, -6, { expr: "smile" }, 0.72);
  }

  if (s.scene === "well") {
    // the first water: a woman drawing at the refilled well, neighbours gathering, green fields behind
    stand(cam, out, t, { i: 5, o: WOMEN[0], okey: "w1" }, -6.5, 0, 40, { expr: "smile" });
    stand(cam, out, t, folk(2), -10.5, 0, 43, { expr: "smile" });
    stand(cam, out, t, folk(4), -4.5, 0, 44, { expr: "relief_open" });
    stand(cam, out, t, P, -12, 0, 38, { expr: "smile" });
  }

  if (s.scene === "return") {
    // the families come back: walking in along the road, the cart rolling in, villagers waving
    for (let i = 0; i < 6; i++) {
      const z = 150 - lt * 2.0 - i * 8;
      if (z < 40) continue;
      walker(cam, out, t, folk(i), -2 + (i % 3) * 2.5, z, -1);
    }
    stand(cam, out, t, P, 0, 0, 40, { expr: "smile", wave: q(Math.sin(t * 1.8), 30) });
    stand(cam, out, t, { i: 6, o: WOMEN[1], okey: "w2" }, 5, 0, 42, { expr: "smile", wave: q(Math.sin(t * 1.8 + 1), 30) });
    stand(cam, out, t, folk(0), -5, 0, 44, { expr: "smile" });
  }

  if (s.scene === "finale") {
    // golden hour at the chowk: the whole village together, Popatrao at the centre
    stand(cam, out, t, P, 0, 0, 34, { expr: "smile" }, 1.08);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * 5, z = 36 + Math.sin(a) * 3.5;
      stand(cam, out, t, folk(i), x, 0, z, { expr: i % 2 === 0 ? "smile" : "relief_open", wave: i % 3 === 0 ? q(Math.sin(t * 1.8 + i), 30) : 0 });
    }
    const kid1 = KID(1, 0, { jacket: "#c0353a", shorts: "#3d4440", hat: "hair", hair: "#3a2c1e" });
    const kid2 = KID(1, 0, { jacket: "#d9a441", shorts: "#3d4440", hat: "hair", hair: "#3a2c1e" });
    stand(cam, out, t, { i: 9, o: kid1, okey: "kid1" }, -2, 0, 30, { expr: "smile", hop: q(Math.sin(t * 2.4), 30) }, 0.72);
    stand(cam, out, t, { i: 10, o: kid2, okey: "kid2" }, 2.5, 0, 30, { expr: "smile", hop: q(Math.sin(t * 2.4 + 1), 30) }, 0.72);
  }

  return out;
};
export { FPS };
