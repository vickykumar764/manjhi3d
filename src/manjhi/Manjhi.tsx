// Dashrath Manjhi ("Mountain Man") — original Hindi animated short in the template's
// flat-characters-in-a-3D-toon-world style: three.js world, ink pass, lens blur, bloom, neutral tone map, grade.
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree, useFrame } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { Pen, townsfolk, Outfit, Expr } from "./toon";
import { InkPass, NOINK, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, gradeFor } from "./grade";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { grassHD, stoneHD, cobbleHD, facadeHD, roofHD, cloudHD } from "./paint";
import { charMat, fxMat, BODY_W, BODY_H, BODY_DY } from "./actors";

export const FPS = 30;
const DURS = [5.022, 8.31, 7.638, 7.158, 6.75, 7.782, 8.118, 10.23];
export const TOTAL = Math.round(DURS.reduce((a, b) => a + b, 0) * FPS); // 1830
const STARTS: number[] = []; { let a = 0; for (const d of DURS) { STARTS.push(a); a += Math.round(d * FPS); } }
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type V3 = [number, number, number];
const lerpV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const MANJHI: Outfit = { jacket: "#c96a26", pants: "#5a4632", boots: "#3a2a1c", hat: "hair", hair: "#241a12", skin: "#c99067", buttons: "#8a5a34" };
const MANJHI_OLD: Outfit = { ...MANJHI, hair: "#d8d4cc", moustache: "#e8e4da" };
const WIFE: Outfit = townsfolk(1);
const shotAt = (f: number) => { let i = 0; while (i + 1 < STARTS.length && f >= STARTS[i + 1]) i++; return i; }; // 0..7

type CamDef = { pos: [V3, V3]; look: [V3, V3]; fov: number; cInf: number; light: "day" | "golden" };
const CAMS: CamDef[] = [
  { pos: [[6.5, 2.3, 10.5], [5.0, 2.0, 8.2]], look: [[0, 2.0, -4], [0, 2.0, -4]], fov: 42, cInf: 13, light: "day" },
  { pos: [[-4, 27, 46], [3, 22, 40]], look: [[0, 3, -14], [0, 3, -14]], fov: 46, cInf: 0, light: "day" },
  { pos: [[3.0, 5.0, 13], [0.5, 4.4, 10.5]], look: [[-7, 4.2, -8], [-7, 4.2, -8]], fov: 42, cInf: 11, light: "day" },
  { pos: [[3.6, 1.9, 7.8], [2.9, 1.75, 6.2]], look: [[0, 1.6, 0], [0, 1.6, 0]], fov: 40, cInf: 14, light: "day" },
  { pos: [[-1.5, 2.1, 11.5], [-0.5, 2.0, 10.2]], look: [[0, 1.6, -2], [0, 1.6, -2]], fov: 42, cInf: 10, light: "day" },
  { pos: [[9.5, 3.4, 15], [7.0, 2.9, 12]], look: [[0, 3.2, -14], [0, 3.2, -14]], fov: 44, cInf: 8, light: "day" },
  { pos: [[0, 3.2, 21], [0, 2.8, 16.5]], look: [[0, 2.6, -20], [0, 2.6, -20]], fov: 44, cInf: 6, light: "day" },
  { pos: [[7.5, 2.5, 13.5], [5.6, 2.1, 10.5]], look: [[0, 2.2, -10], [0, 2.2, -10]], fov: 42, cInf: 12, light: "golden" },
];

// ---------- billboard character ----------
const Char: React.FC<{ pos: V3; s?: number; outfit: Outfit; expr: Expr; mode?: "march" | "stroll" | "stand" | "sit" | "fall"; phase?: number; strike?: number; tilt?: number; wave?: number; seed?: number; flip?: boolean }> =
  ({ pos, s = 1, outfit, expr, mode = "stand", phase = 0, strike, tilt = 0, wave, seed = 1, flip = false }) => {
    const mat = useMemo(() => charMat(outfit, {
      expr, mode, phase, tilt, wave, seed,
      blink: false,
      prop: strike !== undefined ? ["hammer", strike] as ["hammer", number] : null,
    }), [outfit, expr, mode, phase, strike, tilt, wave, seed]);
    const ref = React.useRef<THREE.Mesh>(null!);
    useFrame(({ camera }) => {
      const m = ref.current; if (!m) return;
      m.rotation.y = Math.atan2(camera.position.x - pos[0], camera.position.z - pos[2]) + (flip ? Math.PI : 0);
    });
    return (
      <group position={pos}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.55 * s, 20]} />
          <meshBasicMaterial color="#1a1420" transparent opacity={0.28} depthWrite={false} />
        </mesh>
        <mesh ref={ref} position={[0, BODY_DY * s, 0]} material={mat} onUpdate={(m) => m.layers.set(NOINK)}>
          <planeGeometry args={[BODY_W * s, BODY_H * s]} />
        </mesh>
      </group>
    );
  };

