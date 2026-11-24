// Hivre Bazar as one three.js scene, built on the Manjhi valley's world architecture:
// same sky shader, camera-relative sun rig, two-tone uniforms, clouds, foreground framing objects and
// the pool-driven cast loop. What changed: the village is Hivre Bazar — two wells by the chowk whose
// water rises as the story succeeds, check dams and trenches on the gully at the ridge foot, a rain
// gauge and milk cans, and the fields beyond the houses that go from dry and cracked to green.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, boxGeo, quad, V, lam, house, prop, kitClone, Kit } from "./build";
import { ctex, grassHD, stoneHD, bed, beam, cloudHD, rng } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, clamp01, ridgeY, WELLS, FIELDS, DAMS, TRENCHES, waterAt, lightAt, FOREGROUND, ShotDef } from "./story";

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
  g.fillStyle = "#99855f"; g.fillRect(0, 0, 1024, 1024);
  const tones = ["#86714e", "#77643f", "#ab9873", "#bfae8a", "#6b583d", "#8f7a56"];
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
  g.globalAlpha = 0.35; g.strokeStyle = "#5d4c33"; g.lineWidth = 2;
  for (let i = 0; i < 130; i++) { // cracks
    let x = r() * 1024, y = r() * 1024;
    g.beginPath(); g.moveTo(x, y);
    const segs = 3 + Math.floor(r() * 4);
    for (let k = 0; k < segs; k++) { x += (r() - 0.5) * 90; y += r() * 60; g.lineTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
});
const crackTex = () => ctex("hivreCracks", 512, 512, (g, r) => {
  g.fillStyle = "#c9b088"; g.fillRect(0, 0, 512, 512);
  const tones = ["#b89a6c", "#d6c096", "#a8875e"];
  for (let i = 0; i < 500; i++) {
    g.fillStyle = tones[Math.floor(r() * tones.length)];
    g.globalAlpha = 0.2 + r() * 0.3;
    g.fillRect(r() * 512, r() * 512, 8 + r() * 40, 6 + r() * 20);
  }
  g.globalAlpha = 0.6; g.strokeStyle = "#8a6f4c"; g.lineWidth = 2;
  for (let i = 0; i < 60; i++) { // cracks
    let x = r() * 512, y = r() * 512;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
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
  private dryFields: THREE.Mesh;
  private greenFields: THREE.Mesh;
  private waterDiscs: THREE.Mesh[] = [];
  private dams: THREE.Group;
  private trenches: THREE.Group;
  private gauge: THREE.Group;
  private cans: THREE.Group;
  private cart: THREE.Object3D;
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
    M.grass = lam("hvGrass", () => ({ map: grassHD() }));
    M.road = lam("hvRoad", () => ({ map: bed() }));
    M.dirt = lam("hvDirt", () => ({ map: bed(), color: "#d8c2a0" }));
    M.rock = lam("hvRock", () => ({ map: rockTex() }));
    M.boulder = lam("hvBoulder", () => ({ color: "#7d6c54" }));
    M.wood = lam("hvWood", () => ({ map: beam() }));
    M.dry = lam("hvDry", () => ({ map: crackTex() }));
    M.green = lam("hvGreen", () => ({ map: grassHD(), color: "#9fd06a" }));
    M.stone = lam("hvStone", () => ({ color: "#9a9a92" }));
    M.water = lam("hvWater", () => ({ color: "#4f8ba8" }));
    M.wellDark = lam("hvWellDark", () => ({ color: "#2e2a24" }));
    M.milk = lam("hvMilk", () => ({ color: "#e8e6dd" }));

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
    // the two wells by the chowk: square stone rims with a dark shaft (the water disc is added below)
    for (const [wx, wz] of WELLS) {
      b.add(boxGeo(V(wx - 1.2, 0, wz - 1.2), V(wx + 1.2, 0.9, wz - 0.9)), M.stone);
      b.add(boxGeo(V(wx - 1.2, 0, wz + 0.9), V(wx + 1.2, 0.9, wz + 1.2)), M.stone);
      b.add(boxGeo(V(wx - 1.2, 0, wz - 0.9), V(wx - 0.9, 0.9, wz + 0.9)), M.stone);
      b.add(boxGeo(V(wx + 0.9, 0, wz - 0.9), V(wx + 1.2, 0.9, wz + 0.9)), M.stone);
      b.add(boxGeo(V(wx - 0.9, -1.4, wz - 0.9), V(wx + 0.9, -0.1, wz + 0.9)), M.wellDark);
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

    // ---- the ridge (static: it frames the valley, nothing is cut here) + the far ridge ----
    this.ridge = new THREE.Mesh(buildRidgeGeo(0, 1, 0, RSTEP_X, RSTEP_Z), M.rock);
    this.ridge.castShadow = true; this.ridge.receiveShadow = true; this.ridge.frustumCulled = false;
    R.add(this.ridge);
    const ridge2 = new THREE.Mesh(buildRidgeGeo(-90, 1.45, 0, 8, 3), lam("hvFarhill", () => ({ map: rockTex(), color: "#c3d0dc" })));
    ridge2.receiveShadow = true; ridge2.frustumCulled = false;
    R.add(ridge2);
    // ---- the fields beyond the houses: dry and cracked first, green once the water returns ----
    this.dryFields = new THREE.Mesh(quadUp(FIELDS.x0, FIELDS.x1, FIELDS.z0, FIELDS.z1, 8, 6, 0.03), M.dry);
    this.dryFields.receiveShadow = true;
    R.add(this.dryFields);
    this.greenFields = new THREE.Mesh(quadUp(FIELDS.x0, FIELDS.x1, FIELDS.z0, FIELDS.z1, 8, 6, 0.03), M.green);
    this.greenFields.receiveShadow = true;
    this.greenFields.visible = false;
    R.add(this.greenFields);
    // ---- the water in each well (its height follows waterAt(frame)) ----
    for (const [wx, wz] of WELLS) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 16), M.water);
      disc.position.set(wx, -1.2, wz);
      R.add(disc);
      this.waterDiscs.push(disc);
    }
    // ---- the check dams across the gully and the trenches on the slope (built from shot 5) ----
    this.dams = new THREE.Group();
    for (const [dx, dz] of DAMS) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 0.8), M.stone);
      wall.position.set(dx, 0.55, dz); wall.castShadow = true; wall.receiveShadow = true;
      this.dams.add(wall);
    }
    this.dams.visible = false;
    R.add(this.dams);
    this.trenches = new THREE.Group();
    for (const [tx, tz] of TRENCHES) {
      const tr = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 0.7), M.boulder);
      tr.position.set(tx, 0.12, tz); tr.receiveShadow = true;
      this.trenches.add(tr);
    }
    this.trenches.visible = false;
    R.add(this.trenches);
    // ---- the rain gauge by the chowk (shot 4+) and the milk cans by the house (shot 6+) ----
    this.gauge = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), M.wood);
    pole.position.set(0, 0.8, 0); pole.castShadow = true;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.5, 10), M.milk);
    cup.position.set(0, 1.7, 0);
    this.gauge.add(pole, cup);
    this.gauge.position.set(2, 0, 30);
    this.gauge.visible = false;
    R.add(this.gauge);
    this.cans = new THREE.Group();
    for (const [cx, cz] of [[-14.5, 31], [-13.8, 31.6]] as const) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 10), M.milk);
      can.position.set(cx, 0.35, cz); can.castShadow = true;
      this.cans.add(can);
    }
    this.cans.visible = false;
    R.add(this.cans);
    // ---- the family's cart: rolls out with the leaving families (shot 2), rolls in with them (shot 7) ----
    this.cart = kitClone(kit, "cart", 2.1) ?? new THREE.Group();
    this.cart.visible = false;
    R.add(this.cart);
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
    // ---- the dry-to-green arc: fields, well water, dams, trenches, gauge, cans, cart ----
    this.dryFields.visible = id <= 3;
    this.greenFields.visible = id >= 6;
    const wl = waterAt(f);
    this.waterDiscs.forEach((d) => { d.position.y = wl; });
    this.dams.visible = id >= 5;
    this.trenches.visible = id >= 5;
    this.gauge.visible = id >= 4;
    this.cans.visible = id >= 6;
    if (id === 2) {
      const p = clamp01((f - 274) / 335);
      this.cart.visible = true;
      this.cart.position.set(-1.1, 0, 40 + p * 110);
      this.cart.rotation.y = 0;
    } else if (id === 7) {
      const p = clamp01((f - 1720) / 270);
      this.cart.visible = true;
      this.cart.position.set(-1.1, 0, 150 - p * 110);
      this.cart.rotation.y = Math.PI;
    } else this.cart.visible = false;
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
