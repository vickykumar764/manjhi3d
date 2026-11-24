// The Nuranang outpost as one three.js scene, built on the Manjhi valley's world architecture:
// same sky shader, camera-relative sun rig, two-tone uniforms, clouds, foreground framing objects and
// the pool-driven cast loop. What changed: the ridge is a snowy mountain (grey rock, snow far ridge),
// three bunkers sit on its slope, the Monpa village lies below, and the Jaswant Garh memorial stands at
// the road's foot (visible from shot 7, when the story reaches it).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, boxGeo, quad, V, lam, house, prop, kitClone, Kit } from "./build";
import { ctex, grassHD, stoneHD, bed, beam, cloudHD, rng } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, ridgeY, BUNKERS, MEMORIAL, POST_FLAG, lightAt, FOREGROUND, ShotDef } from "./story";

// ---------------- assets (same Kenney kit as the template) ----------------
const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
  "plant_bush", "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "grass", "lily_large", "lantern", "cart", "stall-red",
  "stall-green", "stall-bench", "banner-red", "banner-green", "windmill", "canoe"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
const rockTex = () => ctex("m2rockface", 1024, 1024, (g, r) => {
  g.fillStyle = "#8f949b"; g.fillRect(0, 0, 1024, 1024);
  const tones = ["#82878e", "#767b83", "#9aa0a8", "#6a6f78", "#a8adb5", "#7e838a"];
  for (let i = 0; i < 2600; i++) {
    const x = r() * 1024, y = r() * 1024, rad = 6 + r() * 42;
    g.fillStyle = tones[Math.floor(r() * tones.length)];
    g.globalAlpha = 0.16 + r() * 0.3;
    g.beginPath();
    const n = 5 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, rr = rad * (0.6 + r() * 0.6);
      if (k) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  }
  g.globalAlpha = 0.35; g.strokeStyle = "#5d6167"; g.lineWidth = 2;
  for (let i = 0; i < 130; i++) { // cracks
    let x = r() * 1024, y = r() * 1024;
    g.beginPath(); g.moveTo(x, y);
    const segs = 3 + Math.floor(r() * 4);
    for (let k = 0; k < segs; k++) { x += (r() - 0.5) * 90; y += r() * 60; g.lineTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
});
const plaqueTex = () => ctex("memPlaque", 256, 128, (g) => {
  g.fillStyle = "#e8e4d8"; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "#8a7a5c"; g.lineWidth = 6; g.strokeRect(8, 8, 240, 112);
  g.fillStyle = "#c0353a"; g.beginPath(); g.arc(128, 46, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#3a3d47"; g.fillRect(48, 78, 160, 8); g.fillRect(68, 94, 120, 8);
});
/** per-shot sun override (front-light the aerial, like the template's town wide) */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = { 2: { az: 120 } };

/** horizontal quad facing up at height y covering x0..x1, z0..z1, uv tiled u x v */
function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, y = 0) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}

// ---------------- the ridge: a sampled profile extruded along x, the notch cut per frame ----------------
const RX0 = -320, RX1 = 320, RZ0 = -98, RZ1 = -22, RSTEP_X = 4, RSTEP_Z = 1.5;
const ridgePoint = (x: number, z: number, zOff: number, hScale: number, gap: number) => {
  const prof = ridgeY(z - zOff) * hScale;
  if (prof <= 0) return 0;
  let m = 0;
  if (gap > 0) {
    const d = Math.abs(x) - gap;
    m = d <= 0 ? 1 : d >= 7 ? 0 : 1 - (d / 7) * (d / 7) * (3 - 2 * (d / 7));
  }
  const jag = (Math.sin(x * 12.9898 + (z - zOff) * 78.233) * 43758.5453) % 1;
  const rough = (jag - Math.floor(jag) - 0.5) * 2.4 * Math.min(1, prof / 14) * (1 - m);
  return Math.max(0.12, prof * (1 - m) + 0.15 * m + rough * (prof > 0.5 ? 1 : 0));
};
const buildRidgeGeo = (zOff: number, hScale: number, gap: number, stepX: number, stepZ: number) => {
  const xs: number[] = [], zs: number[] = [];
  for (let x = RX0; x <= RX1; x += stepX) xs.push(x);
  for (let z = RZ0 + zOff; z <= RZ1 + zOff; z += stepZ) zs.push(z);
  const pos: number[] = [], uv: number[] = [];
  const P = (ix: number, iz: number) => {
    const x = xs[ix], z = zs[iz];
    pos.push(x, ridgePoint(x, z, zOff, hScale, gap), z);
    uv.push(x / 24, (z - zOff) / 24);
  };
  for (let ix = 0; ix < xs.length - 1; ix++) for (let iz = 0; iz < zs.length - 1; iz++) {
    P(ix, iz); P(ix, iz + 1); P(ix + 1, iz + 1); P(ix, iz); P(ix + 1, iz + 1); P(ix + 1, iz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
};

type Mats = Record<string, THREE.Material>;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<string, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private ridge: THREE.Mesh;
  private memorial: THREE.Group;
  private postFlag: THREE.Object3D;
  private memFlag: THREE.Object3D;
  private rifleLean: THREE.Object3D;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    // ---- sky + light (template rig) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- materials ----
    M.grass = lam("jwGrass", () => ({ map: grassHD() }));
    M.road = lam("jwRoad", () => ({ map: bed() }));
    M.dirt = lam("jwDirt", () => ({ map: bed(), color: "#d8c2a0" }));
    M.rock = lam("jwRock", () => ({ map: rockTex() }));
    M.boulder = lam("jwBoulder", () => ({ color: "#6e6a66" }));
    M.wood = lam("jwWood", () => ({ map: beam() }));
    M.stone = lam("jwStone", () => ({ color: "#9a9a92" }));
    M.snow = lam("jwSnow", () => ({ color: "#f4f6f8" }));
    M.memorial = lam("jwMem", () => ({ color: "#b8b0a0" }));
    M.blanket = lam("jwBlanket", () => ({ color: "#357650" }));
    M.bootDark = lam("jwBoot", () => ({ color: "#2a2622" }));

    // ---- static valley (one merged batch per material) ----
    const b = new Batch();
    b.add(quadUp(-650, 650, -720, 520, 300, 300), M.grass);
    b.add(quadUp(-52, 52, 4, 98, 26, 24, 0.012), M.dirt);            // village earth
    b.add(quadUp(-2.6, 2.6, -205, 155, 1.3, 90, 0.025), M.road);      // the road / path, through the ridge line
    // village houses (fronts to the road or the village centre)
    const houses: [number, number, number, number, number, number, number][] = [
      [14.5, 26, -Math.PI / 2, 8, 8, 7.5, 0], [17, 33, -Math.PI / 2, 9, 8, 8.4, 3], [15, 46, -Math.PI / 2, 8, 8, 7, 5], [14.5, 63, -Math.PI / 2, 9, 8, 9, 1],
      [-14.5, 31, Math.PI / 2, 8, 8, 8.4, 2], [-15, 49, Math.PI / 2, 9, 8, 7, 4], [-14, 66, Math.PI / 2, 8, 8, 9.8, 6],
      [-9, 82, Math.PI, 8, 8, 7, 0], [14, 81, Math.PI, 9, 8, 8.4, 2], [30, 79, Math.PI, 8, 8, 7, 5], [-26, 80, Math.PI, 9, 8, 7.5, 7],
      [-22, 13, 0, 9, 8, 7.5, 1], [23, 14, 0, 8, 8, 7, 6], [-38, 15, 0, 8, 8, 9, 3], [38, 12, 0, 9, 8, 8.4, 4],
    ];
    for (const [x, z, yaw, w, d, h, si] of houses) house(b, x, z, yaw, w, d, h, si, 0);
    // the three bunkers on the ridge slope (stone boxes half-buried, sandbag rows on top)
    for (const [bx, bz] of BUNKERS) {
      const by = ridgeY(bz);
      b.add(boxGeo(V(bx - 1.8, by - 0.4, bz - 1.4), V(bx + 1.8, by + 1.3, bz + 1.4), 2), M.stone);
      b.add(boxGeo(V(bx - 1.8, by + 1.3, bz - 1.4), V(bx + 1.8, by + 1.55, bz - 0.9), 2), M.boulder);
      b.add(boxGeo(V(bx - 1.8, by + 1.3, bz + 0.9), V(bx + 1.8, by + 1.55, bz + 1.4), 2), M.boulder);
    }
    // ammunition crates by the bunkers (what Sela and Nura ferry between)
    for (const [cx, cz] of [[-10, -46], [2, -56], [10, -66]] as const) {
      const cy = ridgeY(cz);
      b.add(boxGeo(V(cx - 0.35, cy + 0.4, cz - 0.3), V(cx + 0.35, cy + 0.9, cz + 0.3)), M.wood);
    }
    // hills ringing the valley
    const hill = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const hm = [lam("m2hillA", () => ({ color: "#78b257" })), lam("m2hillB", () => ({ color: "#6aa24e" })), lam("m2hillC", () => ({ color: "#8bbf63" }))];
    ([[-420, 190, 220, 55, 140], [380, 260, 260, 66, 150], [-460, -240, 230, 50, 160], [430, -300, 240, 58, 150],
      [-180, 420, 280, 60, 150], [240, 430, 260, 52, 140]] as const).forEach(([x, z, sx, sy, sz], i) =>
      b.add(hill, hm[i % 3], new THREE.Matrix4().compose(V(x, -2, z), new THREE.Quaternion(), V(sx, sy, sz))));
    // scattered boulders at the ridge foot
    const rockG = new THREE.IcosahedronGeometry(1, 0);
    const rr = rng(23);
    for (let i = 0; i < 16; i++) {
      const x = (rr() - 0.5) * 260, z = -18 - rr() * 10, s = 0.5 + rr() * 1.6;
      if (Math.abs(x) < 6) continue;
      b.add(rockG, M.boulder, new THREE.Matrix4().compose(V(x, s * 0.3, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rr() * 3, rr() * 3, rr() * 3)), V(s, s * 0.75, s)));
    }
    b.build(R);
    // village dressing with the Kenney kit (trees become cartoon vegetation inside prop())
    const pb = new Batch(), r = rng(11);
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length) % a.length];
    const trees = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree-high-round", "tree"];
    for (let i = 0; i < 90; i++) {
      const x = (r() - 0.5) * 340, z = -14 + r() * 190;
      if (Math.abs(x) < 8 || (Math.abs(x) < 48 && z > 4 && z < 100)) continue;
      prop(pb, kit, pick(trees), x, 0, z, 7 + r() * 4, r() * 6);
    }
    for (let z = 14; z <= 92; z += 19) for (const sx of [-1, 1]) prop(pb, kit, pick(trees), sx * (6.4 + r() * 1.5), 0, z + r() * 4, 6.5 + r() * 2, r() * 6);
    for (const z of [18, 38, 58, 78]) for (const sx of [-1, 1]) prop(pb, kit, "lantern", sx * 3.6, 0, z, 2.8);
    prop(pb, kit, "stall-red", -6.8, 0, 36.5, 3.2, 0.4);
    prop(pb, kit, "stall-green", 7.2, 0, 41, 3.2, Math.PI - 0.3);
    prop(pb, kit, "cart", -7.6, 0, 48, 2.2, 1.1);
    prop(pb, kit, "stall-bench", 6.4, 0, 33.5, 1.0, -0.5);
    prop(pb, kit, "windmill", -98, 0, 58, 16, -0.6);
    for (let i = 0; i < 22; i++) prop(pb, kit, pick(["plant_bushLarge", "plant_bushDetailed", "plant_bush"]), (r() - 0.5) * 90, 0, 6 + r() * 92, 1.2 + r() * 0.5, r() * 6);
    for (let i = 0; i < 20; i++) prop(pb, kit, pick(["flower_redA", "flower_yellowA", "flower_purpleA"]), (r() - 0.5) * 70, 0, 8 + r() * 84, 0.5, r() * 6);
    pb.build(R);

    // ---- the ridge (static: no notch here) + the snowy far ridge ----
    this.ridge = new THREE.Mesh(buildRidgeGeo(0, 1, 0, RSTEP_X, RSTEP_Z), M.rock);
    this.ridge.castShadow = true; this.ridge.receiveShadow = true; this.ridge.frustumCulled = false;
    R.add(this.ridge);
    const ridge2 = new THREE.Mesh(buildRidgeGeo(-90, 1.45, 0, 8, 3), lam("jwFarSnow", () => ({ map: rockTex(), color: "#e8edf2" })));
    ridge2.receiveShadow = true; ridge2.frustumCulled = false;
    R.add(ridge2);
    // snow caps on the near ridge crest (white quads laid over the top)
    for (const [sx, sz, sw] of [[-40, -60, 26], [30, -60, 22], [90, -62, 30], [-120, -58, 24]] as const) {
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(sw, 10), M.snow);
      cap.rotation.x = -Math.PI / 2; cap.rotation.z = 0.2;
      cap.position.set(sx, ridgeY(-60) + 0.4, sz);
      cap.receiveShadow = true;
      R.add(cap);
    }
    // ---- the post flag above bunker 2 (waving through the whole film) ----
    const postPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), M.wood);
    postPole.position.set(POST_FLAG[0] + 1.2, ridgeY(-58) + 0.4 + 2.1, POST_FLAG[2]);
    postPole.castShadow = true;
    R.add(postPole);
    this.postFlag = kitClone(kit, "banner-red", 1.1) ?? new THREE.Group();
    this.postFlag.position.set(POST_FLAG[0] + 1.2, ridgeY(-58) + 0.4 + 3.6, POST_FLAG[2]);
    R.add(this.postFlag);
    // ---- the Jaswant Garh memorial (shots 7-8 only): stone base + plaque + flag + the bed + the boots ----
    this.memorial = new THREE.Group();
    const mBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 2.2), M.memorial);
    mBase.position.set(0, 0.45, 0); mBase.castShadow = true; mBase.receiveShadow = true;
    const mSlab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 0.5), M.memorial);
    mSlab.position.set(0, 1.6, -0.8); mSlab.castShadow = true;
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: plaqueTex() }));
    plaque.position.set(0, 1.7, -0.53); plaque.rotation.y = Math.PI;
    const mPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 6), M.wood);
    mPole.position.set(2.2, 2.3, -0.6); mPole.castShadow = true;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 0.95), M.wood);
    bed.position.set(-2.6, 0.23, 0.9); bed.castShadow = true;
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.9), M.blanket);
    blanket.position.set(-2.6, 0.5, 0.9);
    this.memorial.add(mBase, mSlab, plaque, mPole, bed, blanket);
    for (const [bx, bz] of [[-1.6, 1.6], [-1.25, 1.6]] as const) {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.5), M.bootDark);
      boot.position.set(bx, 0.15, bz); boot.castShadow = true;
      this.memorial.add(boot);
    }
    this.memFlag = kitClone(kit, "banner-red", 1.3) ?? new THREE.Group();
    this.memFlag.position.set(2.2, 4.1, -0.6);
    this.memorial.add(this.memFlag);
    this.memorial.position.set(...MEMORIAL);
    this.memorial.visible = false;
    R.add(this.memorial);
    // ---- the rifle leaning on bunker 2 (the quiet post, shot 6) ----
    this.rifleLean = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.5, 0.09), M.bootDark);
    this.rifleLean.position.set(1.6, ridgeY(-58) + 0.4 + 0.7, -56.6);
    this.rifleLean.rotation.z = 0.35; this.rifleLean.castShadow = true; this.rifleLean.visible = false;
    R.add(this.rifleLean);
    // the CAM agent's near framing objects
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
  }

  /** camera-relative sun, frozen per shot+light (template rig) */
  private shotSun(id: number, s: ShotDef, L: LightPreset, light: string) {
    const key = `${id}|${light}`;
    let v = this.sunCache.get(key);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(key, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], light = lightAt(id, f), L = LIGHTS[light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig (template) ----
    const K = LOOK[light], sunDir = this.shotSun(id, s, L, light);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.fill.intensity = 0;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[light].bounce); TONE.uSat.value = LOOK[light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc + halo, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[light][i % 4];
    }
    // ---- foreground framing objects ----
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    // ---- the memorial appears when the story reaches it; the flags wave; the rifle waits ----
    this.memorial.visible = id === 7 || id === 8;
    this.postFlag.rotation.z = 0.06 * Math.sin(t * 2.2);
    this.memFlag.rotation.z = 0.06 * Math.sin(t * 2.2 + 1);
    this.rifleLean.visible = id === 6;
    // ---- cast + effects (template loop) ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, f, t, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}