const Fx: React.FC<{ pos: V3; s?: number; kind: "puff" | "burst" | "stars"; step: number }> = ({ pos, s = 1, kind, step }) => {
  const mat = useMemo(() => fxMat(kind, step), [kind, step]);
  const ref = React.useRef<THREE.Mesh>(null!);
  useFrame(({ camera }) => { const m = ref.current; if (m) m.rotation.y = Math.atan2(camera.position.x - pos[0], camera.position.z - pos[2]); });
  return <mesh ref={ref} position={pos} material={mat} onUpdate={(m) => m.layers.set(NOINK)}><planeGeometry args={[1.6 * s, 1.6 * s]} /></mesh>;
};

// ---------- world pieces ----------
function useMats() {
  return useMemo(() => {
    const L = (o: THREE.MeshLambertMaterialParameters) => twoTone(new THREE.MeshLambertMaterial(o));
    const rep = (t: THREE.Texture, x: number, y: number) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); return t; };
    return {
      grass: L({ map: rep(grassHD(), 24, 24) }),
      stone: L({ map: rep(stoneHD("rock", ["#9a8d7c", "#8a7d6c", "#a89a86", "#7d7060"]), 2, 2) }),
      stoneLight: L({ map: rep(stoneHD("cliff", ["#c9bda6", "#bdb098", "#d4c8ae", "#b3a88f"]), 3, 3) }),
      cobble: L({ map: rep(cobbleHD(), 3, 14) }),
      sand: L({ color: "#cbb27f" }),
      leaf: L({ color: "#4d8a3d" }),
      leaf2: L({ color: "#67a34a" }),
      trunk: L({ color: "#6e4f30" }),
      white: L({ color: "#f2ede2" }),
      dark: L({ color: "#4a4038" }),
    };
  }, []);
}
type Mats = ReturnType<typeof useMats>;

