// The cast as lit flat sprites in the 3D world — the bridge template's pool / actor / person machinery,
// with the staging rewritten for the Payeng story: Jadav Payeng (young in 1979 + old in the present),
// the villagers who laughed at him, and the children of the finale. The template has no animal, so the
// dead snakes of 1979 and the birds of the living forest are small Pen drawings in the same ink style;
// the deer/elephants/tiger are only implied (rustling bushes, birds, puffs) — see the report.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, KID, fxBurst, fxPuff, fxStars, fxShadow, fxContact, fxRing,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS, SHOTS, V3, clamp01, smooth, lightAt, canoeAt } from "./story";
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

// ---------------- the Payeng cast ----------------
export const PAYENG: Outfit = { jacket: "#d9a441", pants: "#5a4a3a", boots: "#4a3426", hat: "hair", hair: "#1c1410", skin: "#c99067" };
export const PAYENG_OLD: Outfit = { jacket: "#b98a3a", pants: "#5a4a3a", boots: "#4a3426", hat: "hair", hair: "#d8d8d2", moustache: "#d8d8d2", skin: "#c99067" };
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const folk = (i: number): Who => ({ i: 100 + i, o: FOLK[i % 6], okey: `f${i % 6}` });

/** a dead snake lying on the sand (1979): a limp S-curve with a small head, in the cast's ink style */
const snakeDraw = (seed: number) => (p: Pen) => {
  const ink = "#2a1c12", body = "#8a7a5c", belly = "#c9b896";
  const w = 60 + (seed % 3) * 14;
  p.stroke([[120, 620], [220, 560], [320, 640], [420, 580], [520, 640]], 26, body);
  p.stroke([[120, 620], [220, 560], [320, 640], [420, 580], [520, 640]], 12, belly);
  p.ell(540, 636, 34, 20, body, 6);
  p.dot(556, 630, 4, ink);
  p.stroke([[574, 640], [592, 634]], 4, "#b0402f"); // tongue
};
/** a bird in flight: two curved wings, drawn for a sky card */
const birdDraw = (flap: number) => (p: Pen) => {
  const ink = "#2a1c12";
  const a = -0.5 + flap * 0.9;
  p.arc(300, 300, 90, 70, 200 + a * 40, 340, 10, ink);
  p.arc(300, 300, 90, 70, 20 - a * 40, 160, 10, ink);
  p.dot(300, 300, 8, ink);
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
  const P: Who = { i: 1, o: PAYENG, okey: "payeng" };
  const PO: Who = { i: 2, o: PAYENG_OLD, okey: "payengOld" };

  if (s.scene === "hook") {
    // old Payeng, a sapling in his hands, the forest he grew soft behind him
    out.places.push(person(cam, PO, 0.3, 0, -60, { side: false, mirror: false },
      { mode: "stand", expr: "smile", blink: lidAt(t, 2), headTilt: 0.03 }, {}, 1.12));
    blob(out, 0.3, 0, -60, 1.12);
  }

  if (s.scene === "aerial") {
    // 1979: the barren sandbar, the lone boy, the snakes that died in the heat
    out.places.push(person(cam, P, 0, 0, -58, { side: false, mirror: false },
      { mode: "stand", expr: "nervous", blink: lidAt(t, 1) }, {}, 1.0));
    blob(out, 0, 0, -58, 1.0);
    const snakes: [number, number, number][] = [[-8, -52, 0.4], [6, -64, 1.2], [-14, -66, 2.1], [12, -54, 0.9], [-3, -70, 1.7]];
    snakes.forEach(([x, z, rot], i) => {
      out.fx.push({ key: `snake${i}`, cw: 700, ch: 700, draw: snakeDraw(i), x, y: 0.16, z, w: 1.6, h: 1.6, flat: true, rot });
    });
  }

  if (s.scene === "decide") {
    // the boy's tearful face; his expression sets as he decides
    const expr: Expr = u < 0.55 ? "nervous" : "stern";
    out.places.push(person(cam, P, 0.3, 0, -59.5, { side: false, mirror: false },
      { mode: "stand", expr, blink: lidAt(t, 1), headTilt: u < 0.55 ? 0.06 : 0 }, {}, 1.1));
    blob(out, 0.3, 0, -59.5, 1.1);
    out.fx.push({ key: "snake0", cw: 700, ch: 700, draw: snakeDraw(0), x: -6, y: 0.16, z: -54, w: 1.6, h: 1.6, flat: true, rot: 0.4 });
    out.fx.push({ key: "snake1", cw: 700, ch: 700, draw: snakeDraw(1), x: 7, y: 0.16, z: -65, w: 1.6, h: 1.6, flat: true, rot: 1.2 });
  }

  if (s.scene === "plant") {
    if (f < 1050) {
      // crossing the river by canoe to the sandbar
      const [cx, , cz] = canoeAt(f);
      out.places.push(person(cam, P, cx, 0.35, cz, { side: false, mirror: false },
        { mode: "stand", expr: "neutral", blink: lidAt(t, 1) }, {}, 1.0));
      blob(out, cx, 0.35, cz, 1.0);
    } else {
      // watering the saplings: rings spreading on the soil where he pours
      out.places.push(person(cam, P, 0.2, 0, -60, { side: false, mirror: false },
        { mode: "stand", expr: "smile", blink: lidAt(t, 1), headTilt: 0.12 }, {}, 1.0));
      blob(out, 0.2, 0, -60, 1.0);
      const uu = ((t * 0.7) % 1);
      out.fx.push({ key: `ring${q(uu, 30)}`, cw: 600, ch: 600, draw: (p) => fxRing(p, q(uu, 30)), x: 1.4, y: 0.17, z: -60.5, w: 1.4, h: 1.4, flat: true });
      out.fx.push({ key: `puff${q(uu, 24)}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, q(uu, 24)), x: 0.2, y: 0.5, z: -60, w: 0.8, h: 0.8, soft: true });
    }
  }

  if (s.scene === "years") {
    // season after season, planting on: Payeng walks his line as the forest grows around him
    const px = -22 + u * 44;
    const view = viewOf(cam, px, -58, 1, 0);
    out.places.push(person(cam, P, px, 0, -58, view, { mode: "stand", expr: "neutral" },
      { mode: "march", phase: q((t * 1.25) % 1, 60), expr: "neutral", blink: lidAt(t, 1), stride: view.fs }));
    blob(out, px, 0, -58);
    stand(cam, out, t, folk(2), -14, 0, -66, { expr: "neutral" });
    stand(cam, out, t, folk(4), 16, 0, -52, { expr: "smile" });
  }

  if (s.scene === "forest") {
    // the forest alive: Payeng walks through it, birds cross the sky, bushes rustle
    // (the deer, rabbits, elephants and tiger are implied by the rustling bushes and the birds —
    // the Kenney kit has no animal models; see the report)
    const px = -10 + u * 16;
    const view = viewOf(cam, px, -58, 1, 0);
    out.places.push(person(cam, PO, px, 0, -58, view, { mode: "stand", expr: "smile" },
      { mode: "march", phase: q((t * 1.1) % 1, 60), expr: "smile", blink: lidAt(t, 2), stride: view.fs }));
    blob(out, px, 0, -58);
    for (let i = 0; i < 3; i++) {
      const bx = -34 + (((t * 7 + i * 23) % 70) + 70) % 70;
      const flap = 0.5 + 0.5 * Math.sin(t * 6 + i * 2);
      out.fx.push({ key: `bird${i}|${q(flap, 12)}`, cw: 600, ch: 600, draw: birdDraw(q(flap, 12)), x: bx, y: 14 + i * 2.5, z: -70, w: 1.6, h: 1.6 });
    }
    for (const [bx, bz] of [[-12, -52], [8, -68]] as const) {
      const uu = q(((t * 0.9 + bx) % 1 + 1) % 1, 24);
      out.fx.push({ key: `puff${uu}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, uu), x: bx, y: 0.6, z: bz, w: 1.3, h: 1.3, soft: true });
    }
  }

  if (s.scene === "vast") {
    // the whole forest from the air: a few tiny figures at its edge, birds above it
    stand(cam, out, t, PO, 2, 0, -48, { expr: "smile" });
    stand(cam, out, t, folk(1), -6, 0, -44, { expr: "neutral" });
    stand(cam, out, t, folk(3), 9, 0, -46, { expr: "smile" });
    for (let i = 0; i < 2; i++) {
      const bx = -30 + (((t * 6 + i * 31) % 60) + 60) % 60;
      const flap = 0.5 + 0.5 * Math.sin(t * 5 + i * 3);
      out.fx.push({ key: `bird${i}|${q(flap, 12)}`, cw: 600, ch: 600, draw: birdDraw(q(flap, 12)), x: bx, y: 16 + i * 3, z: -75, w: 2.0, h: 2.0 });
    }
  }

  if (s.scene === "finale") {
    // golden hour at the forest edge: Payeng planting, children and villagers behind him
    out.places.push(person(cam, PO, 0.4, 0, -58, { side: false, mirror: false },
      { mode: "stand", expr: "relief_open", blink: lidAt(t, 2), headTilt: 0.1 }, {}, 1.12));
    blob(out, 0.4, 0, -58, 1.12);
    const ring: [number, number][] = [[-7, -50], [-4, -55], [5, -52], [8, -56], [-9, -57], [6, -60]];
    ring.forEach(([x, z], i) => stand(cam, out, t, folk(i), x, 0, z,
      { expr: (["smile", "grin", "laugh"] as Expr[])[i % 3], wave: i % 2 ? q(Math.sin(t * 2.4 + i), 30) : undefined }));
    for (let i = 0; i < 2; i++) {
      const kid: Who = { i: 150 + i, o: KID, okey: "kid" };
      out.places.push(person(cam, kid, -2.5 + i * 5, Math.abs(Math.sin(t * 4.4 + i * 2)) * 0.15, -53 - i, { side: false, mirror: false },
        { mode: "stand", expr: "laugh", blink: lidAt(t, 60 + i) }, {}, 0.72));
    }
  }

  return out;
};
export { FPS };
