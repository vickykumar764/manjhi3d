// Simple lit billboard actors built on the template's toon.ts drawings + cardshade.ts shading.
import * as THREE from "three";
import { Pen, bodyFront, Outfit, FrontOpts, fxPuff, fxBurst, fxStars } from "./toon";
import { cardShade } from "./cardshade";
import { NOINK } from "./ink";

export const SU = 0.00216;
const cache = new Map<string, THREE.CanvasTexture>();
function tex(key: string, w: number, h: number, draw: (p: Pen) => void): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > 90) { const k = cache.keys().next().value as string; cache.get(k)?.dispose(); cache.delete(k); }
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const g = cv.getContext("2d")!; g.clearRect(0, 0, w, h);
  draw(new Pen(g));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  cache.set(key, t); return t;
}
export function charTex(outfit: Outfit, opts: FrontOpts): THREE.CanvasTexture {
  const key = "c|" + JSON.stringify(outfit) + "|" + JSON.stringify(opts);
  return tex(key, 600, 1000, (p) => bodyFront(p, outfit, opts));
}
export function fxTex(kind: "puff" | "burst" | "stars", step: number): THREE.CanvasTexture {
  const key = `fx|${kind}|${step}`;
  return tex(key, 600, 600, (p) => {
    p.g.translate(300, 300);
    if (kind === "puff") fxPuff(p, step / 8);
    else if (kind === "burst") fxBurst(p, step / 8);
    else fxStars(p, step / 8);
  });
}
export function charMat(outfit: Outfit, opts: FrontOpts): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ map: charTex(outfit, opts), alphaTest: 0.5 });
  cardShade(m); return m;
}
export function fxMat(kind: "puff" | "burst" | "stars", step: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ map: fxTex(kind, step), transparent: true, depthWrite: false, fog: false });
}
export const BODY_W = 600 * SU, BODY_H = 1000 * SU, BODY_DY = (975 - 500) * SU;
export { NOINK };
