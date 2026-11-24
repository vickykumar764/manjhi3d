// The cast as lit flat sprites in the 3D world — the bridge template's pool / actor / person machinery,
// with the staging rewritten for the Jaswant story: Rifleman Jaswant Singh Rawat (the template's green
// rifleman), Sela and Nura (Monpa girls, townsfolk dresses), the company filing away, and the distant
// enemy column in grey. Muzzle flashes are the template's fxBurst.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, KID, RIFLEMAN, soldier, fxBurst, fxPuff, fxStars, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS, SHOTS, V3, clamp01, smooth, lightAt, ridgeY, BUNKERS, enemyZ, runAt, fireK } from "./story";
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

// ---------------- the Jaswant cast ----------------
export const JASWANT: Outfit = RIFLEMAN;
const SELA: Outfit = townsfolk(1); // bonnet + dress
const NURA: Outfit = townsfolk(4);
const ENEMY: Outfit = soldier(1, { jacket: "#5a5f66", pants: "#4a4d52", hat: "shako", belt: null, rifle: true });
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const folk = (i: number): Who => ({ i: 100 + i, o: FOLK[i % 6], okey: `f${i % 6}` });

// ---------------- staging per shot ----------------
const stand = (cam: CamInfo, out: Stage, t: number, who: Who, x: number, y: number, z: number, fo: FrontOpts, sc = 1) => {
  out.places.push(person(cam, who, x, y, z, { side: false, mirror: false }, { mode: "stand", blink: lidAt(t, who.i), ...fo }, {}, sc));
  blob(out, x, y, z, sc);
};
/** a rifleman standing at a bunker, rifle raised, firing on the fire cycle */
const firing = (cam: CamInfo, out: Stage, t: number, who: Who, x: number, y: number, z: number) => {
  const k = fireK(t);
  out.places.push(person(cam, who, x, y, z, { side: false, mirror: false },
    { mode: "stand", expr: "stern", blink: lidAt(t, who.i) }, {}, 1.05)); // the rifle comes from the RIFLEMAN outfit, not a prop
  blob(out, x, y, z, 1.05);
  if (k > 0.7) {
    const uu = q((1 - k) / 0.3, 24);
    out.fx.push({ key: `burst${uu}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, uu), x: x + 0.4, y: y + 1.45, z: z - 0.4, w: 0.9, h: 0.9 });
  }
};

export const stage = (id: number, f: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], lt = t - s.a / FPS, u = clamp01((f - s.a) / (s.b - s.a));
  LNAME = lightAt(id, f);
  findSun(cam, SUN);
  const J: Who = { i: 1, o: JASWANT, okey: "jaswant" };
  const SE: Who = { i: 3, o: SELA, okey: "sela" };
  const NU: Who = { i: 4, o: NURA, okey: "nura" };

  if (s.scene === "hook") {
    // the lone rifleman at bunker 2, the ridge and the post behind him
    out.places.push(person(cam, J, 0, ridgeY(-58) + 0.4, -58, { side: false, mirror: false },
      { mode: "stand", expr: "stern", blink: lidAt(t, 1), headTilt: 0.02 }, {}, 1.1));
    blob(out, 0, ridgeY(-58) + 0.4, -58, 1.1);
  }

  if (s.scene === "aerial") {
    // the post on the ridge; the company files away down the road; the enemy column far below
    stand(cam, out, t, J, 0, ridgeY(-58) + 0.4, -58, { expr: "stern" }, 1.05);
    for (let i = 0; i < 5; i++) {
      const z = 20 - lt * 2.2 - i * 6;
      if (z < -20) continue;
      const view = viewOf(cam, 1.2, z, 0, 1);
      out.places.push(person(cam, folk(i), 1.2, 0, z, view, { mode: "stand", expr: "neutral" },
        { mode: "march", phase: q((t * 1.2 + i * 0.3) % 1, 60), expr: "neutral", blink: lidAt(t, i + 20), stride: view.fs }));
      blob(out, 1.2, 0, z);
    }
    const ez = enemyZ(t);
    for (let i = 0; i < 5; i++) {
      const ex = -8 + i * 4, ezz = ez - (i % 3) * 3;
      out.places.push(person(cam, { i: 200 + i, o: ENEMY, okey: "enemy" }, ex, 0, ezz, { side: false, mirror: false },
        { mode: "stand", expr: "neutral" }, {}, 1.0));
    }
  }

  if (s.scene === "refuse") {
    // Jaswant refuses to fall back; Sela and Nura stay with him; the last of the company leaves
    out.places.push(person(cam, J, 0, ridgeY(-56) + 0.4, -56, { side: false, mirror: false },
      { mode: "stand", expr: "stern", blink: lidAt(t, 1) }, {}, 1.08));
    blob(out, 0, ridgeY(-56) + 0.4, -56, 1.08);
    stand(cam, out, t, SE, -2.2, ridgeY(-54) + 0.4, -54, { expr: "nervous" });
    stand(cam, out, t, NU, 2.4, ridgeY(-54) + 0.4, -54, { expr: "nervous" });
    for (let i = 0; i < 3; i++) {
      const z = -8 - lt * 2.5 - i * 7;
      if (z < -30) continue;
      const view = viewOf(cam, -3, z, 0, 1);
      out.places.push(person(cam, folk(i + 2), -3, 0, z, view, { mode: "stand", expr: "neutral" },
        { mode: "march", phase: q((t * 1.2 + i * 0.4) % 1, 60), expr: "neutral", blink: lidAt(t, i + 30), stride: view.fs }));
      blob(out, -3, 0, z);
    }
  }

  if (s.scene === "run") {
    // bunker to bunker, firing at each: the enemy is made to believe a whole company holds the post
    const [rx, ry, rz] = runAt(f);
    const moving = (u * 3) % 1 > 0.12 && (u * 3) % 1 < 0.88;
    if (moving) {
      const view = viewOf(cam, rx, rz, Math.sign(BUNKERS[0][0] - rx) || 1, 0);
      out.places.push(person(cam, J, rx, ry, rz, view, { mode: "stand", expr: "stern" },
        { mode: "march", phase: q((t * 2.2) % 1, 60), expr: "stern", blink: lidAt(t, 1), stride: view.fs }, 1.05));
      blob(out, rx, ry, rz, 1.05);
    } else {
      firing(cam, out, t, J, rx, ry, rz);
    }
    const ez = enemyZ(t);
    for (let i = 0; i < 4; i++) {
      out.places.push(person(cam, { i: 210 + i, o: ENEMY, okey: "enemy" }, -10 + i * 5, 0, ez - (i % 2) * 4, { side: false, mirror: false },
        { mode: "stand", expr: "neutral" }, {}, 1.0));
    }
  }

  if (s.scene === "ammo") {
    // the girls ferry ammunition between the bunkers while Jaswant fires; day and night cycle past
    firing(cam, out, t, J, 0, ridgeY(-58) + 0.4, -58);
    for (let i = 0; i < 2; i++) {
      const who = i === 0 ? SE : NU;
      const loop = ((t * 0.5 + i * 0.5) % 1);
      const bx = -12 + loop * 24, bz = -48 - loop * 20;
      const by = ridgeY(bz) + 0.4;
      const view = viewOf(cam, bx, bz, 1, -1);
      out.places.push(person(cam, who, bx, by, bz, view, { mode: "stand", expr: "neutral" },
        { mode: "march", phase: q((t * 1.3 + i * 0.5) % 1, 60), expr: "neutral", blink: lidAt(t, 3 + i), stride: view.fs }));
      blob(out, bx, by, bz);
    }
    stand(cam, out, t, folk(5), 6, ridgeY(-50) + 0.4, -50, { expr: "smile" });
  }

  if (s.scene === "quiet") {
    // the post is empty and still; the flag still waves; two enemy figures approach cautiously
    const ez = enemyZ(t);
    for (let i = 0; i < 2; i++) {
      out.places.push(person(cam, { i: 220 + i, o: ENEMY, okey: "enemy" }, -4 + i * 8, 0, ez + 12 - i * 3, { side: false, mirror: false },
        { mode: "stand", expr: "nervous" }, {}, 1.0));
    }
  }

  if (s.scene === "memorial") {
    // the memorial in golden light: the uniform, the cap and the photograph kept with care; a soldier salutes
    out.places.push(person(cam, J, 2.6, 0, -16.5, { side: false, mirror: false },
      { mode: "stand", expr: "stern", blink: lidAt(t, 1) }, {}, 1.05));
    blob(out, 2.6, 0, -16.5, 1.05);
    stand(cam, out, t, folk(2), -4.5, 0, -14, { expr: "relief_open" });
    stand(cam, out, t, folk(4), -6.5, 0, -21, { expr: "smile" });
  }

  if (s.scene === "finale") {
    // the guard still stands duty: soldiers at the memorial in the setting sun
    for (let i = 0; i < 3; i++) {
      const x = -5 + i * 5;
      out.places.push(person(cam, { i: 50 + i, o: RIFLEMAN, okey: "guard" }, x, 0, -15 - (i % 2) * 2, { side: false, mirror: false },
        { mode: "stand", expr: "stern", blink: lidAt(t, 50 + i) }, {}, 1.05));
      blob(out, x, 0, -15 - (i % 2) * 2, 1.05);
    }
    stand(cam, out, t, SE, 7.5, 0, -20, { expr: "relief_open", wave: q(Math.sin(t * 1.8), 30) });
    stand(cam, out, t, NU, -8.5, 0, -22, { expr: "smile" });
  }

  return out;
};
export { FPS };