const House: React.FC<{ pos: V3; ry?: number; wall: string; roof: string; s?: number; mats: Mats }> = ({ pos, ry = 0, wall, roof, s = 1 }) => {
  const fm = useMemo(() => twoTone(new THREE.MeshLambertMaterial({ map: facadeHD(`h${wall}`, 6, 5, { wall, shutter: "#5a4632", door: true }) })), [wall]);
  const rm = useMemo(() => twoTone(new THREE.MeshLambertMaterial({ map: roofHD(roof) })), [roof]);
  return (
    <group position={pos} rotation={[0, ry, 0]} scale={s}>
      <mesh material={fm} position={[0, 2.5, 0]} castShadow receiveShadow><boxGeometry args={[6, 5, 5]} /></mesh>
      <mesh material={rm} position={[0, 6.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[4.9, 3.0, 4]} /></mesh>
    </group>
  );
};
const Tree: React.FC<{ pos: V3; s?: number; mats: Mats }> = ({ pos, s = 1, mats }) => (
  <group position={pos} scale={s}>
    <mesh material={mats.trunk} position={[0, 1.2, 0]} castShadow><cylinderGeometry args={[0.22, 0.3, 2.4, 7]} /></mesh>
    <mesh material={mats.leaf} position={[0, 3.6, 0]} castShadow><sphereGeometry args={[1.9, 10, 8]} /></mesh>
    <mesh material={mats.leaf2} position={[1.1, 2.9, 0.4]} castShadow><sphereGeometry args={[1.3, 10, 8]} /></mesh>
  </group>
);
const Goat: React.FC<{ pos: V3; ry?: number; mats: Mats }> = ({ pos, ry = 0, mats }) => (
  <group position={pos} rotation={[0, ry, 0]}>
    <mesh material={mats.white} position={[0, 0.75, 0]} castShadow><sphereGeometry args={[0.62, 10, 8]} /></mesh>
    <mesh material={mats.white} position={[0.62, 1.05, 0]} castShadow><sphereGeometry args={[0.3, 8, 7]} /></mesh>
    <mesh material={mats.dark} position={[0.5, 1.35, 0.14]} rotation={[0, 0, -0.7]}><coneGeometry args={[0.07, 0.34, 5]} /></mesh>
    <mesh material={mats.dark} position={[0.5, 1.35, -0.14]} rotation={[0, 0, -0.7]}><coneGeometry args={[0.07, 0.34, 5]} /></mesh>
    {[[-0.35, 0.22], [0.35, 0.22], [-0.35, -0.22], [0.35, -0.22]].map(([x, z], i) => (
      <mesh key={i} material={mats.dark} position={[x, 0.3, z]}><cylinderGeometry args={[0.06, 0.06, 0.6, 5]} /></mesh>
    ))}
  </group>
);
/** one side of the ridge: faceted pyramids + a sheer notch wall; gap/2 = distance from centre to wall face */
const Massif: React.FC<{ side: 1 | -1; gap: number; mats: Mats }> = ({ side, gap, mats }) => {
  const wallX = side * (gap / 2 + 1.2);
  const cx = side * (gap / 2 + 16);
  return (
    <group>
      <mesh material={mats.stoneLight} position={[wallX, 7, -20]} castShadow receiveShadow><boxGeometry args={[2.4, 14, 16]} /></mesh>
      <mesh material={mats.stone} position={[cx, 11, -22]} scale={[1.5, 1, 0.62]} castShadow receiveShadow><coneGeometry args={[15, 22, 5]} /></mesh>
      <mesh material={mats.stone} position={[side * (gap / 2 + 30), 8, -20]} scale={[1.3, 1, 0.55]} castShadow receiveShadow><coneGeometry args={[13, 16, 5]} /></mesh>
      <mesh material={mats.stone} position={[side * (gap / 2 + 7), 6.5, -19]} scale={[1, 1, 0.6]} castShadow receiveShadow><coneGeometry args={[8, 13, 5]} /></mesh>
    </group>
  );
};

const Scene: React.FC = () => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const mats = useMats();
  const shot = shotAt(f);
  const local = (f - STARTS[shot]) / FPS;
  const dur = DURS[shot];
  const pt = clamp01(local / dur);
  const cam = CAMS[shot];
  const sunRef = React.useRef<THREE.DirectionalLight>(null!);
  const hemiRef = React.useRef<THREE.HemisphereLight>(null!);

  // ---- light state (shot 6 cycles day->golden->day) ----
  let lightName: "day" | "golden" = cam.light;
  let goldMix = cam.light === "golden" ? 1 : 0;
  if (shot === 5) { const c = Math.sin(pt * Math.PI * 2) * 0.5 + 0.5; goldMix = c * 0.85; lightName = goldMix > 0.5 ? "golden" : "day"; }
  const LD = LIGHTS.day, LG = LIGHTS.golden;
  const mixPreset = (get: (p: LightPreset) => number) => lerp(get(LD), get(LG), goldMix);
  const mixC = (get: (p: LightPreset) => [number, number, number]): [number, number, number] => [lerp(get(LD)[0], get(LG)[0], goldMix), lerp(get(LD)[1], get(LG)[1], goldMix), lerp(get(LD)[2], get(LG)[2], goldMix)];

  const fx = useMemo(() => ({
    ink: null as unknown as InkPass,
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: (() => { const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 }); return b; })(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, 1),
  }), []);
  if (!fx.ink) fx.ink = new InkPass(scene, camera as THREE.PerspectiveCamera);

  // ---- per-frame rig ----
  const camPos = lerpV(cam.pos[0], cam.pos[1], smooth(pt));
  const camLook = lerpV(cam.look[0], cam.look[1], smooth(pt));
  const pc = camera as THREE.PerspectiveCamera;
  pc.position.set(...camPos); pc.lookAt(...camLook); pc.fov = cam.fov; pc.updateProjectionMatrix();
  pc.layers.enable(NOINK);
  const fogCol = new THREE.Color(lerp(new THREE.Color(LD.fog).r, new THREE.Color(LG.fog).r, goldMix), lerp(new THREE.Color(LD.fog).g, new THREE.Color(LG.fog).g, goldMix), lerp(new THREE.Color(LD.fog).b, new THREE.Color(LG.fog).b, goldMix));
  scene.fog = new THREE.Fog(fogCol, mixPreset((p) => p.fogNear), mixPreset((p) => p.fogFar));
  scene.background = fogCol;
  TONE.uLitCol.value.set(...mixC((p) => p.lit)); TONE.uShadeCol.value.set(...mixC((p) => p.shade)); TONE.uShadeLift.value.set(...mixC((p) => p.lift));
  TONE.uLambert.value = mixPreset((p) => p.lambert); TONE.uSideK.value = mixPreset((p) => p.sideK); TONE.uTerm.value = mixPreset((p) => p.term);
  TONE.uSat.value = lerp(LOOK.day.sat, LOOK.golden.sat, goldMix);
  CHAR.uCharTint.value.set(...mixC((p) => p.charTint)); CHAR.uCharShade.value = mixPreset((p) => p.charShade);
  CHAR.uGrad.value = mixPreset((p) => p.charGrad); CHAR.uBodyGrad.value = mixPreset((p) => p.bodyGrad); CHAR.uSideTint.value.set(...mixC((p) => p.sideTint));
  fx.lens.focus = Math.max(0.3, Math.hypot(camPos[0] - camLook[0], camPos[1] - camLook[1], camPos[2] - camLook[2]));
  fx.lens.cInf = cam.cInf;
  gradeFor(fx.grade, lightName);
  const sunPos: V3 = goldMix > 0.5 ? [-14, 9, -34] : [26, 34, 18];
  if (sunRef.current) {
    sunRef.current.position.set(...sunPos);
    sunRef.current.intensity = mixPreset((p) => p.sunI);
    sunRef.current.color.set(goldMix > 0.5 ? LG.sunCol : LD.sunCol);
  }
  if (hemiRef.current) hemiRef.current.intensity = mixPreset((p) => p.hemiI);
  noInkFallback(scene as unknown as THREE.Object3D);

  const gap = shot < 5 ? 0.8 : shot === 5 ? lerp(1.2, 8.5, smooth(pt)) : 9.2;
  const strike = Math.abs(Math.sin(local * 2.4));
  const strikeStep = Math.floor((local * 2.4 / Math.PI) % 1 * 8);
  const skyTop = goldMix > 0.5 ? "#8a6f8a" : "#3373cc";
  const skyHor = goldMix > 0.5 ? "#ffc47c" : "#b8d0ec";
  const cloudTex = useMemo(() => cloudHD(3, goldMix > 0.5 ? { lit: "#ffd2a8", mid: "#f2a08f", shade: "#a98fc4" } : undefined), [goldMix > 0.5]);

  return (
    <>
      {/* lights */}
      <directionalLight ref={sunRef} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-30} shadow-camera-far={220} shadow-bias={-0.0004} />
      <hemisphereLight ref={hemiRef} args={["#dcecff", "#b49a78", 0.55]} />
      {/* sky dome */}
      <mesh onUpdate={(m) => m.layers.set(NOINK)}>
        <sphereGeometry args={[700, 16, 12]} />
        <meshBasicMaterial side={THREE.BackSide} fog={false} color={skyHor} />
      </mesh>
      <mesh position={[0, 60, -300]} onUpdate={(m) => m.layers.set(NOINK)}>
        <sphereGeometry args={[120, 16, 12]} />
        <meshBasicMaterial fog={false} color={skyTop} transparent opacity={0.55} />
      </mesh>
      {goldMix > 0.5 && (
        <mesh position={[-30, 16, -190]} onUpdate={(m) => m.layers.set(NOINK)}>
          <circleGeometry args={[16, 24]} />
          <meshBasicMaterial fog={false} color="#ffcf9e" />
        </mesh>
      )}
      {[[-60, 46, -120], [10, 54, -140], [80, 42, -110]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} onUpdate={(m) => m.layers.set(NOINK)}>
          <planeGeometry args={[34, 17]} />
          <meshBasicMaterial map={cloudTex} transparent depthWrite={false} fog={false} />
        </mesh>
      ))}
      {/* ground */}
      <mesh material={mats.grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]} receiveShadow>
        <planeGeometry args={[300, 220]} />
      </mesh>
      {/* distant low hills seen through the gap */}
      <mesh material={mats.stone} position={[-26, 5, -78]} scale={[1.4, 1, 0.7]}><coneGeometry args={[16, 10, 5]} /></mesh>
      <mesh material={mats.stone} position={[30, 4, -84]} scale={[1.4, 1, 0.7]}><coneGeometry args={[15, 8, 5]} /></mesh>
      {/* the ridge */}
      <Massif side={-1} gap={gap} mats={mats} />
      <Massif side={1} gap={gap} mats={mats} />
      {/* road through the gap */}
      {shot >= 5 && (
        <mesh material={mats.cobble} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, -16]} receiveShadow>
          <planeGeometry args={[Math.max(0.5, gap - 0.6), 64]} />
        </mesh>
      )}
      {/* winding road around the mountain (shot 2) */}
      {shot === 1 && (
        <mesh material={mats.sand} rotation={[-Math.PI / 2, 0, 0]} position={[26, 0.05, 2]} receiveShadow>
          <planeGeometry args={[10, 74]} />
        </mesh>
      )}
      {/* village */}
      <House pos={[-24, 0, 6]} wall="#e8c9a0" roof="#a5503c" mats={mats} />
      <House pos={[-33, 0, -2]} ry={0.4} wall="#d9a441" roof="#7a4b2a" s={0.85} mats={mats} />
      <House pos={[-17, 0, 13]} ry={-0.3} wall="#c9d4e2" roof="#a5503c" s={0.9} mats={mats} />
      <House pos={[30, 0, -34]} wall="#e8c9a0" roof="#7a4b2a" s={1.1} mats={mats} />
      <House pos={[40, 0, -28]} ry={-0.5} wall="#d9a441" roof="#a5503c" mats={mats} />
      <Tree pos={[-12, 0, 4]} mats={mats} />
      <Tree pos={[-28, 0, 14]} s={1.2} mats={mats} />
      <Tree pos={[14, 0, 8]} mats={mats} />
      <Tree pos={[24, 0, -6]} s={1.3} mats={mats} />
      {/* rubble at the notch */}
      {shot >= 4 && [0, 1, 2].map((i) => (
        <mesh key={i} material={mats.stone} position={[(i - 1) * (gap / 2 + 1.5), 0.5 + (shot === 5 ? pt * 0.7 : 0.7), -12 + i * 2]} scale={[1, 0.7, 1]} castShadow>
          <coneGeometry args={[1.1 + i * 0.3, 1.6, 5]} />
        </mesh>
      ))}

      {/* ================= shots ================= */}
      {shot === 0 && (
        <>
          <mesh material={mats.stone} position={[-2.2, 1.1, 1.2]} scale={[1.2, 1, 1]} castShadow><coneGeometry args={[1.9, 2.6, 5]} /></mesh>
          <Char pos={[1.4, 0, 2.2]} s={1.2} outfit={MANJHI} expr="stern" strike={strike} seed={3} />
          {strike > 0.92 && <Fx pos={[-1.4, 2.6, 1.4]} s={1.1} kind="burst" step={2} />}
          {strike > 0.92 && <Fx pos={[-1.8, 2.2, 1.6]} s={0.8} kind="stars" step={3} />}
        </>
      )}
      {shot === 1 && (
        <>
          <Char pos={[-19, 0, 10]} s={0.95} outfit={MANJHI} expr="neutral" mode="stroll" phase={(local * 0.9) % 1} seed={3} />
          <Char pos={[-16.5, 0, 12]} s={0.9} outfit={WIFE} expr="neutral" mode="stroll" phase={(local * 0.9 + 0.4) % 1} seed={5} />
          <Char pos={[26, 0, 18]} s={0.9} outfit={townsfolk(2)} expr="neutral" mode="stroll" phase={(local * 0.8) % 1} seed={7} />
        </>
      )}
      {shot === 2 && (
        <>
          <mesh material={mats.stone} position={[-8, 3.2, -10]} rotation={[0, 0.3, 0.5]} receiveShadow><boxGeometry args={[16, 0.8, 5]} /></mesh>
          <Char pos={[-8 + local * 0.35, 6.4 - (pt > 0.7 ? (pt - 0.7) * 6 : 0), -9]} s={1.0} outfit={WIFE} expr={pt > 0.7 ? "shock" : "neutral"} mode={pt > 0.78 ? "fall" : "stroll"} phase={(local * 0.9) % 1} tilt={pt > 0.6 ? (pt - 0.6) * 60 : 0} seed={5} />
          {pt > 0.72 && <Fx pos={[-6.6, 7.6, -8.6]} s={0.9} kind="stars" step={4} />}
          <Char pos={[-5.4, 0, 3]} s={1.1} outfit={MANJHI} expr="shock" seed={3} />
        </>
      )}
      {shot === 3 && (
        <>
          <Goat pos={[-3.0, 0, 1.8]} ry={0.7} mats={mats} />
          <Goat pos={[-3.8, 0, -0.6]} ry={1.1} mats={mats} />
          <Char pos={[0.4, 0, 0.6]} s={1.25} outfit={MANJHI} expr="stern" strike={0.15 + 0.2 * Math.sin(local * 1.4)} seed={3} />
        </>
      )}
      {shot === 4 && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <Char key={i} pos={[-4.6 + i * 2.1, 0, 3.6 - (i % 2) * 0.8]} s={1.02} outfit={townsfolk(i * 2)} expr="laugh" mode="stand" phase={0} tilt={Math.sin(local * 2 + i) * 3} seed={11 + i * 3} />
          ))}
          <Char pos={[lerp(-8.5, 8.5, pt), 0, 0.6]} s={1.12} outfit={MANJHI} expr="stern" mode="stroll" phase={(local * 0.95) % 1} seed={3} />
        </>
      )}
      {shot === 5 && (
        <>
          <Char pos={[0, 0, -7.5]} s={1.3} outfit={pt > 0.55 ? MANJHI_OLD : MANJHI} expr="stern" strike={strike} seed={3} />
          {strike > 0.9 && <Fx pos={[gap / 2 - 0.4, 1.8, -7]} s={1.0} kind="puff" step={strikeStep} />}
          {strike > 0.9 && <Fx pos={[-gap / 2 + 0.6, 1.2, -6.6]} s={0.8} kind="burst" step={3} />}
        </>
      )}
      {shot === 6 && (
        <>
          {[-1.8, 0.4, 2.4].map((x, i) => (
            <Char key={i} pos={[x, 0, lerp(8, -14, (pt + i * 0.22) % 1)]} s={1.0} outfit={townsfolk(i * 2 + 1)} expr="grin" mode="stroll" phase={(local * 0.9 + i * 0.3) % 1} seed={21 + i * 4} />
          ))}
          <Char pos={[5.6, 0, 4.5]} s={1.1} outfit={MANJHI_OLD} expr="grin" wave={Math.sin(local * 2.2)} seed={3} />
        </>
      )}
      {shot === 7 && (
        <>
          <group position={[lerp(-9, 9, pt), 0, -2]}>
            <mesh material={mats.trunk} position={[0, 0.85, 0]} castShadow><boxGeometry args={[2.6, 0.5, 1.4]} /></mesh>
            <mesh material={mats.dark} position={[-0.9, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.36, 0.36, 0.25, 12]} /></mesh>
            <mesh material={mats.dark} position={[0.9, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.36, 0.36, 0.25, 12]} /></mesh>
            <Char pos={[0, 1.1, 0]} s={0.95} outfit={townsfolk(4)} expr="grin" mode="sit" seed={31} />
          </group>
          {[0, 1].map((i) => (
            <Char key={i} pos={[-3 + i * 2.4, 0, lerp(4, -12, (pt + i * 0.3) % 1)]} s={1.0} outfit={townsfolk(i * 3)} expr="grin" mode="stroll" phase={(local * 0.9 + i * 0.4) % 1} seed={41 + i * 5} />
          ))}
          <Char pos={[3.4, 0, 3.4]} s={1.3} outfit={MANJHI_OLD} expr="grin" seed={3} />
        </>
      )}

      <EffectComposer multisampling={4}>
        <primitive object={fx.ink} dispose={null} />
        <primitive object={fx.lens.pre} dispose={null} />
        <primitive object={fx.lens.main} dispose={null} />
        <primitive object={fx.bloom} dispose={null} />
        <primitive object={fx.tone} dispose={null} />
        <primitive object={fx.grade} dispose={null} />
      </EffectComposer>
    </>
  );
};

export const ManjhiShort: React.FC = () => {
  const f = useCurrentFrame();
  const flash = f >= 148 && f < 152 ? [1, 0.7, 0.4, 0.15][f - 148] : 0;
  return (
    <AbsoluteFill style={{ background: "#b8d0ec" }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 42, near: 0.2, far: 1600, position: [6, 2, 10] }}>
        <Scene />
      </ThreeCanvas>
      <Audio src={staticFile("voice.wav")} />
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
    </AbsoluteFill>
  );
};
